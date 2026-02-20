import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatMessage } from '../database/entities/chat-message.entity'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { Requirement } from '../database/entities/requirement.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, DocumentChunk, Requirement]),
    AiModule,
    ProjectsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
