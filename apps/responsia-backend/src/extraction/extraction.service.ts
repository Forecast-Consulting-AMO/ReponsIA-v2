import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { Document } from '../database/entities/document.entity'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'
import { UpdateItemDto } from './dto/update-item.dto'

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name)

  constructor(
    @InjectRepository(ExtractedItem)
    private itemRepo: Repository<ExtractedItem>,
    @InjectRepository(Document)
    private documentsRepo: Repository<Document>,
    @InjectRepository(OutlineSection)
    private sectionRepo: Repository<OutlineSection>,
    @InjectRepository(JobProgress)
    private jobRepo: Repository<JobProgress>,
    private aiService: AiService,
    private projectsService: ProjectsService,
  ) {}

  async findAll(
    projectId: number,
    auth0Id: string,
  ): Promise<ExtractedItem[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.itemRepo.find({
      where: { projectId },
      order: { sectionReference: 'ASC', kind: 'ASC' },
    })
  }

  async findByTheme(
    projectId: number,
    auth0Id: string,
  ): Promise<Record<string, ExtractedItem[]>> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    const items = await this.itemRepo.find({ where: { projectId } })
    const grouped: Record<string, ExtractedItem[]> = {}
    for (const item of items) {
      for (const theme of item.aiThemes || ['non classe']) {
        if (!grouped[theme]) grouped[theme] = []
        grouped[theme].push(item)
      }
    }
    return grouped
  }

  async update(id: number, dto: UpdateItemDto): Promise<ExtractedItem> {
    const item = await this.itemRepo.findOneOrFail({ where: { id } })
    Object.assign(item, dto)
    return this.itemRepo.save(item)
  }

  /** Start extraction and return immediately — runs AI in background */
  async startExtractItems(
    projectId: number,
    auth0Id: string,
  ): Promise<JobProgress> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')

    const job = this.jobRepo.create({
      projectId,
      jobType: 'extraction',
      status: 'processing',
      progress: 0,
      message: 'Extraction des elements...',
    })
    const saved = await this.jobRepo.save(job)

    // Fire-and-forget
    this.runExtractItems(projectId, saved).catch((err) => {
      this.logger.error(`Extraction failed: ${err.message}`)
    })

    return saved
  }

  /** Full synchronous extract — used by setup pipeline (already background) */
  async extractItems(
    projectId: number,
    auth0Id: string,
  ): Promise<void> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')

    const job = this.jobRepo.create({
      projectId,
      jobType: 'extraction',
      status: 'processing',
      progress: 0,
      message: 'Extraction des elements...',
    })
    await this.jobRepo.save(job)
    await this.runExtractItems(projectId, job)
  }

  /** Core extraction logic shared by both sync and async paths */
  private async runExtractItems(
    projectId: number,
    job: JobProgress,
  ): Promise<void> {
    try {
      // Clear existing items
      await this.itemRepo.delete({ projectId })

      const rfpDocs = await this.documentsRepo.find({
        where: { projectId, fileType: 'rfp' },
      })
      const outlineSections = await this.sectionRepo.find({
        where: { projectId },
        order: { position: 'ASC' },
      })

      if (rfpDocs.length === 0) {
        job.status = 'completed'
        job.progress = 100
        job.message = 'Aucun document RFP'
        job.completedAt = new Date()
        await this.jobRepo.save(job)
        return
      }

      const model = this.aiService.resolveModel('extraction')
      const systemPrompt = this.aiService.resolvePrompt('extraction')
      let totalItems = 0

      for (let i = 0; i < rfpDocs.length; i++) {
        const doc = rfpDocs[i]
        job.progress = Math.round((i / rfpDocs.length) * 100)
        job.message = `Analyse de ${doc.filename}...`
        await this.jobRepo.save(job)

        if (!doc.extractedText || doc.extractedText.length < 10) continue

        const response = await this.aiService.generate(
          model,
          systemPrompt,
          doc.extractedText,
        )

        try {
          const cleaned = response
            .replace(/^```(?:json)?\s*\n?/m, '')
            .replace(/\n?```\s*$/m, '')
            .trim()
          const parsed = JSON.parse(cleaned)
          const items = Array.isArray(parsed) ? parsed : [parsed]

          for (const item of items) {
            // Auto-assign to outline section by title similarity
            let sectionId: number | null = null
            if (item.sectionReference && outlineSections.length > 0) {
              const match = outlineSections.find(
                (s) =>
                  s.title
                    .toLowerCase()
                    .includes(item.sectionReference?.toLowerCase()) ||
                  item.sectionReference
                    ?.toLowerCase()
                    .includes(s.title.toLowerCase()),
              )
              if (match) sectionId = match.id
            }
            // Fallback: assign to first section
            if (!sectionId && outlineSections.length > 0) {
              sectionId = outlineSections[0].id
            }

            await this.itemRepo.save(
              this.itemRepo.create({
                projectId,
                outlineSectionId: sectionId,
                kind: item.kind === 'condition' ? 'condition' : 'question',
                originalText: item.originalText || '',
                sectionReference: item.sectionReference || null,
                sourceDocumentId: doc.id,
                sourcePage: item.sourcePage ?? null,
                aiThemes: item.aiThemes || [],
              }),
            )
            totalItems++
          }
        } catch (parseErr) {
          this.logger.warn(
            `Failed to parse extraction for ${doc.filename}: ${parseErr}`,
          )
        }
      }

      job.status = 'completed'
      job.progress = 100
      job.message = `${totalItems} elements extraits`
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
