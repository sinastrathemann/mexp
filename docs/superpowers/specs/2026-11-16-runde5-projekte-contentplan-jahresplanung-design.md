# Feedback-Runde 5 – Event/Projekt, Contentplan, Jahresplanung

Freigegeben von Sina am 16.11.2026 nach Browser-Mockup („dann bau es").

## Warum
Das EXM-Team (alle mit Event-Team-Rolle: admin, manager, event_office, werkstudent) plant
heute in einer Excel (Contentplan 2026) und einer OneNote-Seite (Projektplan 2027). Beides
soll in mEXP. Teilnehmer sollen davon nichts sehen – ihre Sicht bleibt unverändert.

## Harte Randbedingung
**Bestehende Event-, Teilnahme- und Aufgaben-Datensätze werden nie geändert, kein Backfill.**
Alle neuen Daten liegen in eigenen Stores; fehlt ein Eintrag, gilt ein Default beim Lesen.
Geschrieben wird nur, wenn jemand aktiv speichert.

## 1. Event oder Projekt (+ Planungsfelder)
- Ablage: `eventPlanMetaStore` (existiert, team-only) bekommt optionale Felder
  `kind` ("event" | "project", Default "event"), `targetCount` (Freitext, z. B. "140 MA (60 C)"),
  `targetCategories` (Teilmenge [1,2,3]), `recurrence` ("N"|"W"|"R"|"V"|null),
  `goalReached` ("missed"|"reached"|"exceeded"|null), `alternativeDate` (ISO|null, „Option“).
- Anlegen: Umschalter Event/Projekt ganz oben + Planungsfelder; nach dem Anlegen PUT plan-meta
  (wie bisher Verantwortlich/Notiz).
- Bearbeiten: Umschalter + Felder in der Plan-Meta-Karte im Projektplan.
- Projekt = für Nicht-Team-User unsichtbar (Liste + Detail 404) und Selbst-Anmeldung gesperrt.
  Prüfung über den Plan-Meta-Store, nicht über das Event.
- Liste/Detail fürs Team: Badge „📁 Projekt".

## 2. Contentplan
- Store `content-plan` (persistentMap), Eintrag: id, date (YYYY-MM-DD), title, channel,
  responsibleId|null, eventId|null, note|null, createdBy/At, updatedBy/At.
- Kanäle (feste Liste): Allgemein, Mail, Teams, Outlook, Communities, Standort, Sonstiges.
- API `/content-plan` GET (Zeitraum from/to) / POST / PATCH / DELETE – nur TEAM_ROLES.
- Seite `/content-plan` (Sidebar, nur Team): Wochenansicht Mo–Fr mit ‹ ›, „+ Eintrag" pro Tag,
  Filter Kanal/Person; Ansicht „Liste". Kein Import der Excel (später optional).
- Event-Detail (Team): Abschnitt „Geplante Kommunikation" mit verknüpften Einträgen.

## 3. Jahresplanung
- Store `year-plan-entries`: manuelle Einträge kind "external"|"holiday"|"school_holiday",
  title, date, endDate|null.
- Feiertage NRW werden berechnet (fest + Oster-abhängig), nicht gespeichert.
- API `/year-plan?year=` liefert intern (Events/Projekte aus mEXP inkl. Plan-Meta, ohne
  gelöschte/archivierte) + manuelle Einträge + Feiertage; POST/DELETE für manuelle Einträge.
- Seite `/year-plan` (nur Team): Jahr ‹ ›, Filter Intern/Extern/Feiertage, Liste nach Datum
  mit I/E-Kennung, Verantwortlich, Ziel, Erreicht, Status; Ferien gelb; Link zum Event.

## Ansätze
- A (gewählt): eigene Stores + Plan-Meta erweitern → keine Event-Datensätze berührt,
  Team-Daten nie über Event-Endpunkte ausgeliefert.
- B: Felder direkt am Event (Override) → verworfen, verletzt die Datensatz-Regel und würde
  Planungsdaten an Teilnehmer ausliefern.

## Offen / Builder-Entscheidungen
- Monatsansicht Contentplan: später, zunächst Woche + Liste.
- Kalenderansicht Jahresplanung: später, zunächst Liste.
