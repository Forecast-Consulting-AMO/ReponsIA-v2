import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Requirement } from '../database/entities/requirement.entity'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { JobsModule } from '../jobs/jobs.module'
import { RequirementsController } from './requirements.controller'
import { RequirementsService } from './requirements.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Requirement, DocumentChunk, AnalysisFeedback]),
    AiModule,
    ProjectsModule,
    JobsModule,
  ],
  controllers: [RequirementsController],
  providers: [RequirementsService],
  exports: [RequirementsService],
})
export class RequirementsModule {}
