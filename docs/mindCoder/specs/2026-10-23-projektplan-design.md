# Projektplan-Ansicht für Events – Design

**Datum:** 2026-10-23
**Status:** abgestimmt mit Sina Strathemann
**Mockup:** Variante A „Phasen + Checkliste“ (`.mindCoder/brainstorm/…/projektplan-layout.html`, lokal)

## Ziel

Die Event-Detailseite soll für das interne Team wie ein Projektplan funktionieren: Man sieht, in welcher Phase das Event steht, was noch zu tun ist und wer zuständig ist, und kommt mit einem Klick in externe mindsquare-Tools (Coworking-Copilot, Budget-Control-Agent). Externe Tools werden **verlinkt, nicht technisch angebunden**.

## Rollen

| Aktion | admin | manager | event_office | werkstudent |
|---|---|---|---|---|
| Projektplan sehen, Aufgaben anlegen/bearbeiten/abhaken | ✓ | ✓ | ✓ | ✓ |
| Aufgaben löschen | ✓ | – | – | – |
| Blueprints und Blueprint-Aufgaben pflegen | ✓ | ✓ | ✓ | ✓ |
| Tools-Liste pflegen | ✓ | – | – | – |

Teilnehmende und andere Rollen sehen die Event-Seite unverändert.

## Funktion

### Event-Detailseite (nur für die vier Rollen oben)

1. **Phasen-Leiste** ganz oben: Entwurf → Geplant → Anmeldung offen → Läuft → Abgeschlossen. Erledigte Phasen sind grün, die aktuelle Phase ist orange, künftige Phasen sind grau. Ein Klick auf die nächste erlaubte Phase löst den Statuswechsel aus (gleiche Übergänge wie `allowedTransitions`). Sie ersetzt die bisherige Karte „Status ändern“. „Abgesagt“ wird als roter Hinweis statt der Leiste angezeigt. Der Wechsel zu „Abgesagt“ bleibt als separater Button erhalten.
2. **Aufgaben-Checkliste** (linke Spalte) mit Fortschrittsbalken „X / Y erledigt“. Eine Aufgabe besteht aus:
   - Titel (Pflicht, max. 200 Zeichen)
   - Fälligkeit (optional, Datum). Offene Aufgaben mit Fälligkeit vor heute werden rot markiert.
   - verantwortliche Person (optional, Auswahl aus Nutzer:innen mit einer der vier Rollen)
   - Link (optional: Anzeigename + https-URL), angezeigt als Button „↗ Name“
   - erledigt-Häkchen, dazu wird gespeichert, wer wann abgehakt hat
   - Sortierung: offene Aufgaben nach Fälligkeit (ohne Datum zuletzt), erledigte Aufgaben darunter
3. **Tools-Kasten** (rechte Spalte): zentrale Link-Liste, in jedem Event identisch.
4. **Kennzahlen-Kasten** (rechte Spalte): Anmeldungen / Kapazität.
5. **Budget-Link-Kasten** ersetzt den Budget-Bereich: „Das Budget wird im Budget-Control-Agent gepflegt“ + Button „↗ Zum Budget-Tool“. `BudgetPanel` und die Budget-API bleiben im Code und in den Daten erhalten, werden aber nicht mehr angezeigt.
6. Darunter wie bisher: Anmeldeformular, Teilnehmer, Ausschreibung, Dokumente, Feedback.

### Blueprints

- Neuer Abschnitt „Aufgaben“ je Blueprint: Titel, „Tage vor Event-Start“ (optional, ganze Zahl 0–365), Link (optional).
- Beim Anlegen eines Events aus einem Blueprint (`POST /blueprints/:id/apply`) werden die Aufgaben kopiert. Fälligkeit = Event-Start minus N Tage (Datum, ohne Uhrzeit). Ohne Tageswert bleibt die Aufgabe ohne Fälligkeit.
- Spätere Änderungen am Blueprint wirken nicht auf bestehende Events.
- Events ohne Blueprint starten mit leerer Checkliste.

### Admin-Bereich

- Neuer Reiter „Tools“: Einträge hinzufügen, umbenennen, sortieren und löschen.
- Ist die Liste noch nie gespeichert worden, ist sie mit diesen Einträgen vorbelegt:
  - Coworking-Copilot – `https://personal-hub.mindsquare.de/coworking-copilot/`
  - (Budget-Control-Agent nicht — eigener Budget-Kasten; der Tools-Kasten blendet ihn auch aus, falls er eingetragen wird. Änderung 2026-10-23 nach Nutzerfeedback „doppelt“.)
- Die URL des Budget-Link-Kastens ist fest in der Konfiguration hinterlegt und hängt nicht von der Tools-Liste ab, damit das Löschen eines Tools den Budget-Kasten nicht kaputt macht.

### Nebenänderung

