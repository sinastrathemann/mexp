# Changelog

Alle nennenswerten Änderungen an mEXP. Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), SemVer.

## [Unreleased]

### Added
- Anmelde-Formular: Häkchen „Teilnahme-Frage“ bei Ja/Nein-Fragen (bei „Bist du dabei?“ automatisch). Wer „Nein“ antwortet, steht in einer eigenen Liste „Nicht dabei“, zählt nicht als Teilnehmer:in und belegt keinen Platz; Änderung der Antwort stellt den Status um.
- Anmelde-Formular: Häkchen „Antworten für alle sichtbar“ pro Frage. Die Antwort steht dann in der Teilnehmerliste in Klammern hinter dem Namen, z. B. „Anna (Hamburg)“, inklusive eigener Angabe bei „Andere“ (Freitext-Fragen bleiben intern). Wer „Nein“ bei der Teilnahme-Frage sagt, muss die übrigen Fragen nicht mehr beantworten.
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
- Admin-Reiter „Tools“ für zentrale Links (vorbelegt: Coworking-Copilot; der Budget-Control-Agent hat seinen eigenen Kasten und erscheint nicht doppelt).
- Events mit offener Uhrzeit („Uhrzeit steht noch nicht fest“): nur Datum, Anzeige „Uhrzeit folgt“, Kalenderdatei als Ganztagstermin.
- Anmelde-Formular: leere Fragen anlegen („Eigene Frage“) und Auswahl „Andere“ mit Freitext bei Einfach-/Mehrfachauswahl.
- Teilnehmende können ihre Angaben ändern, solange die Anmeldung offen ist (`PATCH /events/:id/my-registration`).
- Anmeldefenster zeigt Datum, Ort und Beschreibung des Events.
- Event-Beschreibung mit Formatierung: fett, kursiv, unterstrichen, Textfarbe (Orange/Blau/Rot), Stichpunkte und nummerierte Listen mit Einrücken (Tab/Umschalt+Tab). Aus Word/Outlook kopierte Listen bleiben erhalten; Kalenderdatei bekommt reinen Text.

### Changed
- Anmeldefenster: gekürzte Event-Beschreibung zeigt Formatierung schon vor „Mehr anzeigen“; leere Absätze bleiben in der Anzeige erhalten.
- Ja/Nein-Fragen im Anmeldefenster zeigen „Ja“ / „Nein“ statt „Ja, bin dabei“.
- Anmelde-Formular: Hinweis „Frage hat keinen Text“ erscheint erst, wenn die neue Frage verlassen wurde, nicht schon direkt nach dem Hinzufügen.
- Beschreibungsfeld beim Anlegen/Bearbeiten von Events ist größer und wächst mit dem Text.
- Anmeldefenster erscheint immer mittig im sichtbaren Bereich (vorher teils oberhalb, man musste hochscrollen).
- Budget-Bereich auf der Event-Seite durch Link zum Budget-Control-Agent ersetzt (keine Doppelerfassung).
- Werkstudent:innen können Vorlagen in der Oberfläche bearbeiten.
- Statuswechsel: Backend erlaubt jetzt dieselben Übergänge wie die Oberfläche (inkl. Reaktivieren abgesagter Events); im Datei-Modus wird der Übergang jetzt geprüft.
