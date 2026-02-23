import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { ResponseDraft } from '../database/entities/response-draft.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiModule } from '../ai/ai.module'
import { SearchModule } from '../search/search.module'
import { ProjectsModule } from '../projects/projects.module'
import { JobsModule } from '../jobs/jobs.module'
import { DraftGroupsController } from './draft-groups.controller'
import { DraftGroupsService } from './draft-groups.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DraftGroup,
      ExtractedItem,
      ResponseDraft,
      AnalysisFeedback,
      JobProgress,
    ]),
    AiModule,
    SearchModule,
    ProjectsModule,
    JobsModule,
  ],
  controllers: [DraftGroupsController],
  providers: [DraftGroupsService],
  exports: [DraftGroupsService],
})
export class DraftGroupsModule {}
