# Archiv für Events und Eventanfragen — Design

Stand: 2026-11-10 · Autorin: Sina Strathemann

## Ziel

Dashboard, Eventliste und Anfragen-Eingang zeigen nur noch echte, aktuelle Daten.
Test- und Altdaten verschwinden nicht, sondern landen in einem umkehrbaren Archiv.

## Harte Randbedingung: Live-Daten

mEXP ist produktiv. Das Feelgood-Event und die Anfrage „YPP Revival“ (Vanessa)
sind Live-Daten und dürfen sich nicht verändern.

- Es gibt **kein** Schema- oder Datenmigrations-Skript.
- Das Archiv ist ein **zusätzliches, optionales Kennzeichen**. Fehlt es, gilt der
  Datensatz als „nicht archiviert“. Bestehende JSON-Dateien im Volume
  `appdata-mexp-data` werden beim Deploy nicht angefasst.
- Es wird nichts gelöscht. Archivieren ist jederzeit umkehrbar.

## Nicht im Umfang

- **Ping/Weiterleiten:** Die Logik existiert bereits (`5dcb55b`, `f6bf885`). Dass
  live alle gepingt werden und „Weiterleiten an“ fehlt, liegt am Deploy-Stand im
  Hub, nicht am Code. Das wird separat über den Deploy geklärt.
- Endgültiges Löschen von Anfragen.
- Der Postgres-Pfad (`DATABASE_URL`): Der Hub läuft auf dem JSON-Store. Ist
  `DATABASE_URL` gesetzt, bleibt das Verhalten unverändert.

## 1. Events archivieren

**Datenmodell:** Feld `_archived: boolean` im bestehenden `devEventOverrideStore`,
nach demselben Muster wie `_deleted`. Für angelegte Events (`devCreatedEventsStore`)
wird das Kennzeichen ebenfalls im Override-Store geführt, damit es nur einen Ort gibt.

**OneNote-Events:** Die 11 fest im Code hinterlegten Events aus
`apps/api/src/onenote-import.ts` gelten als archiviert, solange im Override
nicht explizit `_archived: false` steht. Dafür muss nichts in die Live-Daten
geschrieben werden.

Eine Hilfsfunktion `isEventArchived(event, override)` in `events.ts` entscheidet
das zentral, damit Eventliste, Detailseite und Dashboard dieselbe Regel nutzen.

**API:**
- `POST /api/events/:id/archive` und `POST /api/events/:id/unarchive` sind nur
  für `admin` und setzen das Override-Feld.
- `GET /api/events` liefert standardmäßig nur nicht archivierte Events,
  `?archived=true` liefert nur archivierte.
- `GET /api/events/:id` liefert auch archivierte Events mit dem Feld `archived: true`.
  So bleiben Detailseite, Links und Anmeldungen erreichbar.
- `GET /api/dashboard/portfolio` zählt archivierte Events nicht mit, ebenso deren
  Teilnahmen.

**UI:**
- Eventliste: Umschalter „Aktiv / Archiv“.
- Event-Detailseite: Admins sehen „Archivieren“ bzw. „Wiederherstellen“ und bei
  archivierten Events einen Hinweis-Badge „Archiviert“.
- Texte auf Deutsch und Englisch (i18n).

## 2. Eventanfragen archivieren

**Datenmodell:** Optionales Feld `archivedAt?: string | null` im `EventRequestRecord`.
Fehlt es oder ist es `null`, ist die Anfrage aktiv.

**API (`event-requests.ts`):**
- `PATCH /api/event-requests/:id` akzeptiert zusätzlich `archived: boolean`.
  Das dürfen nur `REQUEST_ASSIGNER_ROLES` (admin, manager, event_office), sonst
  kommt 403. `true` setzt `archivedAt` auf jetzt, `false` setzt es auf `null`.
  Status und Zuweisung bleiben dabei unverändert.
- `GET /api/event-requests` liefert für Manager-Rollen standardmäßig nur aktive
  Anfragen, `?archived=true` liefert nur archivierte. Für Antragstellende
  (`mine=true`) wird nicht gefiltert, sie sehen ihre Anfragen immer.
- `GET /api/event-requests/pending-count` zählt archivierte Anfragen nicht mit.

**UI (`event-requests.tsx`):**
- Neuer Tab „Archiv“ für Rollen mit Weiterleitungsrecht.
- In „Eingang“ und „Mir zugewiesen“ steht pro Anfrage der Button „Archivieren“,
  im Tab „Archiv“ der Button „Wiederherstellen“.
- Nach dem Klick werden Liste und Ping-Zähler neu geladen (Query-Invalidierung
  `["event-requests"]`).

## Fehlerfälle

- Unbekannte ID führt zu 404 im bestehenden Format `{ error: { code, message } }`.
- Fehlende Rolle führt zu 403.
- Erneutes Archivieren eines schon archivierten Datensatzes ist idempotent und
  gibt 200 zurück.

## Tests (Vitest, API)

- Ein Event-Datensatz ohne `_archived` erscheint in Liste und Dashboard (Schutz
  der Live-Daten).
- OneNote-Events erscheinen nur bei `?archived=true` und fehlen im Dashboard.
- Archivieren und Wiederherstellen eines Events, nur als Admin (sonst 403).
- Eine Anfrage ohne `archivedAt` erscheint im Eingang und zählt im Ping
  (Schutz der Live-Daten).
- Eine archivierte Anfrage fehlt im Eingang und im Ping und erscheint unter
  `?archived=true`. Für Antragstellende bleibt sie sichtbar.
- Teilnehmende und Werkstudierende können nicht archivieren (403).

**Manueller Check vor dem Deploy:** lokal mit einer Kopie der Live-JSON-Dateien
starten, falls verfügbar. Das Feelgood-Event und „YPP Revival“ müssen unverändert
erscheinen.
