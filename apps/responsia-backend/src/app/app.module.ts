import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { ConfigModule } from '../config/config.module'
import { DatabaseModule } from '../database/database.module'
import { AuthModule } from '../auth/auth.module'
import { AiModule } from '../ai/ai.module'
import { StorageModule } from '../storage/storage.module'
import { SearchModule } from '../search/search.module'
import { JobsModule } from '../jobs/jobs.module'
import { HealthModule } from '../health/health.module'
import { ProjectsModule } from '../projects/projects.module'
import { DocumentsModule } from '../documents/documents.module'
import { RequirementsModule } from '../requirements/requirements.module'
import { KnowledgeModule } from '../knowledge/knowledge.module'
import { FeedbackModule } from '../feedback/feedback.module'
import { SetupModule } from '../setup/setup.module'
import { ChatModule } from '../chat/chat.module'
import { ComplianceModule } from '../compliance/compliance.module'
import { ExportModule } from '../export/export.module'
import { SettingsModule } from '../settings/settings.module'
import { OutlineModule } from '../outline/outline.module'
import { ExtractionModule } from '../extraction/extraction.module'
import { DraftGroupsModule } from '../draft-groups/draft-groups.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    // Structured logging (pino)
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),

    // Global config with Joi validation
    ConfigModule,

    // PostgreSQL + pgvector + pg_trgm
    DatabaseModule,

    // Auth0 passport-jwt + dev bypass
    AuthModule,

    // AI (Anthropic + OpenAI direct SDKs)
    AiModule,

    // Azure Blob Storage
    StorageModule,

    // Azure AI Search + pgvector fallback
    SearchModule,

    // Job queue (Azure Service Bus / local)
    JobsModule,

    // Health check
    HealthModule,

    // Feature modules
    ProjectsModule,
    DocumentsModule,
    RequirementsModule,
    KnowledgeModule,
    FeedbackModule,
    SetupModule,
    ChatModule,
    ComplianceModule,
    ExportModule,
    SettingsModule,
    OutlineModule,
    ExtractionModule,
    DraftGroupsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
