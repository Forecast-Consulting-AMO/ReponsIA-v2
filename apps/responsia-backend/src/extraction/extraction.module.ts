import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { Document } from '../database/entities/document.entity'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { ExtractionController } from './extraction.controller'
import { ExtractionService } from './extraction.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ExtractedItem, Document, OutlineSection, JobProgress]),
    AiModule,
    ProjectsModule,
  ],
  controllers: [ExtractionController],
  providers: [ExtractionService],
  exports: [ExtractionService],
})
export class ExtractionModule {}
