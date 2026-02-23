import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { AiService } from '../ai/ai.service'

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name)
  private searchClient: any = null
  private indexClient: any = null
  private useAzureSearch = false

  constructor(
    private config: ConfigService,
    @InjectRepository(DocumentChunk)
    private chunkRepo: Repository<DocumentChunk>,
    private aiService: AiService,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    const endpoint = this.config.get<string>('AZURE_SEARCH_ENDPOINT')
    const key = this.config.get<string>('AZURE_SEARCH_KEY')
    const indexName = this.config.get<string>('AZURE_SEARCH_INDEX')

    if (endpoint && key) {
      try {
        const { SearchClient, SearchIndexClient, AzureKeyCredential } =
          await import('@azure/search-documents')
        const credential = new AzureKeyCredential(key)
        this.searchClient = new SearchClient(endpoint, indexName!, credential)
        this.indexClient = new SearchIndexClient(endpoint, credential)
        this.useAzureSearch = true
        await this.ensureIndex(indexName!)
        this.logger.log('Azure AI Search initialized')
      } catch (err) {
        this.logger.warn(`Azure AI Search init failed, using pgvector fallback: ${err}`)
      }
    } else {
      this.logger.log('Azure AI Search not configured, using pgvector fallback')
    }
  }

  private async ensureIndex(indexName: string) {
    try {
      await this.indexClient.getIndex(indexName)
    } catch {
      // Index doesn't exist, create it
      await this.indexClient.createIndex({
        name: indexName,
        fields: [
          { name: 'id', type: 'Edm.String', key: true, filterable: true },
          { name: 'projectId', type: 'Edm.Int32', filterable: true },
          { name: 'documentId', type: 'Edm.Int32', filterable: true },
          { name: 'content', type: 'Edm.String', searchable: true },
          { name: 'sectionTitle', type: 'Edm.String', searchable: true },
        ],
      })
      this.logger.log(`Created Azure Search index: ${indexName}`)
    }
  }

  /** Index chunks into Azure AI Search (or just save locally for pgvector fallback) */
  async indexChunks(projectId: number, chunks: DocumentChunk[]): Promise<void> {
    if (!this.useAzureSearch) return // pgvector handles via DB triggers

    const documents = chunks.map((c) => ({
      id: String(c.id),
      projectId: c.projectId,
      documentId: c.documentId,
      content: c.content,
      sectionTitle: c.sectionTitle || '',
    }))

    // Upload in batches of 100
    for (let i = 0; i < documents.length; i += 100) {
      const batch = documents.slice(i, i + 100)
      await this.searchClient.uploadDocuments(batch)
    }
  }

  /** Search using Azure AI Search or pgvector fallback */
  async search(projectId: number, query: string, limit = 10): Promise<DocumentChunk[]> {
    if (this.useAzureSearch) {
      return this.azureSearch(projectId, query, limit)
    }
    return this.pgvectorSearch(projectId, query, limit)
  }

  private async azureSearch(projectId: number, query: string, limit: number): Promise<DocumentChunk[]> {
    const results = await this.searchClient.search(query, {
      filter: `projectId eq ${projectId}`,
      top: limit,
      queryType: 'semantic',
      semanticSearchOptions: { configurationName: 'default' },
    })

    const chunkIds: number[] = []
    for await (const result of results.results) {
      chunkIds.push(parseInt(result.document.id, 10))
    }

    if (chunkIds.length === 0) return []
    return this.chunkRepo.findByIds(chunkIds)
  }

  /** Fallback: existing pgvector + FTS + trigram hybrid search */
  private async pgvectorSearch(projectId: number, query: string, limit: number): Promise<DocumentChunk[]> {
    const chunkCount = await this.chunkRepo.count({ where: { projectId } })
    if (chunkCount === 0) return []

    try {
      const queryEmbedding = await this.aiService.embed(query)
      return this.chunkRepo.query(
        `SELECT dc.*,
          (1 - (dc.embedding <=> $1::vector)) * 0.6 +
          COALESCE(ts_rank(dc.search_vector, plainto_tsquery('french', $2)), 0) * 0.3 +
          COALESCE(similarity(dc.content, $2), 0) * 0.1 AS combined_score
        FROM document_chunks dc
        WHERE dc.project_id = $3 AND dc.embedding IS NOT NULL
        ORDER BY combined_score DESC
        LIMIT $4`,
        [JSON.stringify(queryEmbedding), query, projectId, limit],
      )
    } catch (err) {
      this.logger.warn(`pgvector search failed: ${err}`)
      return []
    }
  }

  /** Delete all indexed data for a project */
  async deleteProjectIndex(projectId: number): Promise<void> {
    if (!this.useAzureSearch) return

    // Find and delete all documents for this project
    const results = await this.searchClient.search('*', {
      filter: `projectId eq ${projectId}`,
      select: ['id'],
      top: 10000,
    })

    const ids: string[] = []
    for await (const result of results.results) {
      ids.push(result.document.id)
    }

    if (ids.length > 0) {
      await this.searchClient.deleteDocuments('id', ids)
    }
  }
}
