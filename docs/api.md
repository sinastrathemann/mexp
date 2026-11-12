# API-Dokumentation

REST-API auf Basis Hono, alle Endpunkte unter `/api/`. Auth via Bearer-Token (Session-Cookie oder JWT aus Entra ID).

## Konventionen
- JSON, UTF-8
- Fehler-Response: `{ "error": { "code": "...", "message": "...", "details": {...} } }`
- Paginierung: `?offset=0&limit=20`, Response enthält `total`
- Datums-/Zeitformate: ISO 8601 mit Timezone

## Endpunkte (Stand Phase 0 — wird ausgebaut)

| Methode | Pfad | Rolle | Beschreibung |
|---|---|---|---|
| GET | `/health` | – | Liveness-Check |
| GET | `/api/events` | read_only+ | Portfolio-Liste; standardmäßig nur nicht archivierte Events, `?archived=true` liefert nur archivierte (nur ohne `DATABASE_URL`, siehe Hinweis unten) |
| POST | `/api/events` | event_office | Event anlegen |
| GET | `/api/events/:id` | read_only+ | Event-Details, enthält `archived: boolean` |
| PATCH | `/api/events/:id` | event_office (owner) | Event bearbeiten |
| POST | `/api/events/:id/archive` | admin | Event archivieren (idempotent) |
| POST | `/api/events/:id/unarchive` | admin | Event aus dem Archiv holen (idempotent) |
| POST | `/api/events/:id/approve` | manager | Event freigeben |
| POST | `/api/events/:id/register` | participant+ | Anmeldung |
| PATCH | `/api/events/:id/my-registration` | participant+ (eigene Anmeldung) | Eigene Antworten/Notiz ändern, solange Status `open` und Frist nicht abgelaufen (409 `REGISTRATION_CLOSED`) |
| POST | `/api/events/:id/checkin` | event_office | QR-Check-in |
| GET | `/api/event-requests` | angemeldet | Eventanfragen, gefiltert über `?view=` (siehe unten) |
| GET | `/api/event-requests/:id` | Anfragende:r, Zugewiesene:r, admin | Einzelne Anfrage |
| PATCH | `/api/event-requests/:id` | admin, manager, event_office, werkstudent; Nicht-Admins nur auf ihnen zugewiesene Anfragen | Anfrage bearbeiten (u. a. `assignedToId`, `archived`, `eventId`) |
| GET | `/api/event-requests/assignees` | admin | Mögliche Empfänger:innen zum Weiterleiten |
| GET | `/api/event-requests/pending-count` | admin, manager, event_office, werkstudent | `{ submitted, assignedToMe }` für die Ping-Anzeige |
| GET | `/api/events/:eventId/tasks` | admin, manager, event_office, werkstudent | Projektplan-Aufgaben eines Events |
| POST | `/api/events/:eventId/tasks` | admin, manager, event_office, werkstudent | Aufgabe anlegen |
| PATCH | `/api/events/:eventId/tasks/:taskId` | admin, manager, event_office, werkstudent | Aufgabe bearbeiten |
| DELETE | `/api/events/:eventId/tasks/:taskId` | admin | Aufgabe löschen |
| GET | `/api/task-assignees` | admin, manager, event_office, werkstudent | Mögliche Verantwortliche (Event-Team) |
| GET | `/api/blueprints/:id/tasks` | admin, manager, event_office, werkstudent | Aufgaben-Vorlagen eines Blueprints |
| PUT | `/api/blueprints/:id/tasks` | admin, manager, event_office, werkstudent | Vorlagenliste ersetzen (gesamte Liste) |
| GET | `/api/tools` | admin, manager, event_office, werkstudent | Zentrale Tool-Links |
| PUT | `/api/tools` | admin | Tool-Links ersetzen (gesamte Liste) |

### Archiv für Events

- `GET /api/events` liefert standardmäßig nur nicht archivierte Events; `?archived=true` nur archivierte.
- `POST /api/events/:id/archive` und `/unarchive`: nur admin, idempotent. Fehler: `404` (unbekanntes oder gelöschtes Event), `403` (keine Rolle bzw. kein Admin), `501` (wenn `DATABASE_URL` gesetzt ist; Postgres-Variante noch nicht umgesetzt).
- OneNote-Events zählen als archiviert, außer ein Override setzt `_archived: false`.
- `GET /api/dashboard/portfolio` zählt archivierte Events und deren Anmeldungen nicht.

### Eventanfragen: Postfächer und Archiv

`GET /api/event-requests?view=…` (`mine=true` ist Alias für `view=mine`):

| `view` | Rolle | Inhalt |
|---|---|---|
| `inbox` | admin | Eingang: nicht archiviert, nicht zugewiesen, ohne `eventId` |
| `mine` | angemeldet | „Meine Anfragen“: von mir gestellte Anfragen, auch archivierte |
| `assigned` | angemeldet | „Mein Postfach“: nicht archiviert, mir zugewiesen, ohne `eventId`; `&assignee=<id>` (nur admin) zeigt das Postfach einer anderen Person |
| `archive` | admin | Archiv: archiviert (`archivedAt`) oder mit `eventId` (auch Altbestand ohne `archivedAt`) |
| (ohne) | admin: alle; Team-Rollen (admin, manager, event_office, werkstudent): eigene und ihnen zugewiesene; Nutzer ohne Team-Rolle erhalten immer `mine` | |

- `GET /:id`: nur Anfragende:r, Zugewiesene:r oder admin.
- Hinweis: Mit gesetzter `DATABASE_URL` (Postgres-Modus) ignoriert `GET /api/events?archived=true` den Parameter.
- `PATCH`: Nicht-Admins nur auf ihnen zugewiesene Anfragen. `assignedToId` (Weiterleiten) und `archived` nur admin. `archived: true` setzt `archivedAt` (idempotent), `false` setzt es auf `null`. Wird `eventId` gesetzt (Event aus Anfrage angelegt), wird die Anfrage ebenfalls archiviert.
- `GET /pending-count` liefert `{ submitted, assignedToMe }`: `submitted` = Eingang des Admins mit Status `submitted`; `assignedToMe` = eigenes Postfach mit Status `submitted` oder `in_review`.

### Projektplan: Regeln

- Links: nur `https`; URL ≤ 2000 Zeichen, Label ≤ 100 Zeichen; Label und URL nur gemeinsam oder gar nicht.
- Titel: 1–200 Zeichen.
- `daysBefore`: ganze Zahl 0–365 oder `null`.
- Unbekannter Blueprint: `404 BLUEPRINT_NOT_FOUND`.
- Verantwortliche Person nicht im Event-Team: `400 INVALID_ASSIGNEE`.
- Pro Event sind höchstens 200 Aufgaben möglich (`400 TOO_MANY_TASKS`).
- Die Fälligkeit wird in der Zeitzone Europe/Berlin berechnet.
- `PATCH` darf Link-Text oder URL einzeln ändern, solange danach beides gesetzt oder beides leer ist (sonst `400 INVALID_LINK`).
- Blueprint anwenden: dessen Aufgaben werden kopiert, Fälligkeit = Event-Start minus `daysBefore`.
- Tools: bis zum ersten Speichern gilt Coworking-Copilot als Vorbelegung. Der Budget-Control-Agent wird im Tools-Kasten ausgeblendet, weil er einen eigenen Budget-Kasten hat.

Vollständige Schema-Definitionen: `apps/api/src/routes/**/schema.ts` (Zod, single source of truth).
