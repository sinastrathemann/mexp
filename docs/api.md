# API-Dokumentation

REST-API auf Basis Hono, alle Endpunkte unter `/api/v1/`. Auth via Bearer-Token (Session-Cookie oder JWT aus Entra ID).

## Konventionen
- JSON, UTF-8
- Fehler-Response: `{ "error": { "code": "...", "message": "...", "details": {...} } }`
- Paginierung: `?offset=0&limit=20`, Response enthält `total`
- Datums-/Zeitformate: ISO 8601 mit Timezone

## Endpunkte (Stand Phase 0 — wird ausgebaut)

| Methode | Pfad | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/health` | – | Liveness-Check |
| GET | `/api/v1/events` | read_only+ | Portfolio-Liste |
| POST | `/api/v1/events` | event_office | Event anlegen |
| GET | `/api/v1/events/:id` | read_only+ | Event-Details |
| PATCH | `/api/v1/events/:id` | event_office (owner) | Event bearbeiten |
| POST | `/api/v1/events/:id/approve` | manager | Event freigeben |
| POST | `/api/v1/events/:id/register` | participant+ | Anmeldung |
| POST | `/api/v1/events/:id/checkin` | event_office | QR-Check-in |

Vollständige Schema-Definitionen: `apps/api/src/routes/**/schema.ts` (Zod, single source of truth).
