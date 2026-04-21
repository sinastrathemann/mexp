# mEMP — mindsquare Event Management Platform

Interne HR-zentrierte Plattform für Eventportfolio, Teilnehmerverwaltung, Budget/Tax, Dokumente, Check-in und Analytics. TypeScript-first Monorepo, Microsoft-365-integriert, Hetzner-Deployment.

## Quick Start

Voraussetzungen: Node.js 22, pnpm 9, Docker (für Postgres/Redis).

```bash
# Abhängigkeiten
corepack enable
pnpm install

# Environment
cp .env.example .env
# .env mit lokalen Werten füllen

# Postgres + Redis lokal starten
docker compose -f docker/docker-compose.yaml up -d postgres redis

# Entwickeln (API + Web parallel)
pnpm dev
```

API läuft auf `http://localhost:3000`, Web-UI auf `http://localhost:8080` (mit Proxy auf `/api` → API).

## Struktur

```
memp/
├── apps/
│   ├── api/              # Hono HTTP + Worker
│   └── web/              # React UI (Vite + shadcn/ui + i18next)
├── packages/
│   ├── domain/           # Fachmodelle & Regeln
│   ├── application/      # Use Cases / Orchestrierung
│   ├── infrastructure/   # DB, Queue, M365, Storage
│   ├── auth/             # Entra ID OIDC, Rollen
│   ├── shared/           # Logger, Errors, Types
│   ├── llm/              # (Phase 4)
│   └── mcp/              # (Phase 4)
├── config/               # agent.yaml, auth.yaml, llm.yaml, mcp.json
├── specs/                # Mermaid-Diagramme
├── docs/                 # Architektur, API, Runbook, Datenklassifikation
├── docker/               # Dockerfile, Compose, nginx
└── tests/                # unit, integration, e2e
```

## Scripts

| Befehl | Zweck |
|---|---|
| `pnpm dev` | API + Web parallel |
| `pnpm build` | Packages + Apps bauen |
| `pnpm lint` / `pnpm lint:fix` | Biome |
| `pnpm typecheck` | TypeScript prüfen |
| `pnpm test` / `test:unit` / `test:int` | Vitest |

## Weiterführend

- Architektur & Entscheidungen: [`mEMP-Doku.md`](./mEMP-Doku.md), [`docs/architecture.md`](./docs/architecture.md)
- Claude Code Instructions: [`CLAUDE.md`](./CLAUDE.md)
- Prozessdiagramme: [`specs/README.md`](./specs/README.md)
- Datenklassifikation/DSGVO: [`docs/data-classification.md`](./docs/data-classification.md)
- Betrieb: [`docs/runbook.md`](./docs/runbook.md)
- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)
