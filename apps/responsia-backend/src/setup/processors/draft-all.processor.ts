import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Requirement } from '../../database/entities/requirement.entity'
import { JobProgress } from '../../database/entities/job-progress.entity'
import { AiService } from '../../ai/ai.service'
import { RequirementsService } from '../../requirements/requirements.service'

@Injectable()
export class DraftAllProcessor {
  private readonly logger = new Logger(DraftAllProcessor.name)

  constructor(
    @InjectRepository(Requirement)
    private requirementsRepo: Repository<Requirement>,
    @InjectRepository(JobProgress)
    private jobProgressRepo: Repository<JobProgress>,
    private aiService: AiService,
    private requirementsService: RequirementsService,
  ) {}

  /** Draft responses for all pending requirements in a project */
  async process(projectId: number): Promise<void> {
    const job = this.jobProgressRepo.create({
      projectId,
      jobType: 'draft_all',
      status: 'processing',
      progress: 0,
      message: 'Rédaction des réponses...',
    })
    await this.jobProgressRepo.save(job)

    try {
      const pending = await this.requirementsRepo.find({
        where: { projectId, responseStatus: 'pending' },
        order: { sectionNumber: 'ASC' },
      })

      if (pending.length === 0) {
        job.status = 'completed'
        job.progress = 100
        job.message = 'Aucune exigence en attente'
        job.completedAt = new Date()
        await this.jobProgressRepo.save(job)
        return
      }

      const model = this.aiService.resolveModel('drafting')
      const systemPrompt = this.aiService.resolvePrompt('drafting')

      for (let i = 0; i < pending.length; i++) {
        const req = pending[i]
        job.progress = Math.round((i / pending.length) * 100)
        job.message = `Rédaction ${i + 1}/${pending.length}: ${req.sectionNumber || 'Section'}...`
        await this.jobProgressRepo.save(job)

        // Get context
        const knowledge = await this.requirementsService.getKnowledgeContext(
          projectId,
          req.requirementText,
        )
        const feedbackItems = await this.requirementsService.getMatchedFeedback(req.id)
        const feedbackCtx = feedbackItems.length > 0
          ? feedbackItems.map((f) => `[${f.feedbackType}/${f.severity}] ${f.content}`).join('\n')
          : ''

        const fullSystem =
          systemPrompt +
          (knowledge ? `\n\nContexte de la base de connaissances:\n${knowledge}` : '') +
          (feedbackCtx ? `\n\nRetours précédents à intégrer:\n${feedbackCtx}` : '')

        const response = await this.aiService.generate(
          model,
          fullSystem,
          `Exigence: ${req.requirementText}`,
        )

        await this.requirementsService.saveResponse(req.id, response)
      }

      job.status = 'completed'
      job.progress = 100
      job.message = `${pending.length} réponses rédigées`
      job.completedAt = new Date()
      await this.jobProgressRepo.save(job)
    } catch (err: any) {
      job.status = 'error'
      job.errorMessage = err.message
      job.completedAt = new Date()
      await this.jobProgressRepo.save(job)
      throw err
    }
  }
}
