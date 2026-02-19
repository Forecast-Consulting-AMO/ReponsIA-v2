# CLAUDE.md

## Overview

Nx 21 monorepo template: NestJS 11 backend + React 19 frontend, Auth0 auth, TypeORM + PostgreSQL, MUI 7, Orval API generation, i18n (FR/EN/NL).

## Commands

```bash
npm install                    # Install all dependencies
npm run dev                    # Backend (3000) + Frontend (4200)
npm run backend:serve          # NestJS only
npm run frontend:serve         # Vite only
npm run generate:api           # Orval: regenerate API hooks from OpenAPI
npm run lint                   # Lint all
npm run test                   # Test all
npm run build                  # Build all
docker compose -f docker/dev/docker-compose.yml up -d  # Dev Postgres
```

## Architecture

- `apps/app-backend/` — NestJS 11, TypeORM, Passport JWT (Auth0), pino logging
- `apps/app-frontend/` — React 19, Vite 6, MUI 7, React Query, Auth0, i18next
- `libs/shared-types/` — Shared TS types/enums

## Key patterns

- URI versioning: `/api/v1/...`
- Swagger at `/api/docs`
- Global `ValidationPipe` with whitelist + transform
- Auth: `JwtAuthGuard` using Auth0 JWKS
- Frontend API: Orval-generated React Query hooks with custom Axios mutator
- i18n: FR (reference), EN, NL
- Structured logging: pino (pretty in dev, JSON in prod)

## Database

PostgreSQL 15 via TypeORM. Dev compose exposes port 5433. `synchronize: true` in dev only.

## Environment

See `.env.example` for all required variables.
