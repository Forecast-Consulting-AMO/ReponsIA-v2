# ReponsIA v2 — Workflow Redesign Design

**Date**: 2026-02-23
**Status**: Approved
**Approach**: B — Major Schema Redesign (nobody uses the app yet)

---

## Summary

Replace the current 3-phase workflow (Setup → Drafting → Review) with a 4-phase flow that better mirrors how RFP responses are actually built:

1. **Upload & Structure** — Upload docs + detect/create the target document outline
2. **Extract & Classify** — Find questions vs conditions, group by section and theme
3. **Draft by Group** — Generate answers per outline section with per-group prompt/model
4. **Review & Export** — WYSIWYG preview, inline editing, compliance check, DOCX export

Key changes:
- Replace `Requirement` entity with `OutlineSection`, `ExtractedItem`, `DraftGroup`, `ResponseDraft`
- Replace pgvector RAG with Azure AI Search (with pgvector fallback for dev)
- Update model registry to 3 models: Claude Sonnet 4.6, Claude Opus 4.6, GPT Chat 5.2
- Integrate past submission feedback into drafting context

---

## 4-Phase Workflow Detail

### Phase 1: Upload & Structure

User uploads documents (same classification as before: rfp, past_submission, reference, analysis_report, template). Optionally uploads a DOCX template.

After upload, user clicks "Analyze Structure". The AI:
1. Parses the template (if provided) to detect section structure
2. Analyzes RFP documents to understand required sections
3. Runs gap analysis: template sections vs RFP requirements
4. Produces an `OutlineSection[]` tree — the skeleton of the final document

The outline is editable: users can reorder, rename, add, or remove sections.

### Phase 2: Extract & Classify

AI processes all RFP documents and extracts items into `ExtractedItem[]`. Each item is classified:
- **Question** — requires a written answer (e.g., "Describe your methodology for...")
- **Condition** — must be acknowledged/complied with (e.g., "The contractor must hold ISO 9001 certification")

Items are assigned to outline sections and tagged with AI-detected themes (e.g., "pricing", "methodology", "team").

UI shows two views:
- **By RFP Section** (default) — grouped by where they appear in the original RFP
- **By AI Theme** — grouped by cross-cutting themes

Questions appear at the top with answer fields. Conditions appear below with checkboxes. Users can reclassify any item.

Feedback from analysis_report documents is extracted and auto-matched to items by section reference.

### Phase 3: Draft by Group

Each outline section becomes a `DraftGroup` with:
- Editable system prompt (pre-filled with default drafting prompt)
- Model dropdown (3 models)
- "Generate" button → SSE streaming

Generation context includes:
1. All `ExtractedItem`s in the group (questions + conditions)
2. Azure AI Search RAG results (relevant chunks from past_submission + reference docs)
3. Matched `AnalysisFeedback` entries (strengths, weaknesses, recommendations from past submissions)

"Draft All" batch generates all pending groups sequentially.

### Phase 4: Review & Export

WYSIWYG document preview renders the final document:
- Outline sections as headers
- Question responses as body text
- Conditions as a compliance checklist

Each section is clickable for inline editing. Compliance check flags unaddressed questions and unchecked conditions.

Export options: Clean DOCX or template-based DOCX.

---

## Database Schema Changes

### New Entities

#### OutlineSection
```
outline_sections
  id              SERIAL PK
  project_id      INT FK → projects(id) ON DELETE CASCADE
  parent_id       INT FK → outline_sections(id) NULLABLE (self-ref for nesting)
  position        INT (sort order within parent)
  title           VARCHAR
  description     TEXT NULLABLE
  source          VARCHAR ('template' | 'rfp' | 'ai_suggested')
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
```

#### ExtractedItem
```
extracted_items
  id                    SERIAL PK
  project_id            INT FK → projects(id) ON DELETE CASCADE
  outline_section_id    INT FK → outline_sections(id) NULLABLE
  kind                  VARCHAR ('question' | 'condition')
  original_text         TEXT
  section_reference     VARCHAR NULLABLE (original RFP section ref, e.g. "3.1.2")
  source_document_id    INT FK → documents(id) NULLABLE
  source_page           INT NULLABLE
  ai_themes             TEXT[] (e.g. {"pricing", "methodology"})
  addressed             BOOLEAN DEFAULT FALSE (for conditions)
  response_text         TEXT NULLABLE (for questions, user-editable)
  status                VARCHAR DEFAULT 'pending' ('pending' | 'drafted' | 'reviewed' | 'final')
  created_at            TIMESTAMP
  updated_at            TIMESTAMP
```

