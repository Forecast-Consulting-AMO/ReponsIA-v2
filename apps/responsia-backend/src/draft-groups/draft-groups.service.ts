import { Injectable, Logger, Inject } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { ResponseDraft } from '../database/entities/response-draft.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiService, StreamCallbacks } from '../ai/ai.service'
import { SearchService } from '../search/search.service'
import { ProjectsService } from '../projects/projects.service'
import { getModelById } from '../ai/ai.config'
import { QUEUE_SERVICE, QueueService } from '../jobs/queue.interface'
import { UpdateDraftGroupDto } from './dto/update-draft-group.dto'

@Injectable()
export class DraftGroupsService {
  private readonly logger = new Logger(DraftGroupsService.name)

  constructor(
    @InjectRepository(DraftGroup) private groupRepo: Repository<DraftGroup>,
    @InjectRepository(ExtractedItem)
    private itemRepo: Repository<ExtractedItem>,
    @InjectRepository(ResponseDraft)
    private draftRepo: Repository<ResponseDraft>,
    @InjectRepository(AnalysisFeedback)
    private feedbackRepo: Repository<AnalysisFeedback>,
    @InjectRepository(JobProgress) private jobRepo: Repository<JobProgress>,
    private aiService: AiService,
    private searchService: SearchService,
    private projectsService: ProjectsService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
  ) {}

  async findAll(projectId: number, auth0Id: string): Promise<DraftGroup[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.groupRepo.find({
      where: { projectId },
      relations: ['outlineSection'],
      order: { outlineSection: { position: 'ASC' } },
    })
  }

  async update(id: number, dto: UpdateDraftGroupDto): Promise<DraftGroup> {
    const group = await this.groupRepo.findOneOrFail({ where: { id } })
    if (dto.modelId !== undefined) group.modelId = dto.modelId
    if (dto.systemPrompt !== undefined) group.systemPrompt = dto.systemPrompt
    if (dto.generatedText !== undefined) group.generatedText = dto.generatedText
    if (dto.status !== undefined) {
      group.status = dto.status as DraftGroup['status']
    }
    if (dto.generatedText && group.status === 'drafted') {
      group.status = 'edited'
    }
    return this.groupRepo.save(group)
  }

  /** Build context for a draft group: items + RAG + feedback */
  private async buildContext(group: DraftGroup): Promise<string> {
    const items = await this.itemRepo.find({
      where: { outlineSectionId: group.outlineSectionId },
    })

    let context = ''

    // 1. Questions & conditions
    const questions = items.filter((i) => i.kind === 'question')
    const conditions = items.filter((i) => i.kind === 'condition')

    if (questions.length > 0) {
      context += '=== QUESTIONS A REPONDRE ===\n'
      context += questions.map((q) => `- ${q.originalText}`).join('\n')
      context += '\n\n'
    }
    if (conditions.length > 0) {
      context += '=== CONDITIONS A RESPECTER ===\n'
      context += conditions.map((c) => `- ${c.originalText}`).join('\n')
      context += '\n\n'
    }

    // 2. RAG from Azure AI Search (or pgvector)
    const searchQuery = items
      .map((i) => i.originalText)
      .join(' ')
      .substring(0, 500)
    if (searchQuery) {
      const chunks = await this.searchService.search(
        group.projectId,
        searchQuery,
        5,
      )
      if (chunks.length > 0) {
        context += '=== CONNAISSANCES (soumissions precedentes) ===\n'
        context += chunks.map((c) => c.content).join('\n---\n')
        context += '\n\n'
      }
    }

    // 3. Matched feedback
    const itemIds = items.map((i) => i.id)
    if (itemIds.length > 0) {
      const feedback = await this.feedbackRepo
        .createQueryBuilder('f')
        .where('f.extracted_item_id IN (:...ids)', { ids: itemIds })
        .orWhere('f.project_id = :pid', { pid: group.projectId })
        .getMany()

      const relevantFeedback = feedback.filter(
        (f) => itemIds.includes(f.extractedItemId!) || !f.extractedItemId,
      )

      if (relevantFeedback.length > 0) {
        context += "=== RETOURS D'EVALUATIONS PRECEDENTES ===\n"
        context += relevantFeedback
          .map((f) => `[${f.feedbackType}/${f.severity}] ${f.content}`)
          .join('\n')
        context += '\n\n'
      }
    }

    return context
  }

