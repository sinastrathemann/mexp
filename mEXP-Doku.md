# mEXP — Projektdokumentation

> Letzte Aktualisierung: 2026-04-21
> Verantwortlich: mindsquare AG — HR + IT
> Status: Entwicklung (Phase 0)

Diese Doku hat den Anspruch, dass eine dritte Person das System eigenständig nachbauen könnte. Sie erklärt WARUM, nicht WAS. Technische Details liegen im Code, formale Abläufe in `specs/*.mmd`.

## 1. Vision und Geschäftskontext

### 1.1 Problemstellung
HR und Event Office verwalten interne Events (Schulungen, Workshops, Betriebsveranstaltungen) heute über verstreute Tools: Outlook, Excel-Listen, SharePoint-Verzeichnisse. Keine einheitliche Sicht auf Portfolio, Teilnehmerhistorie, Budgetstatus oder Tax-Risiken.

### 1.2 Lösungsansatz
Eine interne Plattform, die den Event-Lifecycle end-to-end abbildet und sich in die bestehende M365-Welt einfügt — statt sie zu ersetzen. Microsoft-first: Outlook versendet Einladungen, Teams hostet virtuelle Räume, SharePoint lagert Dokumente, Entra ID liefert Identität und Gruppen.

### 1.3 Zielgruppe und Stakeholder
- **Event Office** — operative Nutzung (tägliches Arbeiten)
- **HR** — fachliche Anforderungen, Budgetverantwortung
- **Controlling** — Budget, Tax, Reporting
- **Führungskräfte** — Freigaben, Portfolio-Sicht
- **Mitarbeitende** — Einladung, Anmeldung, Feedback

### 1.4 Erfolgskriterien
Details siehe Anforderungsdokument. Kern-KPIs: Zeit zur Eventanlage, Anteil korrekt klassifizierter Betriebsveranstaltungen, Teilnehmerzufriedenheit, Budget-Deckungsgrad.

## 2. Fachliche Domäne

### 2.1 Domänenmodell
Die Kern-Entitäten sind Event, Blueprint, Participant Profile, Event Participation, Budget Position, Approval, Document Artifact, Survey Response und Audit Record. Ein Event wird aus einem Blueprint abgeleitet (Pflichtfelder, Default-Fristen, Templates), hat mehrere Participations (n:m zu Participant Profiles), ein Budget mit Positionen und Freigaben und produziert Dokumente sowie Audit-Records bei jeder relevanten Zustandsänderung.

Formales Modell: `specs/domain/`.

### 2.2 Geschäftsregeln
- Jeder Statuswechsel eines Events (Entwurf → Freigegeben → Durchführung → Abgeschlossen) ist auditpflichtig.
- Betriebsveranstaltungen unterliegen §19 Abs. 1 EStG: Freibetrag 110 €/Teilnehmer. Überschreitung triggert Tax-Risk-Hinweis.
- Warteliste wird FIFO geführt, Plätze werden automatisch aus der Warteliste nachbesetzt wenn jemand absagt.
- Reminder-Strecken sind per Blueprint konfigurierbar, Default: 168h, 24h, 2h vor Event.
- Freigaben oberhalb festgelegter Budget-Schwellen (siehe `config/agent.yaml`) sind Pflicht und dürfen nicht übersprungen werden.

### 2.3 Glossar
- **Blueprint** — Vorlage für einen Eventtyp (Pflichtfelder, Templates, Default-Fristen)
- **Portfolio** — Gesamtsicht aller Events über alle Eventtypen
- **Attendance** — Anwesenheits-Prozess inkl. QR-Check-in und Live-Dashboard
- **Betriebsveranstaltung** — steuerlich privilegierter Eventtyp mit Freibetrag
- **Tax Risk Indicator** — Warnung wenn geplante Kosten pro Teilnehmer den Freibetrag überschreiten

## 3. Architekturentscheidungen

### 3.1 Gewählte Architektur und warum
**Modular Monolith** mit klar getrennten Packages (`domain`, `application`, `infrastructure`, `auth`). Gründe: kleines Team, überschaubares Lastprofil (~500 Events/Jahr), schnelle Time-to-Market, einfacher Betrieb. Microservice-Schnitt ist später möglich ohne Umbau der Fachlogik — die Package-Grenzen sind bereits Service-Grenzen.

