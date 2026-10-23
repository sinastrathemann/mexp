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
| GET | `/api/events/:eventId/tasks` | admin, manager, event_office, werkstudent | Projektplan-Aufgaben eines Events |
| POST | `/api/events/:eventId/tasks` | admin, manager, event_office, werkstudent | Aufgabe anlegen |
| PATCH | `/api/events/:eventId/tasks/:taskId` | admin, manager, event_office, werkstudent | Aufgabe bearbeiten |
| DELETE | `/api/events/:eventId/tasks/:taskId` | admin | Aufgabe löschen |
| GET | `/api/events/:eventId/task-assignees` | admin, manager, event_office, werkstudent | Mögliche Verantwortliche (Event-Team) |
| GET | `/api/blueprints/:id/tasks` | admin, manager, event_office, werkstudent | Aufgaben-Vorlagen eines Blueprints |
| PUT | `/api/blueprints/:id/tasks` | admin, manager, event_office, werkstudent | Vorlagenliste ersetzen (gesamte Liste) |
| GET | `/api/tools` | admin, manager, event_office, werkstudent | Zentrale Tool-Links |
| PUT | `/api/tools` | admin | Tool-Links ersetzen (gesamte Liste) |

### Projektplan: Regeln

- Links: nur `https`; URL ≤ 2000 Zeichen, Label ≤ 100 Zeichen; Label und URL nur gemeinsam oder gar nicht.
- Titel: 1–200 Zeichen.
- `daysBefore`: ganze Zahl 0–365 oder `null`.
- Unbekannter Blueprint: `404 BLUEPRINT_NOT_FOUND`.
- Verantwortliche Person nicht im Event-Team: `400 INVALID_ASSIGNEE`.
- Blueprint anwenden: dessen Aufgaben werden kopiert, Fälligkeit = Event-Start minus `daysBefore`.
- Tools: bis zum ersten Speichern gelten Coworking-Copilot und Budget-Control-Agent als Vorbelegung.

Vollständige Schema-Definitionen: `apps/api/src/routes/**/schema.ts` (Zod, single source of truth).