#### DraftGroup
```
draft_groups
  id                    SERIAL PK
  project_id            INT FK → projects(id) ON DELETE CASCADE
  outline_section_id    INT FK → outline_sections(id) UNIQUE
  model_id              VARCHAR (references ai.config model id)
  system_prompt         TEXT (pre-filled with default, user-editable)
  generated_text        TEXT NULLABLE
  status                VARCHAR DEFAULT 'pending' ('pending' | 'generating' | 'drafted' | 'edited' | 'final')
  created_at            TIMESTAMP
  updated_at            TIMESTAMP
```

#### ResponseDraft (version history)
```
response_drafts
  id                SERIAL PK
  draft_group_id    INT FK → draft_groups(id) ON DELETE CASCADE
  version           INT
  content           TEXT
  model_used        VARCHAR
  prompt_used       TEXT
  created_at        TIMESTAMP
```

### Removed Entity

- `Requirement` — replaced by `ExtractedItem` + `DraftGroup`

### Modified Entities

- `AnalysisFeedback` — change `requirement_id` FK to `extracted_item_id` FK
- `ChatMessage` — change `edit_target_requirement_id` to `edit_target_item_id`
- `Project` — add OneToMany relations for new entities

### Kept As-Is

Profile, Document, DocumentChunk, ProjectMember, JobProgress

---

## Azure AI Search Integration

### Why Replace pgvector

The current RAG uses a manual hybrid: pgvector (60%) + PostgreSQL FTS (30%) + pg_trgm (10%). Azure AI Search provides:
- Built-in semantic ranking (no manual weight tuning)
- Better scaling without PostgreSQL load
- Simpler code (single API call vs raw SQL)

### Architecture

New `SearchService` (`search/search.service.ts`):
- `indexChunks(projectId, chunks[])` — push to Azure AI Search index
- `search(projectId, query, limit)` — semantic search, return ranked chunks
- `deleteProjectIndex(projectId)` — cleanup on project deletion

Index schema:
```
responsia-chunks
  id: string (chunk id)
  projectId: int (filterable)
  documentId: int
  content: string (searchable)
  sectionTitle: string (searchable)
```

### Dev Fallback

When `AZURE_SEARCH_ENDPOINT` is not set, fall back to existing pgvector search in `KnowledgeService`. This keeps local dev simple (just Docker Compose with PostgreSQL).

### New Env Vars
```
AZURE_SEARCH_ENDPOINT=https://<name>.search.windows.net
AZURE_SEARCH_KEY=<admin-key>
AZURE_SEARCH_INDEX=responsia-chunks
```

### Package
```
@azure/search-documents
```

---

## Model Registry Update

Replace 7 models with 3:

| id | label | provider | modelId | maxOutput |
|----|-------|----------|---------|-----------|
| `claude-sonnet-4.6` | Claude Sonnet 4.6 | anthropic | `claude-sonnet-4-6-20250514` | 16384 |
| `claude-opus-4.6` | Claude Opus 4.6 | anthropic | `claude-opus-4-6-20250514` | 16384 |
| `gpt-chat-5.2` | GPT Chat 5.2 | openai | `gpt-chat-5.2` | 32768 |

Default for all operations: `claude-sonnet-4.6`.
Embedding stays hardcoded as `text-embedding-3-small` in `AiService.embed()`.

---

## Feedback Integration in Drafting

When generating a draft for a `DraftGroup`:

1. Collect all `ExtractedItem`s assigned to that group's outline section
2. For each item, query `AnalysisFeedback` matched by `extracted_item_id` or `section_reference` similarity
3. Build context:
   - **Items**: question text + conditions to address
   - **RAG**: relevant chunks from Azure AI Search (query = concatenated item texts)
   - **Feedback**: strengths (to reinforce), weaknesses (to address), recommendations (to incorporate)
4. The system prompt explicitly instructs: "Incorporate the following feedback from previous submission evaluations"

---

## Backend Module Changes

| Module | Action | Notes |
|--------|--------|-------|
| `requirements/` | **Remove** | Replaced by extraction + draft-groups |
| `outline/` | **New** | CRUD for OutlineSection, structure analysis |
| `extraction/` | **New** | Extract items from RFP, classify question/condition |
| `draft-groups/` | **New** | CRUD, per-group draft generation (SSE), draft-all |
| `search/` | **New** | Azure AI Search wrapper with pgvector fallback |
| `knowledge/` | **Refactor** | Delegate search to SearchService |
| `ai/` | **Update** | New models, new operation types (structure, extraction) |
| `export/` | **Update** | Assemble from OutlineSection + DraftGroup |
| `compliance/` | **Update** | Check ExtractedItem coverage |
| `jobs/processors/` | **Update** | Pipeline: structure → extract → index → feedback |

