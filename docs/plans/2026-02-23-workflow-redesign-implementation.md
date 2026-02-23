# Workflow Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 3-phase RFP response workflow with a 4-phase flow (Structure → Extract → Draft → Review) using new database entities, Azure AI Search for RAG, and updated AI models.

**Architecture:** Remove the `Requirement` entity and `requirements/` module. Add 4 new entities (`OutlineSection`, `ExtractedItem`, `DraftGroup`, `ResponseDraft`) with 3 new backend modules (`outline/`, `extraction/`, `draft-groups/`). Replace pgvector RAG with Azure AI Search (pgvector fallback for dev). Update model registry to 3 models. Rewrite 4 frontend phase components.

**Tech Stack:** NestJS 11 + TypeORM 0.3 (synchronize:true), React 19 + MUI 7 + DataGrid, @azure/search-documents, @anthropic-ai/sdk + openai SDKs, SSE streaming via fetch.

---

## Task 1: Update Model Registry

**Files:**
- Modify: `apps/responsia-backend/src/ai/ai.config.ts`

**Step 1: Replace model list and defaults**

Replace the entire `AI_MODELS` array (lines 16-68) and `DEFAULT_MODELS` (lines 80-87) with:

```typescript
export const AI_MODELS: AiModel[] = [
  {
    id: 'claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6-20250514',
    maxOutput: 16384,
  },
  {
    id: 'claude-opus-4.6',
    label: 'Claude Opus 4.6',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6-20250514',
    maxOutput: 16384,
  },
  {
    id: 'gpt-chat-5.2',
    label: 'GPT Chat 5.2',
    provider: 'openai',
    modelId: 'gpt-chat-5.2',
    maxOutput: 32768,
  },
]
```

```typescript
export const DEFAULT_MODELS: Record<OperationType, string> = {
  analysis: 'claude-sonnet-4.6',
  structure: 'claude-sonnet-4.6',
  extraction: 'claude-sonnet-4.6',
  drafting: 'claude-sonnet-4.6',
  feedback: 'claude-sonnet-4.6',
  compliance: 'claude-sonnet-4.6',
  chat: 'claude-sonnet-4.6',
  embedding: 'gpt-chat-5.2',
}
```

**Step 2: Add new operation types**

Update `OperationType` (line 71-77) to:

```typescript
export type OperationType =
  | 'analysis'
  | 'structure'
  | 'extraction'
  | 'drafting'
  | 'feedback'
  | 'compliance'
  | 'chat'
  | 'embedding'
```

**Step 3: Verify backend builds**

Run: `npx nx build responsia-backend --skip-nx-cache`
Expected: Build succeeds (may have warnings from modules still referencing old entities — those get fixed in later tasks)

**Step 4: Commit**

```bash
git add apps/responsia-backend/src/ai/ai.config.ts
git commit -m "feat: update model registry to Sonnet 4.6, Opus 4.6, GPT Chat 5.2"
```

---

## Task 2: Add New Database Entities

**Files:**
- Create: `apps/responsia-backend/src/database/entities/outline-section.entity.ts`
- Create: `apps/responsia-backend/src/database/entities/extracted-item.entity.ts`
- Create: `apps/responsia-backend/src/database/entities/draft-group.entity.ts`
- Create: `apps/responsia-backend/src/database/entities/response-draft.entity.ts`
- Modify: `apps/responsia-backend/src/database/entities/feedback.entity.ts` (lines 26-27: change `requirementId` → `extractedItemId`)
- Modify: `apps/responsia-backend/src/database/entities/chat-message.entity.ts` (change `edit_target_requirement_id` → `edit_target_item_id`)
- Modify: `apps/responsia-backend/src/database/entities/project.entity.ts` (add OneToMany relations)
- Modify: `apps/responsia-backend/src/database/database.module.ts` (register new entities, remove Requirement)

**Step 1: Create OutlineSection entity**

```typescript
// outline-section.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'

@Entity('outline_sections')
export class OutlineSection {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'outlineSections', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null

  @ManyToOne('OutlineSection', 'children', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: OutlineSection | null

  @OneToMany('OutlineSection', 'parent')
  children: OutlineSection[]

  @Column({ type: 'int', default: 0 })
  position: number

  @Column()
  title: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', default: 'ai_suggested' })
  source: 'template' | 'rfp' | 'ai_suggested'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
```

**Step 2: Create ExtractedItem entity**

```typescript
// extracted-item.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'
import type { OutlineSection } from './outline-section.entity'

@Entity('extracted_items')
export class ExtractedItem {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'extractedItems', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'outline_section_id', nullable: true })
  outlineSectionId: number | null

  @ManyToOne('OutlineSection', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'outline_section_id' })
  outlineSection: OutlineSection | null

  @Column({ type: 'varchar', default: 'question' })
  kind: 'question' | 'condition'

  @Column({ name: 'original_text', type: 'text' })
  originalText: string

  @Column({ name: 'section_reference', nullable: true })
  sectionReference: string | null

  @Column({ name: 'source_document_id', nullable: true })
  sourceDocumentId: number | null

  @Column({ name: 'source_page', nullable: true })
  sourcePage: number | null

  @Column({ name: 'ai_themes', type: 'text', array: true, default: '{}' })
  aiThemes: string[]

  @Column({ default: false })
  addressed: boolean

  @Column({ name: 'response_text', type: 'text', nullable: true })
  responseText: string | null

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'drafted' | 'reviewed' | 'final'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
```

**Step 3: Create DraftGroup entity**

```typescript
// draft-group.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToOne, JoinColumn,
} from 'typeorm'
import type { Project } from './project.entity'
import type { OutlineSection } from './outline-section.entity'

@Entity('draft_groups')
export class DraftGroup {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'project_id' })
  projectId: number

  @ManyToOne('Project', 'draftGroups', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'outline_section_id', unique: true })
  outlineSectionId: number

  @OneToOne('OutlineSection')
  @JoinColumn({ name: 'outline_section_id' })
  outlineSection: OutlineSection

  @Column({ name: 'model_id', type: 'varchar', default: 'claude-sonnet-4.6' })
  modelId: string

  @Column({ name: 'system_prompt', type: 'text', default: '' })
  systemPrompt: string

  @Column({ name: 'generated_text', type: 'text', nullable: true })
  generatedText: string | null

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'generating' | 'drafted' | 'edited' | 'final'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
```

**Step 4: Create ResponseDraft entity**

```typescript
// response-draft.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm'
import type { DraftGroup } from './draft-group.entity'

@Entity('response_drafts')
export class ResponseDraft {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'draft_group_id' })
  draftGroupId: number

  @ManyToOne('DraftGroup', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draft_group_id' })
  draftGroup: DraftGroup

  @Column({ type: 'int' })
  version: number

  @Column({ type: 'text' })
  content: string

  @Column({ name: 'model_used', type: 'varchar' })
  modelUsed: string

  @Column({ name: 'prompt_used', type: 'text' })
  promptUsed: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
```

