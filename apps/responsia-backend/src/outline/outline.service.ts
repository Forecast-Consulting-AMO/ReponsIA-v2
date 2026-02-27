import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { Document } from '../database/entities/document.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'
import { PROMPTS } from '../ai/prompts'
import { CreateOutlineSectionDto } from './dto/create-outline-section.dto'
import { UpdateOutlineSectionDto } from './dto/update-outline-section.dto'

@Injectable()
export class OutlineService {
  private readonly logger = new Logger(OutlineService.name)

  constructor(
    @InjectRepository(OutlineSection)
    private sectionRepo: Repository<OutlineSection>,
    @InjectRepository(Document)
    private documentsRepo: Repository<Document>,
    @InjectRepository(JobProgress)
    private jobRepo: Repository<JobProgress>,
    @InjectRepository(DraftGroup)
    private draftGroupRepo: Repository<DraftGroup>,
    private aiService: AiService,
    private projectsService: ProjectsService,
  ) {}

  async findAll(
    projectId: number,
    auth0Id: string,
  ): Promise<OutlineSection[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.sectionRepo.find({
      where: { projectId },
      order: { position: 'ASC' },
    })
  }

  /** Start analysis and return immediately — runs AI in background */
  async startAnalyzeStructure(
    projectId: number,
    auth0Id: string,
  ): Promise<JobProgress> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')

    const job = this.jobRepo.create({
      projectId,
      jobType: 'structure',
      status: 'processing',
      progress: 0,
      message: 'Analyse de la structure...',
    })
    const saved = await this.jobRepo.save(job)

    // Fire-and-forget: don't block the HTTP response
    this.runAnalyzeStructure(projectId, saved).catch((err) => {
      this.logger.error(`Structure analysis failed: ${err.message}`)
    })

    return saved
  }

  /** Full synchronous analyze — used by the setup pipeline (already background) */
  async analyzeStructure(
    projectId: number,
    auth0Id: string,
  ): Promise<void> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')

    const job = this.jobRepo.create({
      projectId,
      jobType: 'structure',
      status: 'processing',
      progress: 0,
      message: 'Analyse de la structure...',
    })
    await this.jobRepo.save(job)
    await this.runAnalyzeStructure(projectId, job)
  }

  /** Core analysis logic shared by both sync and async paths */
  private async runAnalyzeStructure(
    projectId: number,
    job: JobProgress,
  ): Promise<void> {
    try {
      // Clear existing outline for this project
      await this.draftGroupRepo.delete({ projectId })
      await this.sectionRepo.delete({ projectId })

      const rfpDocs = await this.documentsRepo.find({
        where: { projectId, fileType: 'rfp' },
      })
      const templateDoc = await this.documentsRepo.findOne({
        where: { projectId, fileType: 'template' },
      })

      let prompt = ''
      if (templateDoc?.extractedText) {
        prompt += `=== MODELE DE REPONSE ===\n${templateDoc.extractedText.substring(0, 5000)}\n\n`
      }
      for (const doc of rfpDocs) {
        if (doc.extractedText) {
          prompt += `=== DOCUMENT RFP: ${doc.filename} ===\n${doc.extractedText.substring(0, 8000)}\n\n`
        }
      }

      if (!prompt) {
        job.status = 'completed'
        job.progress = 100
        job.message = 'Aucun document a analyser'
        job.completedAt = new Date()
        await this.jobRepo.save(job)
        return
      }

      job.progress = 30
      job.message = 'Extraction de la structure...'
      await this.jobRepo.save(job)

      const model = this.aiService.resolveModel('structure')
      const systemPrompt = this.aiService.resolvePrompt('structure')
      const result = await this.aiService.generate(model, systemPrompt, prompt)

      const cleaned = result
        .replace(/^```(?:json)?\s*\n?/m, '')
        .replace(/\n?```\s*$/m, '')
        .trim()
      const sections = JSON.parse(cleaned)

      job.progress = 70
      job.message = 'Enregistrement des sections...'
      await this.jobRepo.save(job)

      const defaultPrompt = PROMPTS.drafting

      for (let i = 0; i < sections.length; i++) {
        const s = sections[i]
        const section = await this.sectionRepo.save(
          this.sectionRepo.create({
            projectId,
            position: s.position ?? i,
            title: s.title,
            description: s.description || null,
            source: s.source || 'ai_suggested',
          }),
        )

        // Create a DraftGroup for each section
        await this.draftGroupRepo.save(
          this.draftGroupRepo.create({
            projectId,
            outlineSectionId: section.id,
            modelId: 'claude-sonnet-4.6',
            systemPrompt: defaultPrompt,
          }),
        )
      }

      job.status = 'completed'
      job.progress = 100
      job.message = `${sections.length} sections identifiees`
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

  async create(
    projectId: number,
    auth0Id: string,
    dto: CreateOutlineSectionDto,
  ): Promise<OutlineSection> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    const entity = this.sectionRepo.create({
      projectId,
      title: dto.title,
      description: dto.description,
      parentId: dto.parentId,
      position: dto.position,
      source: (dto.source as OutlineSection['source']) ?? 'ai_suggested',
    })
    const section = await this.sectionRepo.save(entity)
    // Create matching DraftGroup
    await this.draftGroupRepo.save(
      this.draftGroupRepo.create({
        projectId,
        outlineSectionId: section.id,
        modelId: 'claude-sonnet-4.6',
        systemPrompt: PROMPTS.drafting,
      }),
    )
    return section
  }

  async update(
    id: number,
    dto: UpdateOutlineSectionDto,
  ): Promise<OutlineSection> {
    const section = await this.sectionRepo.findOneOrFail({ where: { id } })
    Object.assign(section, dto)
    return this.sectionRepo.save(section)
  }

  async remove(id: number): Promise<void> {
    await this.sectionRepo.delete(id)
  }

  async reorder(
    projectId: number,
    auth0Id: string,
    sections: { id: number; position: number; parentId?: number }[],
  ): Promise<void> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    for (const s of sections) {
      await this.sectionRepo.update(s.id, {
        position: s.position,
        parentId: s.parentId ?? null,
      })
    }
  }
}