### 3.2 Verworfene Alternativen
- **Low-Code-Plattform (z. B. Power Apps)**: verworfen wegen eingeschränkter Kontrolle über Audit, Tax-Logik und langfristiger Wartbarkeit.
- **Microservices ab Tag 1**: verworfen wegen Betriebsaufwand bei gegebener Teamgröße.
- **Nicht-TypeScript-Stack**: verworfen — TypeScript-first ist mindsquare-Standard und beste Codegen-Qualität mit Claude Code.
- **Eigene Identity-Lösung**: verworfen zugunsten Entra ID, das M365-seitig vorhanden ist.

### 3.3 Bekannte Kompromisse
- Dokumentenablage primär SharePoint — bei SharePoint-Ausfall fällt Document-Pfad aus. S3 als Fallback optional.
- Offline-Check-in im MVP nicht enthalten (kann bei Events ohne verlässliches WLAN relevant werden).
- Tax-Simulation und Feedback-Auswertung erst Phase 2/3 — zwischenzeitlich manueller Prozess.

## 4. Datenflüsse und Integrationen

### 4.1 Datenquellen
- **Entra ID**: Nutzer, Gruppen → Rollenmapping
- **HR-Stammdaten (Quelle zu bestimmen — Phase 0 Entscheidung)**: Mitarbeiter, Kostenstellen, Bereich/Standort
- **Outlook**: Terminbestätigungen, Absagen
- **SharePoint**: Rücklaufende Dokumente (z. B. unterschriebene Teilnehmerlisten)

### 4.2 Datensenken
- **PostgreSQL**: System of Record (Events, Teilnehmer, Audit)
- **SharePoint**: Dokumente, Reports
- **Power BI**: KPI-Sichten (Phase 3+)
- **Outlook/Teams**: Einladungen, Reminder

### 4.3 Externe Abhängigkeiten
- Entra ID — ohne Auth keine App-Nutzung
- Microsoft Graph — ohne Graph kein Outlook/Teams/SharePoint
- Für nicht-kritische Pfade: Fallback auf manuelle Aktionen (z. B. Einladung manuell versenden)

### 4.4 Datenklassifikation
Bis auf Feedback (potenziell anonym) verarbeitet mEXP vertrauliche personenbezogene Mitarbeiterdaten. Details: `docs/data-classification.md`.

## 5. LLM-Nutzung

Im MVP nicht aktiv. Geplant für Phase 4:
- Zusammenfassung von Feedback-Freitexten (Reasoning-Modell)
- Vorschläge für Event-Templates basierend auf Historie (Fast-Modell)
- No-Show-Prognose (klassisches ML oder leichtgewichtiges LLM-Scoring)

Alle Calls gehen durch `packages/llm/provider`, konfiguriert via `config/llm.yaml`. KI darf keine Compliance-, Budget- oder Pflichtteilnahme-Entscheidung autonom treffen — nur Vorschläge mit Confidence-Wert.

## 6. Agent-Workflow

Der Kernworkflow (Eventanlage → Freigabe → Einladung → Check-in → Abschluss) ist in `specs/workflows/` dokumentiert. Zustandsübergänge in `specs/states/`.

## 7. Sicherheit und Compliance

### 7.1 Authentifizierung
Entra ID OIDC mit Session-Cookies (8h TTL). Rollen werden aus Entra-Gruppen abgeleitet — Mapping in `config/auth.yaml`.

### 7.2 Datenschutz
PII-Redaction im pino-Logger, Audit-Trail unveränderbar, Export nur nach Rollenprüfung. Kein AVV mit LLM-Providern im MVP, weil KI nicht aktiv. Bei Aktivierung Phase 4: Datenklassifikation erneut bewerten.

### 7.3 Guardrails
Relevant ab Phase 4 (LLM-Nutzung). MVP hat klassische Input-Validierung via Zod an allen API-Grenzen.

## 8. Betriebskontext

### 8.1 Ressourcenbedarf (geschätzt, produktiv)
- API: 2 vCPU, 2 GB RAM
- Postgres: 2 vCPU, 4 GB RAM, 50 GB SSD
- Redis: 1 vCPU, 1 GB RAM
- nginx/web: 0.5 vCPU, 256 MB RAM

### 8.2 Konfigurationsparameter
Alle Schwellenwerte, Fristen und Limits liegen in `config/agent.yaml`. Änderungen = Release-Event (siehe Governance im Runbook).

### 8.3 Monitoring
OpenTelemetry-Traces zu Jaeger/Grafana Tempo (tbd). Queue-Backlogs, Versandfehler, Integrationsfehler und Check-in-Latenz sind die kritischen Metriken.

## 9. Lessons Learned
(Wird im Projektverlauf gepflegt.)