  /** Save a version snapshot in response_drafts */
  private async saveVersionHistory(
    draftGroupId: number,
    content: string,
    modelId: string,
    prompt: string,
  ): Promise<void> {
    const lastDraft = await this.draftRepo.findOne({
      where: { draftGroupId },
      order: { version: 'DESC' },
    })
    await this.draftRepo.save(
      this.draftRepo.create({
        draftGroupId,
        version: (lastDraft?.version ?? 0) + 1,
        content,
        modelUsed: modelId,
        promptUsed: prompt,
      }),
    )
  }

  /** Stream-generate a draft for a single group */
  async generate(id: number, callbacks: StreamCallbacks): Promise<void> {
    const group = await this.groupRepo.findOneOrFail({
      where: { id },
      relations: ['outlineSection'],
    })

    group.status = 'generating'
    await this.groupRepo.save(group)

    const model =
      getModelById(group.modelId) ?? this.aiService.resolveModel('drafting')
    const context = await this.buildContext(group)
    const systemPrompt =
      group.systemPrompt + (context ? `\n\n${context}` : '')
    const userPrompt = `Redigez la section "${group.outlineSection.title}": ${group.outlineSection.description || ''}`

    await this.aiService.stream(model, systemPrompt, userPrompt, {
      onToken: callbacks.onToken,
      onDone: (fullText) => {
        // Fire-and-forget persistence (stream() does not await onDone)
        Promise.resolve()
          .then(async () => {
            group.generatedText = fullText
            group.status = 'drafted'
            await this.groupRepo.save(group)

            await this.saveVersionHistory(
              id,
              fullText,
              model.id,
              systemPrompt,
            )

            // Update item statuses
            await this.itemRepo.update(
              { outlineSectionId: group.outlineSectionId, status: 'pending' },
              { status: 'drafted' },
            )
          })
          .catch((err) =>
            this.logger.error(`Failed to persist draft for group ${id}`, err),
          )

        callbacks.onDone(fullText)
      },
      onError: (err) => {
        Promise.resolve()
          .then(async () => {
            group.status = 'pending'
            await this.groupRepo.save(group)
          })
          .catch((e) =>
            this.logger.error(
              `Failed to reset status for group ${id}`,
              e,
            ),
          )

        callbacks.onError(err)
      },
      signal: callbacks.signal,
    })
  }

  /** Queue draft-all job */
  async queueDraftAll(
    projectId: number,
    auth0Id: string,
  ): Promise<{ jobId: string }> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    const jobId = await this.queueService.send('draft-all', { projectId })
    return { jobId }
  }

  /** Process draft-all: generate all pending groups sequentially */
  async processDraftAll(projectId: number): Promise<void> {
    const job = this.jobRepo.create({
      projectId,
      jobType: 'draft_all',
      status: 'processing',
      progress: 0,
      message: 'Redaction automatique...',
    })
    await this.jobRepo.save(job)

    try {
      const groups = await this.groupRepo.find({
        where: { projectId, status: 'pending' },
        relations: ['outlineSection'],
        order: { outlineSection: { position: 'ASC' } },
      })

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]
        job.progress = Math.round((i / groups.length) * 100)
        job.message = `Redaction: ${group.outlineSection?.title || 'Section'}...`
        await this.jobRepo.save(job)

        const model =
          getModelById(group.modelId) ??
          this.aiService.resolveModel('drafting')
        const context = await this.buildContext(group)
        const systemPrompt =
          group.systemPrompt + (context ? `\n\n${context}` : '')
        const userPrompt = `Redigez la section "${group.outlineSection?.title}"`

        const fullText = await this.aiService.generate(
          model,
          systemPrompt,
          userPrompt,
        )

        group.generatedText = fullText
        group.status = 'drafted'
        await this.groupRepo.save(group)

        // Version history
        await this.saveVersionHistory(
          group.id,
          fullText,
          model.id,
          systemPrompt,
        )
      }

      job.status = 'completed'
      job.progress = 100
      job.message = `${groups.length} sections redigees`
      job.completedAt = new Date()
      await this.jobRepo.save(job)
    } catch (err: any) {
      job.status = 'error'
      job.errorMessage = err.message
      job.completedAt = new Date()
      await this.jobRepo.save(job)
      throw err
    }
  }
}
