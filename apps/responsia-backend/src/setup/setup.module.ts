import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Document } from '../database/entities/document.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { JobsModule } from '../jobs/jobs.module'
import { OutlineModule } from '../outline/outline.module'
import { ExtractionModule } from '../extraction/extraction.module'
import { SearchModule } from '../search/search.module'
import { IndexingProcessor } from './processors/indexing.processor'
import { FeedbackProcessor } from './processors/feedback.processor'
import { SetupController } from './setup.controller'
import { SetupService } from './setup.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      ExtractedItem,
      AnalysisFeedback,
      DocumentChunk,
      JobProgress,
    ]),
    AiModule,
    ProjectsModule,
    JobsModule,
    OutlineModule,
    ExtractionModule,
    SearchModule,
  ],
  controllers: [SetupController],
  providers: [
    SetupService,
    IndexingProcessor,
    FeedbackProcessor,
  ],
  exports: [SetupService],
})
export class SetupModule {}
