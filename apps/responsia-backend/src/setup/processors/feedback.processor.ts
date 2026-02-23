import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Document } from '../../database/entities/document.entity'
import { AnalysisFeedback } from '../../database/entities/feedback.entity'
import { ExtractedItem } from '../../database/entities/extracted-item.entity'
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
    @InjectRepository(ExtractedItem)
    private itemRepo: Repository<ExtractedItem>,
    @InjectRepository(JobProgress)
    private jobProgressRepo: Repository<JobProgress>,
    private aiService: AiService,
  ) {}

  /** Extract feedback from analysis_report documents and match to extracted items */
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
        job.message = 'Aucun rapport d\'analyse trouve'
        job.completedAt = new Date()
        await this.jobProgressRepo.save(job)
        return
      }

      const model = this.aiService.resolveModel('feedback')
      const systemPrompt = this.aiService.resolvePrompt('feedback')

      // Load extracted items for smart matching
      const items = await this.itemRepo.find({
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
          const feedbackItems = Array.isArray(parsed) ? parsed : [parsed]

          for (const fb of feedbackItems) {
            // Smart match: find extracted item by section reference
            let matchedItemId: number | null = null
            if (fb.sectionReference && items.length > 0) {
              const matched = items.find(
                (item) =>
                  item.sectionReference === fb.sectionReference ||
                  item.originalText
                    ?.toLowerCase()
                    .includes(fb.sectionReference?.toLowerCase()),
              )
              if (matched) matchedItemId = matched.id
            }

            await this.feedbackRepo.save(
              this.feedbackRepo.create({
                projectId,
                documentId: doc.id,
                extractedItemId: matchedItemId ?? undefined,
                sectionReference: fb.sectionReference || '',
                feedbackType: fb.feedbackType || 'comment',
                severity: fb.severity || 'info',
                content: fb.content || '',
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
