# Changelog

Alle nennenswerten Änderungen an mEXP. Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), SemVer.

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
- Projektplan auf der Event-Detailseite (Team-Rollen): Phasen-Leiste, Aufgaben-Checkliste mit Verantwortlichen, Fälligkeit und Links, Tools-Kasten, Kennzahlen.
- Aufgaben-Vorlagen je Blueprint; werden beim Anlegen eines Events übernommen.
- Admin-Reiter „Tools“ für zentrale Links (vorbelegt: Coworking-Copilot, Budget-Control-Agent).

### Changed
- Budget-Bereich auf der Event-Seite durch Link zum Budget-Control-Agent ersetzt (keine Doppelerfassung).
- Werkstudent:innen können Vorlagen in der Oberfläche bearbeiten.
- Statuswechsel: Backend erlaubt jetzt dieselben Übergänge wie die Oberfläche (inkl. Reaktivieren abgesagter Events); im Datei-Modus wird der Übergang jetzt geprüft.
