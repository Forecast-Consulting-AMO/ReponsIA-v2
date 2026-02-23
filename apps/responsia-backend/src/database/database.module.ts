import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { Profile } from './entities/profile.entity'
import { Project } from './entities/project.entity'
import { Document } from './entities/document.entity'
import { OutlineSection } from './entities/outline-section.entity'
import { ExtractedItem } from './entities/extracted-item.entity'
import { DraftGroup } from './entities/draft-group.entity'
import { ResponseDraft } from './entities/response-draft.entity'
import { AnalysisFeedback } from './entities/feedback.entity'
import { ChatMessage } from './entities/chat-message.entity'
import { DocumentChunk } from './entities/document-chunk.entity'
import { ProjectMember } from './entities/project-member.entity'
import { JobProgress } from './entities/job-progress.entity'

const entities = [
  Profile,
  Project,
  Document,
  OutlineSection,
  ExtractedItem,
  DraftGroup,
  ResponseDraft,
  AnalysisFeedback,
  ChatMessage,
  DocumentChunk,
  ProjectMember,
  JobProgress,
]

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities,
        synchronize: true, // Dev only — use migrations in prod
        logging: config.get('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
      }),
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseModule.name)

  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      // Enable pgvector and pg_trgm extensions
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector')
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')

      // Add vector embedding column (not managed by TypeORM)
      await this.dataSource.query(
        'ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)',
      )
      // Add tsvector column for full-text search
      await this.dataSource.query(
        'ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector',
      )

      // Create indexes
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_embedding
        ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
      `)
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_search
        ON document_chunks USING gin (search_vector)
      `)
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_trgm
        ON document_chunks USING gin (content gin_trgm_ops)
      `)

      // Auto-update search_vector on insert/update
      await this.dataSource.query(`
        CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector := to_tsvector('french', COALESCE(NEW.content, ''));
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `)
      await this.dataSource.query(
        'DROP TRIGGER IF EXISTS trg_chunks_search_vector ON document_chunks',
      )
      await this.dataSource.query(`
        CREATE TRIGGER trg_chunks_search_vector
          BEFORE INSERT OR UPDATE OF content ON document_chunks
          FOR EACH ROW EXECUTE FUNCTION update_search_vector()
      `)

      this.logger.log('Database extensions and indexes initialized')
    } catch (err) {
      this.logger.warn('Could not initialize DB extensions (may not be Postgres):', err)
    }
  }
}
