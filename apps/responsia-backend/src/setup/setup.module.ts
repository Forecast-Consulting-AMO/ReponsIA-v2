import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Document } from '../database/entities/document.entity'
import { Requirement } from '../database/entities/requirement.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { JobsModule } from '../jobs/jobs.module'
import { RequirementsModule } from '../requirements/requirements.module'
import { AnalysisProcessor } from './processors/analysis.processor'
import { IndexingProcessor } from './processors/indexing.processor'
import { FeedbackProcessor } from './processors/feedback.processor'
import { DraftAllProcessor } from './processors/draft-all.processor'
import { SetupController } from './setup.controller'
import { SetupService } from './setup.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      Requirement,
      AnalysisFeedback,
      DocumentChunk,
      JobProgress,
    ]),
    AiModule,
    ProjectsModule,
    JobsModule,
    RequirementsModule,
  ],
  controllers: [SetupController],
  providers: [
    SetupService,
    AnalysisProcessor,
    IndexingProcessor,
    FeedbackProcessor,
    DraftAllProcessor,
  ],
  exports: [SetupService],
})
export class SetupModule {}
