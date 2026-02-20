import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Requirement } from '../database/entities/requirement.entity'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'
import { QUEUE_SERVICE, QueueService } from '../jobs/queue.interface'
import { UpdateRequirementDto } from './dto/update-requirement.dto'

@Injectable()
export class RequirementsService {
  private readonly logger = new Logger(RequirementsService.name)

  constructor(
    @InjectRepository(Requirement)
    private requirementsRepo: Repository<Requirement>,
    @InjectRepository(DocumentChunk)
    private chunkRepo: Repository<DocumentChunk>,
    @InjectRepository(AnalysisFeedback)
    private feedbackRepo: Repository<AnalysisFeedback>,
    private aiService: AiService,
    private projectsService: ProjectsService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
  ) {}

  async findAllByProject(
    projectId: number,
    auth0Id: string,
  ): Promise<Requirement[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.requirementsRepo.find({
      where: { projectId },
      order: { sectionNumber: 'ASC' },
    })
  }

  async findOne(id: number): Promise<Requirement> {
    const req = await this.requirementsRepo.findOne({ where: { id } })
    if (!req) throw new NotFoundException('Exigence non trouvée')
    return req
  }

  async update(id: number, dto: UpdateRequirementDto): Promise<Requirement> {
    const req = await this.findOne(id)
    Object.assign(req, dto)
    return this.requirementsRepo.save(req)
  }

  async saveResponse(id: number, responseText: string): Promise<void> {
    await this.requirementsRepo.update(id, {
      responseText,
      responseStatus: 'drafted',
    })
  }

  /** Get RAG knowledge context for a requirement (vector + full-text + trigram) */
  async getKnowledgeContext(
    projectId: number,
    requirementText: string,
  ): Promise<string> {
    try {
      const queryEmbedding = await this.aiService.embed(requirementText)

      const results = await this.chunkRepo.query(
        `
        SELECT dc.content,
          (1 - (dc.embedding <=> $1::vector)) * 0.6 +
          COALESCE(ts_rank(dc.search_vector, plainto_tsquery('french', $2)), 0) * 0.3 +
          COALESCE(similarity(dc.content, $2), 0) * 0.1 AS combined_score
        FROM document_chunks dc
        WHERE dc.project_id = $3
          AND dc.embedding IS NOT NULL
        ORDER BY combined_score DESC
        LIMIT 5
      `,
        [JSON.stringify(queryEmbedding), requirementText, projectId],
      )

      if (results.length === 0) return ''

      return results
        .map(
          (r: { content: string; combined_score: number }) =>
            `[Pertinence: ${(r.combined_score * 100).toFixed(0)}%]\n${r.content}`,
        )
        .join('\n\n---\n\n')
    } catch (err) {
      this.logger.warn(`Knowledge context retrieval failed: ${err}`)
      return ''
    }
  }

  /** Get matched feedback for a requirement */
  async getMatchedFeedback(requirementId: number): Promise<AnalysisFeedback[]> {
    return this.feedbackRepo.find({
      where: { requirementId },
      order: { severity: 'ASC' },
    })
  }

  async queueAnalysis(
    projectId: number,
    auth0Id: string,
  ): Promise<{ jobId: string }> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    const jobId = await this.queueService.send('analysis', { projectId })
    return { jobId }
  }

  async queueDraftAll(
    projectId: number,
    auth0Id: string,
  ): Promise<{ jobId: string }> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    const jobId = await this.queueService.send('draft-all', { projectId })
    return { jobId }
  }
}
