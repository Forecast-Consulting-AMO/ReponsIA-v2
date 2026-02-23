import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ChatMessage } from '../database/entities/chat-message.entity'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    @InjectRepository(ChatMessage)
    private chatRepo: Repository<ChatMessage>,
    @InjectRepository(DocumentChunk)
    private chunkRepo: Repository<DocumentChunk>,
    @InjectRepository(ExtractedItem)
    private itemRepo: Repository<ExtractedItem>,
    private aiService: AiService,
    private projectsService: ProjectsService,
  ) {}

  async findAllByProject(
    projectId: number,
    auth0Id: string,
  ): Promise<ChatMessage[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.chatRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    })
  }

  async saveUserMessage(
    projectId: number,
    auth0Id: string,
    content: string,
  ): Promise<ChatMessage> {
    return this.chatRepo.save(
      this.chatRepo.create({ projectId, auth0Id, role: 'user', content }),
    )
  }

  async saveAssistantMessage(
    projectId: number,
    auth0Id: string,
    content: string,
    editTarget?: { itemId: number; editDiff: { old: string; new: string } },
  ): Promise<ChatMessage> {
    return this.chatRepo.save(
      this.chatRepo.create({
        projectId,
        auth0Id,
        role: 'assistant',
        content,
        editTargetItemId: editTarget?.itemId,
        editDiff: editTarget?.editDiff,
      }),
    )
  }

  /** Get RAG context from knowledge base + extracted items summary */
  async getProjectContext(projectId: number, query: string): Promise<string> {
    const parts: string[] = []

    // 1. Extracted items summary — so the chat knows what the project is about
    try {
      const items = await this.itemRepo.find({
        where: { projectId },
        order: { sectionReference: 'ASC' },
      })
      if (items.length > 0) {
        const itemSummary = items
          .map((i) => {
            const status = i.status || 'pending'
            const hasResponse = i.responseText ? ' [has response]' : ''
            return `- ${i.sectionReference || '?'} [${i.kind}]: ${i.originalText?.substring(0, 200) || ''} (${status}${hasResponse})`
          })
          .join('\n')
        parts.push(`Elements extraits du projet (${items.length} au total):\n${itemSummary}`)
      }
    } catch {
      // Non-blocking
    }

    // 2. RAG from document chunks
    try {
      const embedding = await this.aiService.embed(query)
      const results = await this.chunkRepo.query(
        `
        SELECT dc.content,
          (1 - (dc.embedding <=> $1::vector)) * 0.6 +
          COALESCE(ts_rank(dc.search_vector, plainto_tsquery('french', $2)), 0) * 0.3 +
          COALESCE(similarity(dc.content, $2), 0) * 0.1 AS score
        FROM document_chunks dc
        WHERE dc.project_id = $3 AND dc.embedding IS NOT NULL
        ORDER BY score DESC LIMIT 5
      `,
        [JSON.stringify(embedding), query, projectId],
      )
      if (results.length > 0) {
        const ragContext = results
          .map((r: { content: string; score: number }) => `[${(r.score * 100).toFixed(0)}%] ${r.content}`)
          .join('\n\n---\n\n')
        parts.push(`Documents pertinents:\n${ragContext}`)
      }
    } catch {
      // Embedding may fail if no OpenAI key — still return items context
    }

    return parts.join('\n\n')
  }

  /** Get recent chat history as formatted string */
  async getChatHistory(projectId: number, limit = 20): Promise<string> {
    const messages = await this.chatRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
    })
    return messages
      .reverse()
      .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
      .join('\n\n')
  }

  /** Verify the caller has access to the project */
  async verifyAccess(projectId: number, auth0Id: string): Promise<void> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
  }

  /** Get an extracted item's current response text for edit suggestions */
  async getItemText(itemId: number): Promise<{ item: ExtractedItem }> {
    const item = await this.itemRepo.findOne({ where: { id: itemId } })
    if (!item) throw new Error('Extracted item not found')
    return { item }
  }
}