### New API Endpoints

```
# Outline (Phase 1)
POST   /api/v1/projects/:pid/outline/analyze     → triggers structure extraction
GET    /api/v1/projects/:pid/outline              → get outline tree
PUT    /api/v1/outline/:id                        → update section
POST   /api/v1/projects/:pid/outline              → add section
DELETE /api/v1/outline/:id
PUT    /api/v1/projects/:pid/outline/reorder      → batch reorder

# Extraction (Phase 2)
POST   /api/v1/projects/:pid/extract              → triggers item extraction
GET    /api/v1/projects/:pid/items                → list extracted items
PUT    /api/v1/items/:id                          → update item
GET    /api/v1/projects/:pid/items/by-theme       → items grouped by theme

# Draft Groups (Phase 3)
GET    /api/v1/projects/:pid/draft-groups         → list groups
PUT    /api/v1/draft-groups/:id                   → update prompt/model/text
POST   /api/v1/draft-groups/:id/generate          → SSE streaming draft
POST   /api/v1/projects/:pid/draft-all            → batch generate

# Search
POST   /api/v1/projects/:pid/search              → Azure AI Search / pgvector fallback
```

---

## Frontend Changes

### Phase Tabs (ProjectPage.tsx)

Change from 5 tabs to 6: **Structure** | **Extract** | **Draft** | **Review** | Members | Settings

### Phase 1: StructurePhase.tsx (new)
- Document upload area (reuse current batch upload)
- Template upload section
- "Analyze Structure" button → triggers `POST /outline/analyze`
- Outline tree view (MUI TreeView) — drag to reorder, click to edit, + to add

### Phase 2: ExtractPhase.tsx (new)
- Toggle tabs: "By RFP Section" / "By AI Theme"
- Questions DataGrid: section ref, text, status, outline section assignment, reclassify button
- Conditions DataGrid: checkbox, section ref, text, reclassify button
- Feedback cards for selected item

### Phase 3: DraftingPhase.tsx (rewrite)
- Left: outline section list (click to select group)
- Center: draft editor with model dropdown + prompt accordion + "Generate" button + streaming text area
- Right drawer: Chat
- Toolbar: "Draft All"

### Phase 4: ReviewPhase.tsx (rewrite)
- Stats cards: coverage %, quality score, pending count
- WYSIWYG preview: rendered HTML sections, clickable for inline edit
- Compliance check button
- Export buttons

---

## New Prompts

### Structure Analysis Prompt
```
Analyze the RFP documents and the template (if provided) to determine the
structure of the response document. Identify all sections that should appear
in the final submission. For each section, provide a title and brief description.

If a template is provided, use it as the base structure and identify any
additional sections required by the RFP that are not in the template.

Return a JSON array of sections with: title, description, source ('template' | 'rfp' | 'ai_suggested').
```

### Extraction Prompt
```
Extract all requirements from the RFP document. For each item found, classify it as:
- "question": requires a written answer or proposal (e.g., "Describe your approach to...")
- "condition": an imposed requirement that must be acknowledged/met (e.g., "The contractor must...")

For each item, return: kind, original_text, section_reference, source_page, ai_themes[].

Focus on identifying actual questions that need answers. Conditions are things the
company must comply with but don't require a narrative response.

Return a JSON array. Only JSON, no extra text.
```

### Updated Drafting Prompt (per-group, with feedback)
```
You are an expert RFP response writer. Draft a professional response for the
following section of the submission document.

Requirements to address:
{items}

Relevant knowledge from past submissions:
{rag_chunks}

Feedback from previous submission evaluations:
{feedback}

Incorporate the feedback: reinforce identified strengths, address weaknesses,
and follow recommendations. Write in {content_language}.
```

---

## Verification Plan

1. `docker compose up -d` → PostgreSQL running
2. `npm run backend:serve` → Swagger at `/api/docs` shows new endpoints
3. Upload RFP + template → outline sections created
4. Extract items → questions and conditions listed, grouped by section and theme
5. Reclassify an item → updates correctly
6. Generate draft for a group → SSE streams response with RAG + feedback context
7. Draft All → all groups drafted
8. Review page → WYSIWYG preview renders correctly
9. Compliance check → flags unaddressed items
10. Export DOCX → document with outline structure and drafts
11. Azure AI Search (when configured) → search returns ranked results
12. Dev mode (no Azure Search) → pgvector fallback works
