import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { Project } from '../database/entities/project.entity'
import { Document } from '../database/entities/document.entity'
import { ProjectsModule } from '../projects/projects.module'
import { StorageModule } from '../storage/storage.module'
import { ExportController } from './export.controller'
import { ExportService } from './export.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([OutlineSection, DraftGroup, ExtractedItem, Project, Document]),
    ProjectsModule,
    StorageModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
