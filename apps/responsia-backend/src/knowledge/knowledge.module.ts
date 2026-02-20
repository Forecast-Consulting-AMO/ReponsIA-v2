import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { JobsModule } from '../jobs/jobs.module'
import { KnowledgeController } from './knowledge.controller'
import { KnowledgeService } from './knowledge.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentChunk]),
    AiModule,
    ProjectsModule,
    JobsModule,
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