- `apps/web/src/pages/blueprints.tsx`: `canWrite` um `werkstudent` ergänzen. Damit passen Oberfläche, API (`WRITE_ROLES` in `blueprints.ts`) und Rollen-Legende („Werkstudent: legt Events an und pflegt Vorlagen“) wieder zusammen. Dafür gibt es einen eigenen Commit.

## Nicht enthalten

Teilaufgaben, Benachrichtigungen oder Mails zu fälligen Aufgaben, eigene Links pro Event, technische Anbindung externer Tools, Budget-Kennzahl im Projektplan.

## Technik

### Persistenz

Wie bei Event-Anfragen und Anmeldeformular über `persistentMap` (JSON-Dateien in `MEXP_DATA_DIR`, im Hub das Volume `/app/data`). Eine Datenbank-Migration ist nicht nötig.

| Store | Schlüssel | Wert |
|---|---|---|
| `event-tasks` | eventId | `EventTask[]` |
| `blueprint-tasks` | blueprintId | `BlueprintTask[]` |
| `tools` | `"default"` | `ToolLink[]` |

```ts
interface EventTask {
  id: string;
  title: string;
  dueDate: string | null;        // YYYY-MM-DD
  assigneeId: string | null;
  assigneeName: string | null;
  linkLabel: string | null;
  linkUrl: string | null;        // nur https://
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;         // ISO
  createdBy: string;
  createdAt: string;
}
interface BlueprintTask { id: string; title: string; daysBefore: number | null; linkLabel: string | null; linkUrl: string | null; }
interface ToolLink { id: string; label: string; url: string; }
```

### API (Hono, Zod-Validierung, `requireMexpRole`)

| Methode | Pfad | Rollen |
|---|---|---|
| GET | `/events/:eventId/tasks` | admin, manager, event_office, werkstudent |
| POST | `/events/:eventId/tasks` | dto. |
| PATCH | `/events/:eventId/tasks/:taskId` | dto. |
| DELETE | `/events/:eventId/tasks/:taskId` | admin |
| GET | `/blueprints/:id/tasks` | admin, manager, event_office, werkstudent |
| PUT | `/blueprints/:id/tasks` (ganze Liste) | admin, manager, event_office, werkstudent |
| GET | `/tools` | admin, manager, event_office, werkstudent |
| PUT | `/tools` (ganze Liste) | admin |

- URL-Validierung: `z.string().url().startsWith("https://")`, max. 2000 Zeichen. Linktext max. 100 Zeichen.
- Eine unbekannte blueprintId liefert 404. Die eventId wird nicht geprüft: Events stammen im Datei-Modus aus drei Quellen (Mock, OneNote-Import, angelegte Events), eine einheitliche Prüfung gibt es nicht. Aufgaben zu einer unbekannten eventId sind harmlos, weil sie nirgends angezeigt werden.
- `assigneeId` muss eine Nutzer:in mit einer der vier Rollen sein, sonst 400 `INVALID_ASSIGNEE`. Das Muster ist dasselbe wie bei den Event-Anfragen.
- Kein Audit-Log: Es existiert nur im Datenbank-Modus, und die Datei-basierten Funktionen (Event-Anfragen, Anmeldeformular) schreiben ebenfalls keins. Nachvollziehbarkeit entsteht über `createdBy`/`createdAt` und `doneBy`/`doneAt` an der Aufgabe sowie `updatedBy`/`updatedAt` an der Tools-Liste.
- `POST /blueprints/:id/apply` kopiert zusätzlich die Blueprint-Aufgaben in den Store `event-tasks`.

### Frontend (`apps/web/src/events/` bzw. `pages/`)

- `phase-bar.tsx`, `task-checklist.tsx`, `tools-card.tsx`, `key-figures-card.tsx`, `budget-link-card.tsx`
- `event-detail.tsx`: für die vier Rollen ein Zwei-Spalten-Layout (Checkliste | Tools + Kennzahlen), auf schmalen Bildschirmen untereinander
- `blueprints.tsx`: Abschnitt „Aufgaben“
- `admin.tsx`: Reiter „Tools“
- Externe Links mit `target="_blank" rel="noopener noreferrer"`
- Alle Texte über i18n (de + en)

### Tests (Vitest)

- API: Rollenmatrix je Endpunkt, Ablehnung von Nicht-https-URLs, Berechnung der Fälligkeit beim Anwenden eines Blueprints, Vorbelegung der Tools-Liste, 404 bei unbekanntem Blueprint
- Frontend: Es gibt im Projekt keine React-Testumgebung. Sortierung, Fortschritt und die Erkennung überfälliger Aufgaben liegen deshalb als reine Funktionen in `task-utils.ts` und werden dort getestet.

## Umsetzungsreihenfolge

1. Blueprint-Schreibrechte in der Oberfläche für Werkstudenten freischalten
2. Tools-Liste (API, Admin-Reiter, Tools-Kasten) und Budget-Link-Kasten
3. Event-Aufgaben, Phasen-Leiste, Kennzahlen-Kasten
4. Blueprint-Aufgaben inklusive Kopieren beim Anwenden
