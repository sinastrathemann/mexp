# Changelog

Alle nennenswerten Änderungen an mEMP. Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), SemVer.

## [Unreleased]

### Added
- Phase 0 Setup: Monorepo-Struktur (pnpm workspaces, apps/api + apps/web + packages/*)
- Basis-Tooling: TypeScript strict, Biome, Vitest
- CLAUDE.md mit Projekt-Kontext und Architektur-Regeln
- Config-Gerüst: agent.yaml, auth.yaml, llm.yaml, mcp.json
- Docker-Setup: multi-stage Dockerfile, docker-compose (Postgres, Redis, API, nginx)
- Dokumentations-Gerüst: architecture.md, api.md, data-classification.md, runbook.md
- Specs-Gerüst (Mermaid) für workflows / sequences / states / domain
- i18n (DE/EN) im Web mit react-i18next
