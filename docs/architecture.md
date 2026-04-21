# Architektur

## Überblick
mEMP ist ein Modular Monolith mit vier Schichten: Präsentation (React/Vite), Anwendung (Hono API + Worker), Domäne (Packages) und Integration (M365 + Storage). Persistenz: PostgreSQL; Zustände/Queues: Redis.

Die Package-Grenzen (`packages/domain`, `application`, `infrastructure`, `auth`) spiegeln die Bounded Contexts und bleiben spätere Service-Kandidaten.

## ADR-Log (Architecture Decision Records)

### ADR-001: Modular Monolith statt Microservices
**Status:** Akzeptiert (Phase 0)
**Kontext:** Kleines Team, überschaubares Lastprofil, Time-to-Market-Druck.
**Entscheidung:** Ein deploybarer Monolith, aber strikt modularisiert.
**Konsequenz:** Fachliche Trennung wird im Code erzwungen (Dependency-Regel: domain → application → infrastructure). Service-Trennung später möglich.

### ADR-002: TypeScript strict, ES Modules
**Status:** Akzeptiert
**Entscheidung:** Gemäß Agent Template v2.1. `noUncheckedIndexedAccess` und `exactOptionalPropertyTypes` an.

### ADR-003: PostgreSQL als System of Record, Redis für Queue/Cache
**Status:** Akzeptiert
**Begründung:** Starke Fachkonsistenz, bewährte Operations. BullMQ auf Redis für Reminder, Dokumentenjobs, Exports.

### ADR-004: Microsoft-first statt Schattenlösungen
**Status:** Akzeptiert
**Begründung:** mindsquare nutzt M365 produktiv. Entra ID, Outlook, Teams, SharePoint sind primäre Integrationspunkte.

### ADR-005: Biome statt ESLint+Prettier
**Status:** Akzeptiert
**Begründung:** Eine Toolchain, 10× schneller, Template-Konformität.

### ADR-006: AI als Erweiterung, nicht als Kernbestandteil
**Status:** Akzeptiert
**Begründung:** Kernprozess muss deterministisch und revisionssicher sein. AI-Modul erst Phase 4.

## Abhängigkeiten
- `apps/api` → alle Packages
- `apps/web` → standalone (API über HTTP)
- `packages/application` → `domain`, `shared`
- `packages/infrastructure` → `domain`, `application`, `shared`
- `packages/domain` → `shared` (nur Types/Errors)

Inverse Abhängigkeiten sind verboten.

## Nächste Entscheidungen (offen)
- Drizzle vs. Prisma (Tendenz Drizzle)
- HR-Stammdaten-Quelle (HR-System direkt vs. Entra/AD)
- Offline-Check-in: MVP oder später