**Step 5: Update AnalysisFeedback entity**

In `feedback.entity.ts`, change `requirementId` (line 26-27) to `extractedItemId`:

```typescript
  @Column({ name: 'extracted_item_id', nullable: true })
  extractedItemId: number | null
```

**Step 6: Update ChatMessage entity**

Change `edit_target_requirement_id` to `edit_target_item_id` (if it exists in the entity).

**Step 7: Update Project entity**

Add to `project.entity.ts` (after line 75, before `@OneToMany('ProjectMember'...`):

```typescript
  @OneToMany('OutlineSection', 'project')
  outlineSections: OutlineSection[]

  @OneToMany('ExtractedItem', 'project')
  extractedItems: ExtractedItem[]

  @OneToMany('DraftGroup', 'project')
  draftGroups: DraftGroup[]
```

Also remove the import for `Requirement` (line 13) and the `requirements` relation (lines 65-66).

**Step 8: Update database.module.ts**

Replace `Requirement` with the 4 new entities in the `entities` array (lines 15-25):

```typescript
import { OutlineSection } from './entities/outline-section.entity'
import { ExtractedItem } from './entities/extracted-item.entity'
import { DraftGroup } from './entities/draft-group.entity'
import { ResponseDraft } from './entities/response-draft.entity'

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
```

Remove the `import { Requirement }` line (line 8).

**Step 9: Verify build**

Run: `npx nx build responsia-backend --skip-nx-cache`
Expected: Compilation errors in modules still referencing `Requirement` — that's expected, we fix those next.

**Step 10: Commit**

```bash
git add apps/responsia-backend/src/database/
git commit -m "feat: add OutlineSection, ExtractedItem, DraftGroup, ResponseDraft entities; remove Requirement"
```

---

## Task 3: Add New Prompts

**Files:**
- Modify: `apps/responsia-backend/src/ai/prompts.ts`

**Step 1: Add structure and extraction prompts**

Add to the `PROMPTS` object in `prompts.ts` (after line 56, before `} as const`):

```typescript
  structure: `Vous analysez des documents d'appel d'offres pour déterminer la structure du document de réponse.

