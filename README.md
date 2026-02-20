# ReponsIA v2

AI-powered RFP response tool for sales teams. Built on the [Forecast Consulting SWAS](https://github.com/Forecast-Consulting-AMO/swas-template) architecture.

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | **Nx 21** |
| Backend | **NestJS 11** + TypeORM 0.3 + PostgreSQL 15 (pgvector) |
| Frontend | **React 19** + MUI 7 + Vite 6 |
| Auth | **Auth0** (JWT strategy via Passport) |
| API client | **Orval** (auto-generated React Query hooks from OpenAPI) |
| AI | **Anthropic** (Claude) + **OpenAI** (GPT) — direct SDKs |
| Jobs | **Azure Service Bus** (local in-process fallback for dev) |
| Storage | **Azure Blob Storage** |
| i18n | **i18next** (FR, EN, NL) |
| Logging | **pino** (structured JSON) |
| CI | GitHub Actions (lint, typecheck, build) |
| Deploy | Docker → Azure Web App |

## Quick start

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Copy env
cp .env.example .env

# 3. Start dev Postgres + Azurite
docker compose -f docker/dev/docker-compose.yml up -d

# 4. Start backend + frontend
npm run dev
```

- Backend: http://localhost:3000
- Swagger: http://localhost:3000/api/docs
- Frontend: http://localhost:4200

## Project structure

```
├── apps/
│   ├── responsia-backend/    # NestJS 11 API
│   │   └── src/
│   │       ├── app/          # Root module
│   │       ├── ai/           # Anthropic + OpenAI (model registry)
│   │       ├── auth/         # Auth0 JWT guard + strategy
│   │       ├── chat/         # Chat with RAG + edit suggestions
│   │       ├── compliance/   # Compliance report generation
│   │       ├── config/       # Env validation
│   │       ├── database/     # TypeORM entities (9)
│   │       ├── documents/    # Upload + text extraction (PDF/DOCX/XLSX)
│   │       ├── export/       # DOCX generation
│   │       ├── feedback/     # Feedback extraction
│   │       ├── jobs/         # Azure Service Bus processors
│   │       ├── knowledge/    # RAG (vector + tsvector + trigram)
│   │       ├── projects/     # Project CRUD + members
│   │       ├── requirements/ # Requirement CRUD + drafting
│   │       ├── settings/     # Model/prompt preferences
│   │       └── storage/      # Azure Blob Storage
│   └── responsia-frontend/   # React 19 SPA
│       └── src/
│           ├── api/          # Orval mutator + generated hooks
│           ├── components/   # MUI components
│           ├── hooks/        # Custom hooks (SSE streaming)
│           ├── i18n/         # Translations (fr, en, nl)
│           ├── pages/        # Dashboard, Project, Settings
│           ├── providers/    # Auth0, Notistack
│           ├── routes/       # AppRouter
│           └── theme/        # MUI theme
├── libs/
│   └── shared-types/         # Shared TypeScript interfaces
├── docker/dev/               # Dev docker-compose (Postgres + Azurite)
└── .github/workflows/        # CI pipeline
```
