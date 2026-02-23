import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { Document } from '../database/entities/document.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { OutlineController } from './outline.controller'
import { OutlineService } from './outline.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([OutlineSection, Document, JobProgress, DraftGroup]),
    AiModule,
    ProjectsModule,
  ],
  controllers: [OutlineController],
  providers: [OutlineService],
  exports: [OutlineService],
})
export class OutlineModule {}
