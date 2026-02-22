import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ChatMessage } from '../database/entities/chat-message.entity'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { Requirement } from '../database/entities/requirement.entity'
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
    @InjectRepository(Requirement)
    private requirementsRepo: Repository<Requirement>,
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
    editTarget?: { requirementId: number; editDiff: { old: string; new: string } },
  ): Promise<ChatMessage> {
    return this.chatRepo.save(
      this.chatRepo.create({
        projectId,
        auth0Id,
        role: 'assistant',
        content,
        editTargetRequirementId: editTarget?.requirementId,
        editDiff: editTarget?.editDiff,
      }),
    )
  }

  /** Get RAG context from knowledge base + requirements summary */
  async getProjectContext(projectId: number, query: string): Promise<string> {
    const parts: string[] = []

    // 1. Requirements summary — so the chat knows what the project is about
    try {
      const requirements = await this.requirementsRepo.find({
        where: { projectId },
        order: { sectionNumber: 'ASC' },
      })
      if (requirements.length > 0) {
        const reqSummary = requirements
          .map((r) => {
            const status = r.responseStatus || 'pending'
            const hasResponse = r.responseText ? ' [has response]' : ''
            return `- ${r.sectionNumber || '?'} ${r.sectionTitle || ''}: ${r.requirementText?.substring(0, 200) || ''} (${status}${hasResponse})`
          })
          .join('\n')
        parts.push(`Exigences du projet (${requirements.length} au total):\n${reqSummary}`)
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
      // Embedding may fail if no OpenAI key — still return requirements context
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

  /** Get a requirement's current response text for edit suggestions */
  async getRequirementText(requirementId: number): Promise<{ requirement: Requirement }> {
    const req = await this.requirementsRepo.findOne({ where: { id: requirementId } })
    if (!req) throw new Error('Requirement not found')
    return { requirement: req }
  }
}
