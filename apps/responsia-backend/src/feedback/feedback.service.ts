import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { ProjectsService } from '../projects/projects.service'
import { QUEUE_SERVICE, QueueService } from '../jobs/queue.interface'
import { UpdateFeedbackDto } from './dto/update-feedback.dto'

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(AnalysisFeedback)
    private feedbackRepo: Repository<AnalysisFeedback>,
    private projectsService: ProjectsService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
  ) {}

  async findAllByProject(
    projectId: number,
    auth0Id: string,
  ): Promise<AnalysisFeedback[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.feedbackRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: number): Promise<AnalysisFeedback> {
    const feedback = await this.feedbackRepo.findOne({ where: { id } })
    if (!feedback) throw new NotFoundException('Feedback non trouvé')
    return feedback
  }

  async update(id: number, dto: UpdateFeedbackDto): Promise<AnalysisFeedback> {
    const feedback = await this.findOne(id)
    Object.assign(feedback, dto)
    return this.feedbackRepo.save(feedback)
  }

  async remove(id: number): Promise<void> {
    const feedback = await this.findOne(id)
    await this.feedbackRepo.remove(feedback)
  }

  async queueExtraction(
    projectId: number,
    auth0Id: string,
  ): Promise<{ jobId: string }> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    const jobId = await this.queueService.send('feedback', { projectId })
    return { jobId }
  }
}
