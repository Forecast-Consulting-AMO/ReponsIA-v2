import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { AiModule } from '../ai/ai.module'
import { SearchService } from './search.service'

@Module({
  imports: [TypeOrmModule.forFeature([DocumentChunk]), AiModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
