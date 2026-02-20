import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Document } from '../../database/entities/document.entity'
import { AnalysisFeedback } from '../../database/entities/feedback.entity'
import { Requirement } from '../../database/entities/requirement.entity'
import { JobProgress } from '../../database/entities/job-progress.entity'
import { AiService } from '../../ai/ai.service'

@Injectable()
export class FeedbackProcessor {
  private readonly logger = new Logger(FeedbackProcessor.name)

  constructor(
    @InjectRepository(Document)
    private documentsRepo: Repository<Document>,
    @InjectRepository(AnalysisFeedback)
    private feedbackRepo: Repository<AnalysisFeedback>,
    @InjectRepository(Requirement)
    private requirementsRepo: Repository<Requirement>,
    @InjectRepository(JobProgress)
    private jobProgressRepo: Repository<JobProgress>,
    private aiService: AiService,
  ) {}

  /** Extract feedback from analysis_report documents and match to requirements */
  async process(projectId: number): Promise<void> {
    const job = this.jobProgressRepo.create({
      projectId,
      jobType: 'feedback',
      status: 'processing',
      progress: 0,
      message: 'Extraction des retours...',
    })
    await this.jobProgressRepo.save(job)

    try {
      const reportDocs = await this.documentsRepo.find({
        where: { projectId, fileType: 'analysis_report' },
      })

      if (reportDocs.length === 0) {
        job.status = 'completed'
        job.progress = 100
        job.message = 'Aucun rapport d\'analyse trouvé'
        job.completedAt = new Date()
        await this.jobProgressRepo.save(job)
        return
      }

      const model = this.aiService.resolveModel('feedback')
      const systemPrompt = this.aiService.resolvePrompt('feedback')

      // Load requirements for smart matching
      const requirements = await this.requirementsRepo.find({
        where: { projectId },
      })

      let totalFeedback = 0

      for (let i = 0; i < reportDocs.length; i++) {
        const doc = reportDocs[i]
        job.progress = Math.round((i / reportDocs.length) * 100)
        job.message = `Analyse de ${doc.filename}...`
        await this.jobProgressRepo.save(job)

        if (!doc.extractedText) continue

        const response = await this.aiService.generate(
          model,
          systemPrompt,
          doc.extractedText,
        )

        try {
          const parsed = JSON.parse(response)
          const items = Array.isArray(parsed) ? parsed : [parsed]

          for (const item of items) {
            // Smart match: find requirement by section reference
            let matchedReqId: number | null = null
            if (item.sectionReference && requirements.length > 0) {
              const matched = requirements.find(
                (r) =>
                  r.sectionNumber === item.sectionReference ||
                  r.sectionTitle
                    ?.toLowerCase()
                    .includes(item.sectionReference?.toLowerCase()),
              )
              if (matched) matchedReqId = matched.id
            }

            await this.feedbackRepo.save(
              this.feedbackRepo.create({
                projectId,
                documentId: doc.id,
                requirementId: matchedReqId ?? undefined,
                sectionReference: item.sectionReference || '',
                feedbackType: item.feedbackType || 'comment',
                severity: item.severity || 'info',
                content: item.content || '',
              }),
            )
            totalFeedback++
          }
        } catch (parseErr) {
          this.logger.warn(`Failed to parse feedback response for ${doc.filename}: ${parseErr}`)
        }
      }

      job.status = 'completed'
      job.progress = 100
      job.message = `${totalFeedback} retours extraits`
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
