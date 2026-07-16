# Datenklassifikation & DSGVO

> DSGVO-*Fachlogik* (Retention, Consent-Management, Löschfristen) wird bewusst nicht in mEXP verankert — das übernimmt das zentrale Datenschutzsystem. mEXP stellt die *technischen* Grundlagen: Rollen, PII-Redaction, Audit-Trail.

## Verarbeitete Datenklassen

| Entität | Datenklasse | Begründung | Konsequenzen |
|---|---|---|---|
| Event (Metadaten) | Intern | Kein direkter Personenbezug | Keine Einschränkung außer Rollenprüfung |
| Participant Profile | Vertraulich | Personenbezogene Mitarbeiterdaten | PII-Redaction im Log, AVV für Third-Party-Systeme |
| Event Participation | Vertraulich | Personenbezogen + verhaltensbezogen (No-Show) | Zugriffsbeschränkung Event-Office + eigene Sicht |
| Budget Position | Intern/Vertraulich | Kostenstellenbezug möglich | Rollenprüfung, nicht in allgemeine Logs |
| Approval | Vertraulich | Entscheiderzuordnung | Audit-pflichtig |
| Document Artifact | je nach Inhalt | Teilnehmerlisten, Zertifikate | SharePoint-Rechte erben |
| Survey Response | Vertraulich oder anonym | Pro Blueprint entscheidbar | Anonym-Flag im Datenmodell |
| Audit Record | Streng vertraulich | Enthält Aktionen + Akteure | Unveränderbar, nur Admin-Einsicht |

## Technische Maßnahmen

- **PII-Redaction** im pino-Logger (`packages/shared/src/logger.ts`) — Felder: `email`, `phone`, `firstName`, `lastName`, `password`, `token`, `apiKey`, `authorization`-Header
- **Auth** über Entra ID, kein Self-Sign-up
- **Rollen & Policies** (`config/auth.yaml`) durchgehend in jeder Use Case
- **Audit-Trail** für alle Statuswechsel, Freigaben, Budgetänderungen, Teilnehmer-Zustandswechsel, Dokumentenerzeugung
- **Export-Kontrolle**: Exports nur nach Rollen- und Datenbereichsprüfung
- **Retention-Hooks**: Schemata mit `created_at` / `deleted_at`, damit zentrales Datenschutzsystem Retention durchsetzen kann
- **Keine KI-Verarbeitung personenbezogener Daten im MVP** — LLM-Modul ist inaktiv. Bei Aktivierung Phase 4: neue Datenklassifikations-Bewertung + AVV-Prüfung pro Provider.

## Offene Punkte
- HR-Datenquelle verbindlich festlegen (Phase 0)
- Verzeichnis der Verarbeitungstätigkeiten gemeinsam mit DSB erstellen
- Retention-Perioden pro Entität mit HR/Legal abstimmen
