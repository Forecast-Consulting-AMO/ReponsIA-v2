import { Injectable, Inject, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'
import { QUEUE_SERVICE, QueueService } from '../jobs/queue.interface'

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name)

  constructor(
    @InjectRepository(DocumentChunk)
    private chunkRepo: Repository<DocumentChunk>,
    private aiService: AiService,
    private projectsService: ProjectsService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
  ) {}

  async findAllByProject(
    projectId: number,
    auth0Id: string,
  ): Promise<DocumentChunk[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.chunkRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    })
  }

  async queueIndexing(
    projectId: number,
    auth0Id: string,
  ): Promise<{ jobId: string }> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    const jobId = await this.queueService.send('indexing', { projectId })
    return { jobId }
  }

  /** Combined search: vector 60% + full-text 30% + trigram 10% */
  async search(
    projectId: number,
    auth0Id: string,
    query: string,
    limit = 10,
  ): Promise<DocumentChunk[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)

    const queryEmbedding = await this.aiService.embed(query)

    return this.chunkRepo.query(
      `
      SELECT dc.*,
        (1 - (dc.embedding <=> $1::vector)) * 0.6 +
        COALESCE(ts_rank(dc.search_vector, plainto_tsquery('french', $2)), 0) * 0.3 +
        COALESCE(similarity(dc.content, $2), 0) * 0.1 AS combined_score
      FROM document_chunks dc
      WHERE dc.project_id = $3
        AND dc.embedding IS NOT NULL
      ORDER BY combined_score DESC
      LIMIT $4
    `,
      [JSON.stringify(queryEmbedding), query, projectId, limit],
    )
  }
}
