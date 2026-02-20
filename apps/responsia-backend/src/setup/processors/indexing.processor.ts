import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { Document } from '../../database/entities/document.entity'
import { DocumentChunk } from '../../database/entities/document-chunk.entity'
import { JobProgress } from '../../database/entities/job-progress.entity'
import { AiService } from '../../ai/ai.service'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200

@Injectable()
export class IndexingProcessor {
  private readonly logger = new Logger(IndexingProcessor.name)

  constructor(
    @InjectRepository(Document)
    private documentsRepo: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private chunkRepo: Repository<DocumentChunk>,
    @InjectRepository(JobProgress)
    private jobProgressRepo: Repository<JobProgress>,
    private aiService: AiService,
    private dataSource: DataSource,
  ) {}

  /** Chunk and embed knowledge-base documents (past_submission + reference) */
  async process(projectId: number): Promise<void> {
    const job = this.jobProgressRepo.create({
      projectId,
      jobType: 'indexing',
      status: 'processing',
      progress: 0,
      message: 'Indexation des documents...',
    })
    await this.jobProgressRepo.save(job)

    try {
      const docs = await this.documentsRepo.find({
        where: [
          { projectId, fileType: 'past_submission' },
          { projectId, fileType: 'reference' },
        ],
      })

      if (docs.length === 0) {
        job.status = 'completed'
        job.progress = 100
        job.message = 'Aucun document de connaissance trouvé'
        job.completedAt = new Date()
        await this.jobProgressRepo.save(job)
        return
      }

      // Clear existing chunks for this project (re-index)
      await this.chunkRepo.delete({ projectId })

      let totalChunks = 0

      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        job.progress = Math.round((i / docs.length) * 80)
        job.message = `Chunking ${doc.filename}...`
        await this.jobProgressRepo.save(job)

        if (!doc.extractedText) continue

        const chunks = this.splitIntoChunks(doc.extractedText)

        for (const chunk of chunks) {
          const saved = await this.chunkRepo.save(
            this.chunkRepo.create({
              projectId,
              documentId: doc.id,
              content: chunk.text,
              sectionTitle: doc.filename,
              startChar: chunk.start,
              endChar: chunk.end,
            }),
          )
          totalChunks++
        }
      }

      // Embed all chunks in batches
      job.progress = 80
      job.message = `Embedding ${totalChunks} chunks...`
      await this.jobProgressRepo.save(job)

      const allChunks = await this.chunkRepo.find({ where: { projectId } })
      const batchSize = 20

      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize)
        const texts = batch.map((c) => c.content)

        try {
          const embeddings = await this.aiService.embedMany(texts)

          for (let j = 0; j < batch.length; j++) {
            await this.dataSource.query(
              'UPDATE document_chunks SET embedding = $1::vector WHERE id = $2',
              [JSON.stringify(embeddings[j]), batch[j].id],
            )
          }
        } catch (err) {
          this.logger.warn(`Embedding batch failed (chunk ${i}): ${err}`)
        }

        job.progress = 80 + Math.round((i / allChunks.length) * 20)
        await this.jobProgressRepo.save(job)
      }

      job.status = 'completed'
      job.progress = 100
      job.message = `${totalChunks} chunks indexés`
      job.completedAt = new Date()
      await this.jobProgressRepo.save(job)
    } catch (err: any) {
      job.status = 'error'
      job.errorMessage = err.message
      job.completedAt = new Date()
      await this.jobProgressRepo.save(job)
      throw err
    }
  }

  private splitIntoChunks(
    text: string,
  ): { text: string; start: number; end: number }[] {
    const chunks: { text: string; start: number; end: number }[] = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE, text.length)
      chunks.push({ text: text.slice(start, end), start, end })
      start += CHUNK_SIZE - CHUNK_OVERLAP
    }

    return chunks
  }
}
