import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Document } from '../../database/entities/document.entity'
import { Requirement } from '../../database/entities/requirement.entity'
import { JobProgress } from '../../database/entities/job-progress.entity'
import { AiService } from '../../ai/ai.service'

@Injectable()
export class AnalysisProcessor {
  private readonly logger = new Logger(AnalysisProcessor.name)

  constructor(
    @InjectRepository(Document)
    private documentsRepo: Repository<Document>,
    @InjectRepository(Requirement)
    private requirementsRepo: Repository<Requirement>,
    @InjectRepository(JobProgress)
    private jobProgressRepo: Repository<JobProgress>,
    private aiService: AiService,
  ) {}

  /** Extract requirements from all RFP documents in a project */
  async process(projectId: number): Promise<void> {
    const job = this.jobProgressRepo.create({
      projectId,
      jobType: 'analysis',
      status: 'processing',
      progress: 0,
      message: 'Extraction des exigences...',
    })
    await this.jobProgressRepo.save(job)

    try {
      const rfpDocs = await this.documentsRepo.find({
        where: { projectId, fileType: 'rfp' },
      })

      if (rfpDocs.length === 0) {
        job.status = 'completed'
        job.progress = 100
        job.message = 'Aucun document RFP trouvé'
        job.completedAt = new Date()
        await this.jobProgressRepo.save(job)
        return
      }

      const model = this.aiService.resolveModel('analysis')
      const systemPrompt = this.aiService.resolvePrompt('analysis')

      let totalRequirements = 0

      for (let i = 0; i < rfpDocs.length; i++) {
        const doc = rfpDocs[i]
        job.progress = Math.round(((i) / rfpDocs.length) * 100)
        job.message = `Analyse de ${doc.filename}...`
        await this.jobProgressRepo.save(job)

        if (!doc.extractedText || doc.extractedText.length < 10) continue

        const response = await this.aiService.generate(
          model,
          systemPrompt,
          doc.extractedText,
        )

        // Parse JSON array of requirements (strip markdown code fences if present)
        try {
          const cleaned = response.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
          const parsed = JSON.parse(cleaned)
          const requirements = Array.isArray(parsed) ? parsed : [parsed]

          for (const req of requirements) {
            await this.requirementsRepo.save(
              this.requirementsRepo.create({
                projectId,
                sectionNumber: req.sectionNumber || '',
                sectionTitle: req.sectionTitle || '',
                requirementText: req.requirementText || '',
                requirementType: req.requirementType || 'mandatory',
                maxScore: req.maxScore ?? null,
                sourceDocumentId: doc.id,
                sourcePage: req.sourcePage ?? null,
              }),
            )
            totalRequirements++
          }
        } catch (parseErr) {
          this.logger.warn(`Failed to parse analysis response for ${doc.filename}: ${parseErr}`)
        }
      }

      job.status = 'completed'
      job.progress = 100
      job.message = `${totalRequirements} exigences extraites`
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
