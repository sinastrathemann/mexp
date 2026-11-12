# Archiv und persönliche Postfächer — Design

Stand: 2026-11-10 · Autorin: Sina Strathemann

## Ziel

Dashboard, Eventliste und Anfragen-Eingang zeigen nur noch echte, aktuelle Daten.
Test- und Altdaten verschwinden nicht, sondern landen in einem umkehrbaren Archiv.

## Harte Randbedingung: Live-Daten

mEXP ist produktiv. Das Feelgood-Event, die Anfrage „YPP Revival“ (Vanessa) und
das von Saskia Rüter angelegte Event „5-jähriges Jubiläum“ sind Live-Daten und dürfen sich nicht verändern.

- Es gibt **kein** Schema- oder Datenmigrations-Skript.
- Das Archiv ist ein **zusätzliches, optionales Kennzeichen**. Fehlt es, gilt der
  Datensatz als „nicht archiviert“. Bestehende JSON-Dateien im Volume
  `appdata-mexp-data` werden beim Deploy nicht angefasst.
- Es wird nichts gelöscht. Archivieren ist jederzeit umkehrbar.

## Nicht im Umfang

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

## 2. Persönliche Postfächer für Anfragen

**Ablauf:** Neue Anfrage → Eingang (nur Admins) → Admin leitet weiter → Postfach
der Person → Person legt das Event an → Anfrage verlässt das Postfach und liegt
im Archiv.

**Sichtbarkeit:**

| Ansicht | Admin | Alle anderen Team-Rollen (werkstudent, manager, event_office) |
|---|---|---|
| Eingang (neu, niemandem zugewiesen) | ja | nein |
| Mein Postfach (mir zugewiesen, aktiv) | ja | ja |
| Alle Postfächer (Auswahl „Postfach von: …“) | ja | nein |
| Archiv | ja | nein |
| Rote Zahl in der Seitenleiste | Eingang + eigenes Postfach | eigenes Postfach |

- **Weiterleiten** dürfen nur Admins (`REQUEST_ASSIGNER_ROLES = ["admin"]`). Im
  Moment ist es noch admin, manager und event_office. Live haben nur Admins und
  Werkstudenten Rollen im Event-Team, für die heutigen Nutzer ändert sich also
  nichts.
- **„Aktiv im Postfach“** heißt: zugewiesen, nicht archiviert und noch kein
  `eventId`.
- **Event anlegen beendet die Anfrage:** Wenn der PATCH ein `eventId` setzt, setzt
  der Server zusätzlich `archivedAt`. Die Anfrage verschwindet damit aus dem
  Postfach und aus der roten Zahl, liegt im Archiv und ist dort weiter mit dem
  Event verknüpft.
- **Serverseitige Absicherung:** `GET /api/event-requests` liefert Nicht-Admins
  nur ihre eigenen gestellten und die ihnen zugewiesenen Anfragen. `GET /:id`
  erlaubt einem Nicht-Admin nur eigene oder ihm zugewiesene Anfragen. PATCH
  (Status, Event anlegen) erlaubt Nicht-Admins nur bei ihnen zugewiesenen
  Anfragen.
- **Live-Daten:** „YPP Revival“ ist bereits Saskia Schulz zugewiesen und hat kein
  Event. Die Anfrage erscheint ohne jede Datenänderung in Saskias Postfach.

**API-Filter:** `GET /api/event-requests?view=inbox|mine|assigned|archive`
und optional `&assignee=<userId>` (nur Admin, für „Postfach von: …“). Der Wert
`mine=true` bleibt als Alias für `view=mine` erhalten.

## 3. Eventanfragen archivieren

**Datenmodell:** Optionales Feld `archivedAt?: string | null` im `EventRequestRecord`.
Fehlt es oder ist es `null`, ist die Anfrage aktiv.

**API (`event-requests.ts`):**
- `PATCH /api/event-requests/:id` akzeptiert zusätzlich `archived: boolean`.
  Das dürfen nur Admins, sonst kommt 403. `true` setzt `archivedAt` auf jetzt, `false` setzt es auf `null`.
  Status und Zuweisung bleiben dabei unverändert.
- `view=archive` liefert archivierte Anfragen, alle anderen Ansichten nur aktive.
  Unter „Meine Anfragen“ (`view=mine`) wird nicht gefiltert, Antragstellende
  sehen ihre Anfragen immer.
- `GET /api/event-requests/pending-count` zählt archivierte Anfragen nicht mit.

**UI (`event-requests.tsx`):**
- Tabs für Admins: „Anfrage stellen“, „Meine Anfragen“, „Eingang“,
  „Mein Postfach“, „Alle Postfächer“ (mit Auswahl der Person), „Archiv“.
- Tabs für alle anderen Team-Rollen: „Anfrage stellen“, „Meine Anfragen“,
  „Mein Postfach“. Der bisherige Tab „Mir zugewiesen“ wird zu „Mein Postfach“.
- Admins sehen bei jeder aktiven Anfrage den Button „Archivieren“, im Tab
  „Archiv“ den Button „Wiederherstellen“.
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
- Teilnehmende und Werkstudierende können nicht archivieren und nicht
  weiterleiten (403).
- Ein Werkstudent sieht nur die ihm zugewiesenen Anfragen; `GET /:id` auf eine
  fremde Anfrage liefert 403.
- Eine zugewiesene Anfrage ohne `archivedAt` und ohne `eventId` erscheint im
  Postfach der Person (Schutz von „YPP Revival“).
- Setzt der PATCH ein `eventId`, ist die Anfrage danach archiviert und fehlt im
  Postfach und in der roten Zahl.
- Der Admin-Eingang zeigt nur nicht zugewiesene Anfragen; `assignee=<id>` zeigt
  das Postfach einer Person.

**Manueller Check vor dem Deploy:** lokal mit einer Kopie der Live-JSON-Dateien
starten, falls verfügbar. Das Feelgood-Event, „YPP Revival“ und Saskia Rüters Event müssen unverändert
erscheinen.