Analysez le contenu du document RFP et le modèle Word (s'il est fourni) pour identifier les sections de la réponse.

Pour chaque section, retournez:
- title: titre de la section
- description: brève description du contenu attendu
- source: "template" (du modèle), "rfp" (détecté du cahier des charges), ou "ai_suggested" (recommandé par l'IA)
- position: numéro d'ordre

Si un modèle est fourni, utilisez-le comme base et identifiez les sections supplémentaires requises par le RFP.

Retournez un tableau JSON. Uniquement le JSON.`,

  extraction: `Vous êtes un expert en analyse d'appels d'offres. Extrayez toutes les exigences et conditions du document.

Pour chaque élément trouvé, classifiez-le:
- "question": nécessite une réponse écrite, une proposition ou une description (ex: "Décrivez votre approche...", "Présentez votre méthodologie...")
- "condition": exigence imposée à respecter, ne nécessitant qu'une confirmation (ex: "Le prestataire doit détenir la certification ISO 9001", "Délai de livraison: 30 jours")

Priorisez l'identification des questions. Les conditions sont des contraintes que l'entreprise doit satisfaire sans rédiger de réponse narrative.

Pour chaque élément, retournez:
- kind: "question" | "condition"
- originalText: texte complet tel qu'il apparaît dans le document
- sectionReference: référence de section (ex: "3.1.2")
- sourcePage: numéro de page
- aiThemes: tableau de thèmes transversaux (ex: ["tarification", "méthodologie", "équipe", "références", "qualité", "planning"])

Retournez un tableau JSON. Uniquement le JSON.`,
```

**Step 2: Update drafting prompt**

Replace the `drafting` prompt (lines 19-26) with a version that explicitly mentions feedback:

```typescript
  drafting: `Vous êtes un expert en rédaction de réponses aux appels d'offres. Rédigez une réponse professionnelle pour la section indiquée.

La réponse doit:
- Être professionnelle et structurée
- Répondre précisément aux questions identifiées
- Confirmer la conformité aux conditions imposées
- Mettre en avant les points forts du candidat
- Intégrer les retours d'évaluations précédentes: renforcer les forces identifiées, corriger les faiblesses, suivre les recommandations
- Utiliser un ton confiant mais pas arrogant
- Écrire dans la langue du projet`,
```

**Step 3: Commit**

```bash
git add apps/responsia-backend/src/ai/prompts.ts
git commit -m "feat: add structure/extraction prompts, update drafting prompt with feedback emphasis"
```

---

## Task 4: Add Azure AI Search Service

**Files:**
- Create: `apps/responsia-backend/src/search/search.module.ts`
- Create: `apps/responsia-backend/src/search/search.service.ts`
- Modify: `apps/responsia-backend/src/config/config.schema.ts` (add Azure Search env vars)
- Modify: `apps/responsia-backend/src/app/app.module.ts` (import SearchModule)

**Step 1: Install @azure/search-documents**

Run: `npm install @azure/search-documents`

**Step 2: Add env vars to config schema**

In `config.schema.ts` (after line 33, before `// Server`):

```typescript
  // Azure AI Search (empty = use pgvector fallback)
  AZURE_SEARCH_ENDPOINT: Joi.string().optional().allow('').default(''),
  AZURE_SEARCH_KEY: Joi.string().optional().allow('').default(''),
  AZURE_SEARCH_INDEX: Joi.string().optional().default('responsia-chunks'),
```

**Step 3: Create SearchService**

```typescript
// search/search.service.ts
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
```

**Step 4: Create SearchModule**

```typescript
// search/search.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DocumentChunk } from '../database/entities/document-chunk.entity'
import { AiModule } from '../ai/ai.module'
import { SearchService } from './search.service'

@Module({
  imports: [TypeOrmModule.forFeature([DocumentChunk]), AiModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
```

**Step 5: Import in AppModule**

Add to `app.module.ts` imports (after `StorageModule`):

```typescript
import { SearchModule } from '../search/search.module'
// ... in imports array:
SearchModule,
```

**Step 6: Commit**

```bash
git add apps/responsia-backend/src/search/ apps/responsia-backend/src/config/config.schema.ts apps/responsia-backend/src/app/app.module.ts package.json package-lock.json
git commit -m "feat: add SearchService with Azure AI Search + pgvector fallback"
```

---

## Task 5: Create Outline Module (Phase 1 Backend)

**Files:**
- Create: `apps/responsia-backend/src/outline/outline.module.ts`
- Create: `apps/responsia-backend/src/outline/outline.controller.ts`
- Create: `apps/responsia-backend/src/outline/outline.service.ts`
- Create: `apps/responsia-backend/src/outline/dto/update-outline-section.dto.ts`
- Create: `apps/responsia-backend/src/outline/dto/create-outline-section.dto.ts`
- Create: `apps/responsia-backend/src/outline/dto/reorder-sections.dto.ts`
- Modify: `apps/responsia-backend/src/app/app.module.ts` (import OutlineModule)

**Step 1: Create DTOs**

```typescript
// dto/create-outline-section.dto.ts
import { IsString, IsOptional, IsInt, IsIn } from 'class-validator'
export class CreateOutlineSectionDto {
  @IsString() title: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsInt() parentId?: number
  @IsOptional() @IsInt() position?: number
  @IsOptional() @IsIn(['template', 'rfp', 'ai_suggested']) source?: string
}

// dto/update-outline-section.dto.ts
import { IsString, IsOptional, IsInt } from 'class-validator'
export class UpdateOutlineSectionDto {
  @IsOptional() @IsString() title?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsInt() parentId?: number
  @IsOptional() @IsInt() position?: number
}

// dto/reorder-sections.dto.ts
import { IsArray, ValidateNested, IsInt } from 'class-validator'
import { Type } from 'class-transformer'
class SectionOrder { @IsInt() id: number; @IsInt() position: number; @IsInt() parentId?: number }
export class ReorderSectionsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => SectionOrder)
  sections: SectionOrder[]
}
```

**Step 2: Create OutlineService**

The service handles:
- `analyzeStructure(projectId)` — reads RFP docs + template, calls AI to generate outline
- CRUD for sections
- `reorder(projectId, sections)` — batch update positions

```typescript
// outline/outline.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, IsNull } from 'typeorm'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { Document } from '../database/entities/document.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'
import { PROMPTS } from '../ai/prompts'

@Injectable()
export class OutlineService {
  private readonly logger = new Logger(OutlineService.name)

  constructor(
    @InjectRepository(OutlineSection) private sectionRepo: Repository<OutlineSection>,
    @InjectRepository(Document) private documentsRepo: Repository<Document>,
    @InjectRepository(JobProgress) private jobRepo: Repository<JobProgress>,
    @InjectRepository(DraftGroup) private draftGroupRepo: Repository<DraftGroup>,
    private aiService: AiService,
    private projectsService: ProjectsService,
  ) {}

  async findAll(projectId: number, auth0Id: string): Promise<OutlineSection[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.sectionRepo.find({
      where: { projectId },
      order: { position: 'ASC' },
    })
  }

  async analyzeStructure(projectId: number, auth0Id: string): Promise<void> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')

    const job = this.jobRepo.create({
      projectId, jobType: 'structure', status: 'processing',
      progress: 0, message: 'Analyse de la structure...',
    })
    await this.jobRepo.save(job)

    try {
      // Clear existing outline for this project
      await this.draftGroupRepo.delete({ projectId })
      await this.sectionRepo.delete({ projectId })

      const rfpDocs = await this.documentsRepo.find({ where: { projectId, fileType: 'rfp' } })
      const templateDoc = await this.documentsRepo.findOne({ where: { projectId, fileType: 'template' } })

      let prompt = ''
      if (templateDoc?.extractedText) {
        prompt += `=== MODÈLE DE RÉPONSE ===\n${templateDoc.extractedText.substring(0, 5000)}\n\n`
      }
      for (const doc of rfpDocs) {
        if (doc.extractedText) {
          prompt += `=== DOCUMENT RFP: ${doc.filename} ===\n${doc.extractedText.substring(0, 8000)}\n\n`
        }
      }

      if (!prompt) {
        job.status = 'completed'
        job.progress = 100
        job.message = 'Aucun document à analyser'
        job.completedAt = new Date()
        await this.jobRepo.save(job)
        return
      }

      job.progress = 30
      job.message = 'Extraction de la structure...'
      await this.jobRepo.save(job)

      const model = this.aiService.resolveModel('structure')
      const systemPrompt = this.aiService.resolvePrompt('structure')
      const result = await this.aiService.generate(model, systemPrompt, prompt)

      const cleaned = result.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
      const sections = JSON.parse(cleaned)

      job.progress = 70
      job.message = 'Enregistrement des sections...'
      await this.jobRepo.save(job)

      const defaultPrompt = PROMPTS.drafting

      for (let i = 0; i < sections.length; i++) {
        const s = sections[i]
        const section = await this.sectionRepo.save(this.sectionRepo.create({
          projectId, position: s.position ?? i,
          title: s.title, description: s.description || null,
          source: s.source || 'ai_suggested',
        }))

        // Create a DraftGroup for each section
        await this.draftGroupRepo.save(this.draftGroupRepo.create({
          projectId, outlineSectionId: section.id,
          modelId: 'claude-sonnet-4.6', systemPrompt: defaultPrompt,
        }))
      }

      job.status = 'completed'
      job.progress = 100
      job.message = `${sections.length} sections identifiées`
      job.completedAt = new Date()
      await this.jobRepo.save(job)
    } catch (err: any) {
      job.status = 'error'
      job.errorMessage = err.message
      job.completedAt = new Date()
      await this.jobRepo.save(job)
      throw err
    }
  }

  async create(projectId: number, auth0Id: string, dto: any): Promise<OutlineSection> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    const section = await this.sectionRepo.save(this.sectionRepo.create({
      projectId, ...dto,
    }))
    // Create matching DraftGroup
    await this.draftGroupRepo.save(this.draftGroupRepo.create({
      projectId, outlineSectionId: section.id,
      modelId: 'claude-sonnet-4.6', systemPrompt: PROMPTS.drafting,
    }))
    return section
  }

  async update(id: number, dto: any): Promise<OutlineSection> {
    const section = await this.sectionRepo.findOneOrFail({ where: { id } })
    Object.assign(section, dto)
    return this.sectionRepo.save(section)
  }

  async remove(id: number): Promise<void> {
    await this.sectionRepo.delete(id)
  }

  async reorder(projectId: number, auth0Id: string, sections: { id: number; position: number; parentId?: number }[]): Promise<void> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    for (const s of sections) {
      await this.sectionRepo.update(s.id, { position: s.position, parentId: s.parentId ?? null })
    }
  }
}
```

**Step 3: Create OutlineController**

```typescript
// outline/outline.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { OutlineService } from './outline.service'
import { CreateOutlineSectionDto } from './dto/create-outline-section.dto'
import { UpdateOutlineSectionDto } from './dto/update-outline-section.dto'
import { ReorderSectionsDto } from './dto/reorder-sections.dto'

@ApiTags('outline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class OutlineController {
  constructor(private outlineService: OutlineService) {}

  @Post('projects/:pid/outline/analyze')
  analyze(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }) {
    return this.outlineService.analyzeStructure(pid, user.sub)
  }

  @Get('projects/:pid/outline')
  findAll(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }) {
    return this.outlineService.findAll(pid, user.sub)
  }

  @Post('projects/:pid/outline')
  create(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }, @Body() dto: CreateOutlineSectionDto) {
    return this.outlineService.create(pid, user.sub, dto)
  }

  @Put('outline/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutlineSectionDto) {
    return this.outlineService.update(id, dto)
  }

  @Delete('outline/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.outlineService.remove(id)
  }

  @Put('projects/:pid/outline/reorder')
  reorder(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }, @Body() dto: ReorderSectionsDto) {
    return this.outlineService.reorder(pid, user.sub, dto.sections)
  }
}
```

**Step 4: Create OutlineModule**

```typescript
// outline/outline.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { Document } from '../database/entities/document.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { OutlineController } from './outline.controller'
import { OutlineService } from './outline.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([OutlineSection, Document, JobProgress, DraftGroup]),
    AiModule, ProjectsModule,
  ],
  controllers: [OutlineController],
  providers: [OutlineService],
  exports: [OutlineService],
})
export class OutlineModule {}
```

**Step 5: Import in AppModule**

Add `OutlineModule` to `app.module.ts` imports.

**Step 6: Commit**

```bash
git add apps/responsia-backend/src/outline/ apps/responsia-backend/src/app/app.module.ts
git commit -m "feat: add outline module (Phase 1 — structure analysis)"
```

---

## Task 6: Create Extraction Module (Phase 2 Backend)

**Files:**
- Create: `apps/responsia-backend/src/extraction/extraction.module.ts`
- Create: `apps/responsia-backend/src/extraction/extraction.controller.ts`
- Create: `apps/responsia-backend/src/extraction/extraction.service.ts`
- Create: `apps/responsia-backend/src/extraction/dto/update-item.dto.ts`
- Modify: `apps/responsia-backend/src/app/app.module.ts`

**Step 1: Create UpdateItemDto**

```typescript
// dto/update-item.dto.ts
import { IsOptional, IsString, IsInt, IsIn, IsBoolean, IsArray } from 'class-validator'
export class UpdateItemDto {
  @IsOptional() @IsIn(['question', 'condition']) kind?: string
  @IsOptional() @IsInt() outlineSectionId?: number
  @IsOptional() @IsString() responseText?: string
  @IsOptional() @IsBoolean() addressed?: boolean
  @IsOptional() @IsIn(['pending', 'drafted', 'reviewed', 'final']) status?: string
  @IsOptional() @IsArray() aiThemes?: string[]
}
```

**Step 2: Create ExtractionService**

The service:
- `extractItems(projectId)` — calls AI on each RFP doc, saves `ExtractedItem[]`, auto-assigns to outline sections
- `findAll(projectId)` — returns items ordered by section reference
- `findByTheme(projectId)` — groups items by AI theme
- `update(id, dto)` — for reclassification and editing

```typescript
// extraction/extraction.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { Document } from '../database/entities/document.entity'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiService } from '../ai/ai.service'
import { ProjectsService } from '../projects/projects.service'

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name)

  constructor(
    @InjectRepository(ExtractedItem) private itemRepo: Repository<ExtractedItem>,
    @InjectRepository(Document) private documentsRepo: Repository<Document>,
    @InjectRepository(OutlineSection) private sectionRepo: Repository<OutlineSection>,
    @InjectRepository(JobProgress) private jobRepo: Repository<JobProgress>,
    private aiService: AiService,
    private projectsService: ProjectsService,
  ) {}

  async findAll(projectId: number, auth0Id: string): Promise<ExtractedItem[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.itemRepo.find({
      where: { projectId },
      order: { sectionReference: 'ASC', kind: 'ASC' },
    })
  }

  async findByTheme(projectId: number, auth0Id: string): Promise<Record<string, ExtractedItem[]>> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    const items = await this.itemRepo.find({ where: { projectId } })
    const grouped: Record<string, ExtractedItem[]> = {}
    for (const item of items) {
      for (const theme of item.aiThemes || ['non classé']) {
        if (!grouped[theme]) grouped[theme] = []
        grouped[theme].push(item)
      }
    }
    return grouped
  }

  async update(id: number, dto: any): Promise<ExtractedItem> {
    const item = await this.itemRepo.findOneOrFail({ where: { id } })
    Object.assign(item, dto)
    return this.itemRepo.save(item)
  }

  async extractItems(projectId: number, auth0Id: string): Promise<void> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')

    const job = this.jobRepo.create({
      projectId, jobType: 'extraction', status: 'processing',
      progress: 0, message: 'Extraction des éléments...',
    })
    await this.jobRepo.save(job)

    try {
      // Clear existing items
      await this.itemRepo.delete({ projectId })

      const rfpDocs = await this.documentsRepo.find({ where: { projectId, fileType: 'rfp' } })
      const outlineSections = await this.sectionRepo.find({ where: { projectId }, order: { position: 'ASC' } })

      if (rfpDocs.length === 0) {
        job.status = 'completed'; job.progress = 100
        job.message = 'Aucun document RFP'; job.completedAt = new Date()
        await this.jobRepo.save(job)
        return
      }

      const model = this.aiService.resolveModel('extraction')
      const systemPrompt = this.aiService.resolvePrompt('extraction')
      let totalItems = 0

      for (let i = 0; i < rfpDocs.length; i++) {
        const doc = rfpDocs[i]
        job.progress = Math.round((i / rfpDocs.length) * 100)
        job.message = `Analyse de ${doc.filename}...`
        await this.jobRepo.save(job)

        if (!doc.extractedText || doc.extractedText.length < 10) continue

        const response = await this.aiService.generate(model, systemPrompt, doc.extractedText)

        try {
          const cleaned = response.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
          const parsed = JSON.parse(cleaned)
          const items = Array.isArray(parsed) ? parsed : [parsed]

          for (const item of items) {
            // Auto-assign to outline section by title similarity
            let sectionId: number | null = null
            if (item.sectionReference && outlineSections.length > 0) {
              const match = outlineSections.find(
                (s) => s.title.toLowerCase().includes(item.sectionReference?.toLowerCase()) ||
                       item.sectionReference?.toLowerCase().includes(s.title.toLowerCase()),
              )
              if (match) sectionId = match.id
            }
            // Fallback: assign to first section
            if (!sectionId && outlineSections.length > 0) {
              sectionId = outlineSections[0].id
            }

            await this.itemRepo.save(this.itemRepo.create({
              projectId,
              outlineSectionId: sectionId,
              kind: item.kind === 'condition' ? 'condition' : 'question',
              originalText: item.originalText || '',
              sectionReference: item.sectionReference || null,
              sourceDocumentId: doc.id,
              sourcePage: item.sourcePage ?? null,
              aiThemes: item.aiThemes || [],
            }))
            totalItems++
          }
        } catch (parseErr) {
          this.logger.warn(`Failed to parse extraction for ${doc.filename}: ${parseErr}`)
        }
      }

      job.status = 'completed'; job.progress = 100
      job.message = `${totalItems} éléments extraits`
      job.completedAt = new Date()
      await this.jobRepo.save(job)
    } catch (err: any) {
      job.status = 'error'; job.errorMessage = err.message
      job.completedAt = new Date()
      await this.jobRepo.save(job)
      throw err
    }
  }
}
```

**Step 3: Create ExtractionController**

```typescript
// extraction/extraction.controller.ts
import { Controller, Get, Post, Put, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ExtractionService } from './extraction.service'
import { UpdateItemDto } from './dto/update-item.dto'

@ApiTags('extraction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExtractionController {
  constructor(private extractionService: ExtractionService) {}

  @Post('projects/:pid/extract')
  extract(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }) {
    return this.extractionService.extractItems(pid, user.sub)
  }

  @Get('projects/:pid/items')
  findAll(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }) {
    return this.extractionService.findAll(pid, user.sub)
  }

  @Get('projects/:pid/items/by-theme')
  findByTheme(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }) {
    return this.extractionService.findByTheme(pid, user.sub)
  }

  @Put('items/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    return this.extractionService.update(id, dto)
  }
}
```

**Step 4: Create ExtractionModule**

```typescript
// extraction/extraction.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { Document } from '../database/entities/document.entity'
import { OutlineSection } from '../database/entities/outline-section.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiModule } from '../ai/ai.module'
import { ProjectsModule } from '../projects/projects.module'
import { ExtractionController } from './extraction.controller'
import { ExtractionService } from './extraction.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ExtractedItem, Document, OutlineSection, JobProgress]),
    AiModule, ProjectsModule,
  ],
  controllers: [ExtractionController],
  providers: [ExtractionService],
  exports: [ExtractionService],
})
export class ExtractionModule {}
```

**Step 5: Import in AppModule**

Add `ExtractionModule` to `app.module.ts`.

**Step 6: Commit**

```bash
git add apps/responsia-backend/src/extraction/ apps/responsia-backend/src/app/app.module.ts
git commit -m "feat: add extraction module (Phase 2 — extract & classify items)"
```

---

## Task 7: Create DraftGroups Module (Phase 3 Backend)

**Files:**
- Create: `apps/responsia-backend/src/draft-groups/draft-groups.module.ts`
- Create: `apps/responsia-backend/src/draft-groups/draft-groups.controller.ts`
- Create: `apps/responsia-backend/src/draft-groups/draft-groups.service.ts`
- Create: `apps/responsia-backend/src/draft-groups/dto/update-draft-group.dto.ts`
- Modify: `apps/responsia-backend/src/app/app.module.ts`

**Step 1: Create UpdateDraftGroupDto**

```typescript
// dto/update-draft-group.dto.ts
import { IsOptional, IsString, IsIn } from 'class-validator'
export class UpdateDraftGroupDto {
  @IsOptional() @IsString() modelId?: string
  @IsOptional() @IsString() systemPrompt?: string
  @IsOptional() @IsString() generatedText?: string
  @IsOptional() @IsIn(['pending', 'generating', 'drafted', 'edited', 'final']) status?: string
}
```

**Step 2: Create DraftGroupsService**

Key: the `generate()` method builds context from ExtractedItems + SearchService RAG + AnalysisFeedback, then streams via SSE.

```typescript
// draft-groups/draft-groups.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { ResponseDraft } from '../database/entities/response-draft.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiService, StreamCallbacks } from '../ai/ai.service'
import { SearchService } from '../search/search.service'
import { ProjectsService } from '../projects/projects.service'
import { getModelById } from '../ai/ai.config'
import { QUEUE_SERVICE, QueueService } from '../jobs/queue.interface'

@Injectable()
export class DraftGroupsService {
  private readonly logger = new Logger(DraftGroupsService.name)

  constructor(
    @InjectRepository(DraftGroup) private groupRepo: Repository<DraftGroup>,
    @InjectRepository(ExtractedItem) private itemRepo: Repository<ExtractedItem>,
    @InjectRepository(ResponseDraft) private draftRepo: Repository<ResponseDraft>,
    @InjectRepository(AnalysisFeedback) private feedbackRepo: Repository<AnalysisFeedback>,
    @InjectRepository(JobProgress) private jobRepo: Repository<JobProgress>,
    private aiService: AiService,
    private searchService: SearchService,
    private projectsService: ProjectsService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
  ) {}

  async findAll(projectId: number, auth0Id: string): Promise<DraftGroup[]> {
    await this.projectsService.verifyAccess(projectId, auth0Id)
    return this.groupRepo.find({
      where: { projectId },
      relations: ['outlineSection'],
      order: { outlineSection: { position: 'ASC' } },
    })
  }

  async update(id: number, dto: any): Promise<DraftGroup> {
    const group = await this.groupRepo.findOneOrFail({ where: { id } })
    Object.assign(group, dto)
    if (dto.generatedText && group.status === 'drafted') {
      group.status = 'edited'
    }
    return this.groupRepo.save(group)
  }

  /** Build context for a draft group: items + RAG + feedback */
  private async buildContext(group: DraftGroup): Promise<string> {
    const items = await this.itemRepo.find({
      where: { outlineSectionId: group.outlineSectionId },
    })

    let context = ''

    // 1. Questions & conditions
    const questions = items.filter((i) => i.kind === 'question')
    const conditions = items.filter((i) => i.kind === 'condition')

    if (questions.length > 0) {
      context += '=== QUESTIONS À RÉPONDRE ===\n'
      context += questions.map((q) => `- ${q.originalText}`).join('\n')
      context += '\n\n'
    }
    if (conditions.length > 0) {
      context += '=== CONDITIONS À RESPECTER ===\n'
      context += conditions.map((c) => `- ${c.originalText}`).join('\n')
      context += '\n\n'
    }

    // 2. RAG from Azure AI Search (or pgvector)
    const searchQuery = items.map((i) => i.originalText).join(' ').substring(0, 500)
    if (searchQuery) {
      const chunks = await this.searchService.search(group.projectId, searchQuery, 5)
      if (chunks.length > 0) {
        context += '=== CONNAISSANCES (soumissions précédentes) ===\n'
        context += chunks.map((c) => c.content).join('\n---\n')
        context += '\n\n'
      }
    }

    // 3. Matched feedback
    const itemIds = items.map((i) => i.id)
    if (itemIds.length > 0) {
      const feedback = await this.feedbackRepo
        .createQueryBuilder('f')
        .where('f.extracted_item_id IN (:...ids)', { ids: itemIds })
        .orWhere('f.project_id = :pid', { pid: group.projectId })
        .getMany()

      const relevantFeedback = feedback.filter(
        (f) => itemIds.includes(f.extractedItemId!) || !f.extractedItemId,
      )

      if (relevantFeedback.length > 0) {
        context += '=== RETOURS D\'ÉVALUATIONS PRÉCÉDENTES ===\n'
        context += relevantFeedback
          .map((f) => `[${f.feedbackType}/${f.severity}] ${f.content}`)
          .join('\n')
        context += '\n\n'
      }
    }

    return context
  }

  /** Stream-generate a draft for a single group */
  async generate(id: number, callbacks: StreamCallbacks): Promise<void> {
    const group = await this.groupRepo.findOneOrFail({
      where: { id },
      relations: ['outlineSection'],
    })

    group.status = 'generating'
    await this.groupRepo.save(group)

    const model = getModelById(group.modelId) ?? this.aiService.resolveModel('drafting')
    const context = await this.buildContext(group)
    const systemPrompt = group.systemPrompt + (context ? `\n\n${context}` : '')
    const userPrompt = `Rédigez la section "${group.outlineSection.title}": ${group.outlineSection.description || ''}`

    await this.aiService.stream(model, systemPrompt, userPrompt, {
      onToken: callbacks.onToken,
      onDone: async (fullText) => {
        // Save to group
        group.generatedText = fullText
        group.status = 'drafted'
        await this.groupRepo.save(group)

        // Save version history
        const lastDraft = await this.draftRepo.findOne({
          where: { draftGroupId: id },
          order: { version: 'DESC' },
        })
        await this.draftRepo.save(this.draftRepo.create({
          draftGroupId: id,
          version: (lastDraft?.version ?? 0) + 1,
          content: fullText,
          modelUsed: model.id,
          promptUsed: systemPrompt,
        }))

        // Update item statuses
        await this.itemRepo.update(
          { outlineSectionId: group.outlineSectionId, status: 'pending' },
          { status: 'drafted' },
        )

        callbacks.onDone(fullText)
      },
      onError: async (err) => {
        group.status = 'pending'
        await this.groupRepo.save(group)
        callbacks.onError(err)
      },
      signal: callbacks.signal,
    })
  }

  /** Queue draft-all job */
  async queueDraftAll(projectId: number, auth0Id: string): Promise<{ jobId: string }> {
    await this.projectsService.verifyAccess(projectId, auth0Id, 'editor')
    const jobId = await this.queueService.send('draft-all', { projectId })
    return { jobId }
  }

  /** Process draft-all: generate all pending groups sequentially */
  async processDraftAll(projectId: number): Promise<void> {
    const job = this.jobRepo.create({
      projectId, jobType: 'draft_all', status: 'processing',
      progress: 0, message: 'Rédaction automatique...',
    })
    await this.jobRepo.save(job)

    try {
      const groups = await this.groupRepo.find({
        where: { projectId, status: 'pending' },
        relations: ['outlineSection'],
        order: { outlineSection: { position: 'ASC' } },
      })

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]
        job.progress = Math.round((i / groups.length) * 100)
        job.message = `Rédaction: ${group.outlineSection?.title || 'Section'}...`
        await this.jobRepo.save(job)

        const model = getModelById(group.modelId) ?? this.aiService.resolveModel('drafting')
        const context = await this.buildContext(group)
        const systemPrompt = group.systemPrompt + (context ? `\n\n${context}` : '')
        const userPrompt = `Rédigez la section "${group.outlineSection?.title}"`

        const fullText = await this.aiService.generate(model, systemPrompt, userPrompt)

        group.generatedText = fullText
        group.status = 'drafted'
        await this.groupRepo.save(group)

        // Version history
        const lastDraft = await this.draftRepo.findOne({
          where: { draftGroupId: group.id }, order: { version: 'DESC' },
        })
        await this.draftRepo.save(this.draftRepo.create({
          draftGroupId: group.id,
          version: (lastDraft?.version ?? 0) + 1,
          content: fullText, modelUsed: model.id, promptUsed: systemPrompt,
        }))
      }

      job.status = 'completed'; job.progress = 100
      job.message = `${groups.length} sections rédigées`
      job.completedAt = new Date()
      await this.jobRepo.save(job)
    } catch (err: any) {
      job.status = 'error'; job.errorMessage = err.message
      job.completedAt = new Date()
      await this.jobRepo.save(job)
      throw err
    }
  }
}
```

**Step 3: Create DraftGroupsController**

```typescript
// draft-groups/draft-groups.controller.ts
import { Controller, Get, Post, Put, Param, Body, Req, Res, ParseIntPipe, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { DraftGroupsService } from './draft-groups.service'
import { UpdateDraftGroupDto } from './dto/update-draft-group.dto'
import type { Request, Response } from 'express'

@ApiTags('draft-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DraftGroupsController {
  constructor(private draftGroupsService: DraftGroupsService) {}

  @Get('projects/:pid/draft-groups')
  findAll(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }) {
    return this.draftGroupsService.findAll(pid, user.sub)
  }

  @Put('draft-groups/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDraftGroupDto) {
    return this.draftGroupsService.update(id, dto)
  }

  @Post('draft-groups/:id/generate')
  async generate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const abortController = new AbortController()
    req.on('close', () => abortController.abort())

    await this.draftGroupsService.generate(id, {
      onToken: (token) => res.write(`data: ${JSON.stringify({ type: 'delta', text: token })}\n\n`),
      onDone: (fullText) => {
        res.write(`data: ${JSON.stringify({ type: 'done', text: fullText })}\n\n`)
        res.end()
      },
      onError: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
        res.end()
      },
      signal: abortController.signal,
    })
  }

  @Post('projects/:pid/draft-all')
  draftAll(@Param('pid', ParseIntPipe) pid: number, @CurrentUser() user: { sub: string }) {
    return this.draftGroupsService.queueDraftAll(pid, user.sub)
  }
}
```

**Step 4: Create DraftGroupsModule**

```typescript
// draft-groups/draft-groups.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DraftGroup } from '../database/entities/draft-group.entity'
import { ExtractedItem } from '../database/entities/extracted-item.entity'
import { ResponseDraft } from '../database/entities/response-draft.entity'
import { AnalysisFeedback } from '../database/entities/feedback.entity'
import { JobProgress } from '../database/entities/job-progress.entity'
import { AiModule } from '../ai/ai.module'
import { SearchModule } from '../search/search.module'
import { ProjectsModule } from '../projects/projects.module'
import { JobsModule } from '../jobs/jobs.module'
import { DraftGroupsController } from './draft-groups.controller'
import { DraftGroupsService } from './draft-groups.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([DraftGroup, ExtractedItem, ResponseDraft, AnalysisFeedback, JobProgress]),
    AiModule, SearchModule, ProjectsModule, JobsModule,
  ],
  controllers: [DraftGroupsController],
  providers: [DraftGroupsService],
  exports: [DraftGroupsService],
})
export class DraftGroupsModule {}
```

**Step 5: Import in AppModule, register draft-all queue handler**

Add `DraftGroupsModule` to `app.module.ts`. Also update `setup.service.ts` to register the new `'draft-all'` handler that calls `draftGroupsService.processDraftAll()`.

**Step 6: Commit**

```bash
git add apps/responsia-backend/src/draft-groups/ apps/responsia-backend/src/app/app.module.ts
git commit -m "feat: add draft-groups module (Phase 3 — per-group drafting with RAG + feedback)"
```

---

## Task 8: Remove Requirements Module & Update Dependent Modules

**Files:**
- Delete: `apps/responsia-backend/src/requirements/` (entire directory)
- Modify: `apps/responsia-backend/src/app/app.module.ts` (remove RequirementsModule import)
- Modify: `apps/responsia-backend/src/setup/setup.service.ts` (update pipeline to: structure → extract → index → feedback)
- Modify: `apps/responsia-backend/src/setup/processors/analysis.processor.ts` → rename to `structure.processor.ts`, rewrite for OutlineSection
- Modify: `apps/responsia-backend/src/setup/processors/feedback.processor.ts` (match to ExtractedItem instead of Requirement)
- Modify: `apps/responsia-backend/src/setup/processors/draft-all.processor.ts` → delete (replaced by DraftGroupsService)
- Modify: `apps/responsia-backend/src/compliance/compliance.service.ts` (use ExtractedItem + DraftGroup)
- Modify: `apps/responsia-backend/src/export/export.service.ts` (use OutlineSection + DraftGroup)
- Modify: `apps/responsia-backend/src/chat/chat.service.ts` (update context building)
- Modify: `apps/responsia-backend/src/knowledge/knowledge.service.ts` (delegate to SearchService)

**Step 1: Delete requirements module**

Delete the entire `apps/responsia-backend/src/requirements/` directory.

**Step 2: Update SetupService pipeline**

In `setup.service.ts`, change `runPipeline()` to:
1. Structure analysis (outline extraction)
2. Item extraction
3. Knowledge indexing
4. Feedback extraction

Remove `DraftAllProcessor` import and queue handler. Remove `AnalysisProcessor` (replaced by OutlineService + ExtractionService).

**Step 3: Update feedback.processor.ts**

Change `Requirement` references to `ExtractedItem`. Match feedback to items by `sectionReference` against `item.sectionReference`. Save `extractedItemId` instead of `requirementId`.

**Step 4: Update compliance.service.ts**

Replace `Requirement` with `ExtractedItem` and `DraftGroup`:
- Count total questions, conditions addressed, draft groups completed
- Warn about unaddressed questions, unchecked conditions, incomplete drafts

**Step 5: Update export.service.ts**

Replace `Requirement` with `OutlineSection` + `DraftGroup` + `ExtractedItem`:
- Build DOCX from outline sections (as HEADING_2)
- Each section includes: its DraftGroup.generatedText + condition checklist

**Step 6: Update chat.service.ts**

Replace requirement context with ExtractedItem + DraftGroup context.

**Step 7: Update knowledge.service.ts**

Delegate `search()` to `SearchService` (which handles Azure AI Search vs pgvector). Keep `queueIndexing()` and `findAllByProject()`.

**Step 8: Remove RequirementsModule from AppModule imports**

**Step 9: Verify backend builds**

Run: `npx nx build responsia-backend --skip-nx-cache`
Expected: Build succeeds

**Step 10: Commit**

```bash
git add -A
git commit -m "refactor: remove requirements module, update compliance/export/chat/feedback for new schema"
```

---

## Task 9: Update Setup Pipeline & Indexing

**Files:**
- Modify: `apps/responsia-backend/src/setup/setup.service.ts`
- Modify: `apps/responsia-backend/src/setup/setup.module.ts`
- Modify: `apps/responsia-backend/src/setup/processors/indexing.processor.ts` (push to SearchService after embedding)

**Step 1: Rewrite setup.service.ts**

Update `runPipeline()` to call:
1. `outlineService.analyzeStructure(projectId, 'system')` — structure analysis
2. `extractionService.extractItems(projectId, 'system')` — item extraction
3. `indexingProcessor.process(projectId)` — knowledge indexing
4. `feedbackProcessor.process(projectId)` — feedback extraction

Update constructor to inject `OutlineService`, `ExtractionService`, remove `AnalysisProcessor`, `DraftAllProcessor`.

Register new queue names: `'structure'`, `'extraction'` instead of `'analysis'`.

**Step 2: Update indexing.processor.ts**

After embedding chunks, call `searchService.indexChunks(projectId, chunks)` to push to Azure AI Search.

**Step 3: Update setup.module.ts imports**

Add `OutlineModule`, `ExtractionModule`, `SearchModule`. Remove `RequirementsModule`.

**Step 4: Verify build and commit**

```bash
git add apps/responsia-backend/src/setup/
git commit -m "refactor: update setup pipeline for 4-phase workflow"
```

---

## Task 10: Add Frontend API Hooks for New Endpoints

**Files:**
- Modify: `apps/responsia-frontend/src/hooks/useApi.ts`

**Step 1: Add new hooks**

Replace `useRequirements` / `useUpdateRequirement` with:

```typescript
// Outline
export const useOutline = (projectId: number) =>
  useQuery({ queryKey: ['outline', projectId], queryFn: () => customInstance({ url: `/api/v1/projects/${projectId}/outline`, method: 'GET' }) })

export const useAnalyzeStructure = (projectId: number) =>
  useMutation({ mutationFn: () => customInstance({ url: `/api/v1/projects/${projectId}/outline/analyze`, method: 'POST' }) })

export const useCreateOutlineSection = (projectId: number) =>
  useMutation({ mutationFn: (data: any) => customInstance({ url: `/api/v1/projects/${projectId}/outline`, method: 'POST', data }) })

export const useUpdateOutlineSection = () =>
  useMutation({ mutationFn: ({ id, ...data }: any) => customInstance({ url: `/api/v1/outline/${id}`, method: 'PUT', data }) })

export const useDeleteOutlineSection = () =>
  useMutation({ mutationFn: (id: number) => customInstance({ url: `/api/v1/outline/${id}`, method: 'DELETE' }) })

export const useReorderOutline = (projectId: number) =>
  useMutation({ mutationFn: (sections: any[]) => customInstance({ url: `/api/v1/projects/${projectId}/outline/reorder`, method: 'PUT', data: { sections } }) })

// Extraction
export const useExtractedItems = (projectId: number) =>
  useQuery({ queryKey: ['items', projectId], queryFn: () => customInstance({ url: `/api/v1/projects/${projectId}/items`, method: 'GET' }) })

export const useExtractedItemsByTheme = (projectId: number) =>
  useQuery({ queryKey: ['items-by-theme', projectId], queryFn: () => customInstance({ url: `/api/v1/projects/${projectId}/items/by-theme`, method: 'GET' }) })

export const useExtractItems = (projectId: number) =>
  useMutation({ mutationFn: () => customInstance({ url: `/api/v1/projects/${projectId}/extract`, method: 'POST' }) })

export const useUpdateItem = () =>
  useMutation({ mutationFn: ({ id, ...data }: any) => customInstance({ url: `/api/v1/items/${id}`, method: 'PUT', data }) })

// Draft Groups
export const useDraftGroups = (projectId: number) =>
  useQuery({ queryKey: ['draft-groups', projectId], queryFn: () => customInstance({ url: `/api/v1/projects/${projectId}/draft-groups`, method: 'GET' }) })

export const useUpdateDraftGroup = () =>
  useMutation({ mutationFn: ({ id, ...data }: any) => customInstance({ url: `/api/v1/draft-groups/${id}`, method: 'PUT', data }) })
```

Keep the old hooks (useRequirements etc.) temporarily commented out — remove fully after frontend rewrite.

**Step 2: Commit**

```bash
git add apps/responsia-frontend/src/hooks/useApi.ts
git commit -m "feat: add frontend API hooks for outline, extraction, draft-groups"
```

---

## Task 11: Rewrite Frontend — Phase 1 (StructurePhase)

**Files:**
- Rewrite: `apps/responsia-frontend/src/pages/project/SetupPhase.tsx` → rename to `StructurePhase.tsx`
- Modify: `apps/responsia-frontend/src/pages/ProjectPage.tsx` (update tab structure)

**Step 1: Rename SetupPhase → StructurePhase**

Rewrite to show:
1. Document upload area (keep batch upload with auto-classify from current SetupPhase)
2. "Analyze Structure" button → calls `useAnalyzeStructure` → shows progress
3. Outline tree view (MUI List with nesting) — reorder, edit inline, add/remove sections

**Step 2: Update ProjectPage.tsx tabs**

Change from 5 tabs to 6: Structure | Extract | Draft | Review | Members | Settings

```typescript
<Tab icon={<Upload />} label={t('project.structure.title')} />
<Tab icon={<ListChecks />} label={t('project.extract.title')} />
<Tab icon={<Pencil />} label={t('project.drafting.title')} />
<Tab icon={<ShieldCheck />} label={t('project.review.title')} />
```

**Step 3: Add i18n keys**

Add to all 3 locale files:
```json
"project": {
  "structure": { "title": "Structure" },
  "extract": { "title": "Extraction" },
  "drafting": { "title": "Rédaction" },
  "review": { "title": "Revue & Export" }
}
```

Plus new keys for structure phase: `structure.analyzeBtn`, `structure.analyzing`, `structure.addSection`, etc.

**Step 4: Commit**

```bash
git add apps/responsia-frontend/src/pages/
git commit -m "feat: rewrite Phase 1 frontend (StructurePhase with outline tree)"
```

---

## Task 12: Create Frontend — Phase 2 (ExtractPhase)

**Files:**
- Create: `apps/responsia-frontend/src/pages/project/ExtractPhase.tsx`
- Modify: `apps/responsia-frontend/src/pages/ProjectPage.tsx`
- Modify: `apps/responsia-frontend/src/i18n/locales/*.json`

**Step 1: Create ExtractPhase component**

Layout:
- Toggle tabs: "By RFP Section" / "By AI Theme"
- Questions DataGrid (top): columns = section ref, text, status, outline section dropdown, reclassify button
- Conditions DataGrid (bottom): columns = checkbox, section ref, text, reclassify button
- "Extract" button (triggers `POST /extract` if no items yet)

**Step 2: Add i18n keys**

```json
"extract": {
  "questions": "Questions",
  "conditions": "Conditions",
  "bySection": "Par section RFP",
  "byTheme": "Par thème",
  "reclassify": "Reclassifier",
  "extractBtn": "Extraire les éléments",
  "extracting": "Extraction en cours..."
}
```

**Step 3: Commit**

```bash
git add apps/responsia-frontend/src/pages/project/ExtractPhase.tsx apps/responsia-frontend/src/i18n/
git commit -m "feat: add ExtractPhase frontend (Phase 2 — questions & conditions)"
```

---

## Task 13: Rewrite Frontend — Phase 3 (DraftingPhase)

**Files:**
- Rewrite: `apps/responsia-frontend/src/pages/project/DraftingPhase.tsx`

**Step 1: Rewrite DraftingPhase**

New layout:
- **Left panel**: outline section list (from `useDraftGroups`) — click to select
- **Center panel**: for selected group:
  - Model dropdown (3 models from `useModels()`)
  - System prompt accordion (editable, save via `useUpdateDraftGroup`)
  - "Generate" button → SSE stream via `useSSE` to `POST /draft-groups/:id/generate`
  - Rich text area showing `generatedText` (editable)
  - Matched feedback cards below
  - Items list for this section (questions + conditions)
- **Right drawer**: Chat panel (keep existing)
- **Toolbar**: "Draft All" button

**Step 2: Add i18n keys**

```json
"drafting": {
  "sections": "Sections",
  "model": "Modèle",
  "generate": "Générer",
  "draftAll": "Rédiger tout",
  "groupItems": "Éléments de cette section"
}
```

**Step 3: Commit**

```bash
git add apps/responsia-frontend/src/pages/project/DraftingPhase.tsx apps/responsia-frontend/src/i18n/
git commit -m "feat: rewrite DraftingPhase for per-group drafting with model selector"
```

---

## Task 14: Rewrite Frontend — Phase 4 (ReviewPhase)

**Files:**
- Rewrite: `apps/responsia-frontend/src/pages/project/ReviewPhase.tsx`

**Step 1: Rewrite ReviewPhase**

New layout:
- **Top**: Stats cards (coverage %, quality score, pending items count)
- **Center**: WYSIWYG document preview
  - Render outline sections as headers
  - DraftGroup.generatedText as body
  - Conditions as checklist with checkboxes
  - Each section clickable → inline editing (TextField replaces text)
- **Bottom**: Export buttons (Clean DOCX / Template DOCX)
- Compliance check button → same AI report but using new entities

**Step 2: Add i18n keys for WYSIWYG and inline editing**

**Step 3: Commit**

```bash
git add apps/responsia-frontend/src/pages/project/ReviewPhase.tsx apps/responsia-frontend/src/i18n/
git commit -m "feat: rewrite ReviewPhase with WYSIWYG document preview"
```

---

## Task 15: Full Integration Verification

**Step 1: Start backend**

Run: `npx nx serve responsia-backend`
Expected: NestJS boots, Swagger at `/api/docs` shows new endpoints (outline, extraction, draft-groups)

**Step 2: Start frontend**

Run: `npx nx serve responsia-frontend`
Expected: React app loads, shows 6 tabs on project page

**Step 3: Manual E2E test**

1. Create project
2. Upload RFP PDF + template DOCX
3. Phase 1: Click "Analyze Structure" → outline sections appear
4. Phase 2: Click "Extract" → questions and conditions listed
5. Reclassify an item → kind changes
6. Phase 3: Select a group → pick model → click "Generate" → SSE streams response
7. "Draft All" → all groups drafted
8. Phase 4: WYSIWYG preview renders → click to edit inline
9. Compliance check → report with warnings
10. Export DOCX → file downloads

**Step 4: Fix any issues found during testing**

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: integration fixes from E2E testing"
```

---

## Task 16: Clean Up & Push

**Step 1: Remove dead code**

- Delete any remaining references to `Requirement` entity
- Remove commented-out hooks in `useApi.ts`
- Remove old `analysis.processor.ts` if it was replaced

**Step 2: Lint**

Run: `npx nx lint responsia-backend && npx nx lint responsia-frontend`
Fix any lint errors.

**Step 3: Build**

Run: `npx nx build responsia-backend && npx nx build responsia-frontend`
Expected: Both build successfully.

**Step 4: Final commit and push**

```bash
git add -A
git commit -m "chore: cleanup dead code, fix lint"
git push origin main
```
