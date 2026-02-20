import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Profile } from '../database/entities/profile.entity'
import { Project } from '../database/entities/project.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { SettingsController, ProjectSettingsController } from './settings.controller'
import { SettingsService } from './settings.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, Project]),
    AiModule,
    ProjectsModule,
  ],
  controllers: [SettingsController, ProjectSettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
