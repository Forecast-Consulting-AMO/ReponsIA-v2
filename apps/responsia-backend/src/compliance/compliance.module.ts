import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Requirement } from '../database/entities/requirement.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { ComplianceController } from './compliance.controller'
import { ComplianceService } from './compliance.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Requirement, AnalysisFeedback]),
    AiModule,
    ProjectsModule,
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService],
})
export class ComplianceModule {}
