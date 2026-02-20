# CLAUDE.md

## Overview

ReponsIA v2 — AI-powered RFP response tool for sales teams. Nx 21 monorepo: NestJS 11 backend + React 19 frontend, Auth0 auth, TypeORM + PostgreSQL (pgvector), MUI 7, Orval API generation, i18n (FR/EN/NL).

## Commands

```bash
npm install --legacy-peer-deps     # Install all dependencies
npm run dev                        # Backend (3000) + Frontend (4200)
npm run backend:serve              # NestJS only
npm run frontend:serve             # Vite only
npm run generate:api               # Orval: regenerate API hooks from OpenAPI
npm run lint                       # Lint all
npm run test                       # Test all
npm run build                      # Build all
docker compose -f docker/dev/docker-compose.yml up -d  # Dev Postgres + Azurite
```

## Architecture

- `apps/responsia-backend/` — NestJS 11, TypeORM, Passport JWT (Auth0), pino logging
- `apps/responsia-frontend/` — React 19, Vite 6, MUI 7, React Query, Auth0, i18next
- `libs/shared-types/` — Shared TS types/enums

## 3-Phase Workflow

1. **Setup** — Upload docs, AI auto-processes: extract requirements, build knowledge base, extract feedback
2. **Drafting** — Human+AI collaboration: draft responses, chat-as-editor with split diff view
3. **Review & Export** — Compliance check + DOCX export (clean or template-based)

## Key patterns

- URI versioning: `/api/v1/...`
- Swagger at `/api/docs`
- Global `ValidationPipe` with whitelist + transform
- Auth: `JwtAuthGuard` using Auth0 JWKS, `AUTH_DISABLED=true` for dev
- Frontend API: Orval-generated React Query hooks with custom Axios mutator
- SSE for streaming (drafting, chat, job progress) — no Socket.io
- Azure Service Bus for async jobs (local in-process fallback in dev)
- AI: Direct @anthropic-ai/sdk + openai with per-operation model selection
- i18n: FR (reference), EN, NL — both UI and content languages
- Structured logging: pino (pretty in dev, JSON in prod)
- String-based TypeORM relations to avoid webpack circular deps

## Database

PostgreSQL 15 + pgvector + pg_trgm via TypeORM. Dev compose exposes port 5433. `synchronize: true` in dev only.

## 9 Entities

1. Profile (auth0Id PK, email, displayName, role, defaultModels, defaultPrompts)
2. Project (id, auth0Id FK, name, description, status, contentLanguage, modelOverrides, promptOverrides)
3. Document (id, projectId, filename, fileType, mimeType, blobName, extractedText, ocrUsed)
4. Requirement (id, projectId, sectionNumber, requirementText, type, responseStatus, responseText)
5. AnalysisFeedback (id, projectId, feedbackType, severity, content, addressed)
6. ChatMessage (id, projectId, role, content, editTargetRequirementId, editDiff)
7. DocumentChunk (id, projectId, documentId, content + embedding vector + search_vector tsvector)
8. ProjectMember (id, projectId, auth0Id, email, role: owner/editor/viewer)
9. JobProgress (id, projectId, jobType, status, progress, message)

## Environment

See `.env.example` for all required variables.
