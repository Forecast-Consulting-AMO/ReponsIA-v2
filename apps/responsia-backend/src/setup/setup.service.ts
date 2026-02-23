import { Injectable, Inject, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JobProgress } from '../database/entities/job-progress.entity'
import { ProjectsService } from '../projects/projects.service'
import { QUEUE_SERVICE, QueueService } from '../jobs/queue.interface'
import { OutlineService } from '../outline/outline.service'
import { ExtractionService } from '../extraction/extraction.service'
import { IndexingProcessor } from './processors/indexing.processor'
import { FeedbackProcessor } from './processors/feedback.processor'

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name)

  constructor(
    @InjectRepository(JobProgress)
    private jobProgressRepo: Repository<JobProgress>,
    private projectsService: ProjectsService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
    private outlineService: OutlineService,
    private extractionService: ExtractionService,
    private indexingProcessor: IndexingProcessor,
    private feedbackProcessor: FeedbackProcessor,
  ) {
    // Register queue handlers
    this.queueService.register('setup-pipeline', async (payload) => {
      await this.runPipeline(payload.projectId as number)
    })
    this.queueService.register('indexing', async (payload) => {
      await this.indexingProcessor.process(payload.projectId as number)
    })
    this.queueService.register('feedback', async (payload) => {
      await this.feedbackProcessor.process(payload.projectId as number)
    })
  }

  /** Start the full Phase A pipeline for a project */
  async start(
    projectId: number,
    auth0Id: string,
  ): Promise<{ jobId: string }> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    const jobId = await this.queueService.send('setup-pipeline', { projectId })
    return { jobId }
  }

  /** Run the 4-phase pipeline: structure → extraction → indexing → feedback */
  private async runPipeline(projectId: number): Promise<void> {
    this.logger.log(`Starting setup pipeline for project ${projectId}`)

    // Step 1: Analyze structure (outline sections + draft groups)
    await this.outlineService.analyzeStructure(projectId, 'system')

    // Step 2: Extract items (questions + conditions from RFP docs)
    await this.extractionService.extractItems(projectId, 'system')

    // Step 3: Index knowledge base (past submissions + references)
    await this.indexingProcessor.process(projectId)

    // Step 4: Extract feedback from analysis reports
    await this.feedbackProcessor.process(projectId)

    this.logger.log(`Setup pipeline completed for project ${projectId}`)
  }

  /** Get all job progress for a project (for SSE progress stream) */
  async getProgress(projectId: number): Promise<JobProgress[]> {
    return this.jobProgressRepo.find({
      where: { projectId },
      order: { startedAt: 'DESC' },
    })
  }
}
