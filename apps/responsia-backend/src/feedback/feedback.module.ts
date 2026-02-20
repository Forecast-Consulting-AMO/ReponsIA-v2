import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { ProjectsModule } from '../projects/projects.module'
import { JobsModule } from '../jobs/jobs.module'
import { FeedbackController } from './feedback.controller'
import { FeedbackService } from './feedback.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisFeedback]),
    ProjectsModule,
    JobsModule,
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
