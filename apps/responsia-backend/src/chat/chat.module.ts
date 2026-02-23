import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatMessage } from '../database/entities/chat-message.entity'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, DocumentChunk, ExtractedItem]),
    AiModule,
    ProjectsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
