import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Requirement } from '../database/entities/requirement.entity'
import { Project } from '../database/entities/project.entity'
import { ProjectsModule } from '../projects/projects.module'
import { ExportController } from './export.controller'
import { ExportService } from './export.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Requirement, Project]),
    ProjectsModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
