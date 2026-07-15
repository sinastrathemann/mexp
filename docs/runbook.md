# Runbook

Betriebshandbuch für mEMP. Zielgruppe: DevOps / On-Call.

## Deploy

**Target:** mindsquare Agent Hub (Managed)

Der Deploy erfolgt via GitHub-Actions automatisch:

1. Push auf `main` → Workflow `Publish Container` baut `ghcr.io/sinastrathemann/memp:latest`
2. Hub-Admin: **App-Detailseite → Neue Version** → Tag wählen oder `latest` re-pullen
3. Hub startet Container neu. Alter Container läuft bis neuer healthy ist.

**Rollback:** Hub-Admin-UI → "Vorherige Version". Achtung: Nur das Image wird zurückgerollt, nicht das Volume (`appdata-memp-data`). Wenn eine Schema-Migration passiert ist, muss sie idempotent + additiv sein.

**Manueller Trigger:** In GitHub → Actions → `Publish Container` → `Run workflow`.

## Health Checks
- API: `GET http://<host>:3000/health`
- Postgres: `pg_isready -U memp -d memp`
- Redis: `redis-cli ping`
- Queue-Backlog: `redis-cli LLEN bull:reminders:wait` (und analog für weitere Queues)

## Kritische Metriken

| Metrik | Schwellwert | Reaktion |
|---|---|---|
| API P95 Latenz | > 2000 ms | Profiling, DB-Index prüfen |
| Queue-Backlog | > 1000 Jobs | Worker-Concurrency erhöhen |
| Versandfehler (Outlook) | > 5 % / h | Graph-API-Limit prüfen, Retry |
| Check-in-Latenz | > 500 ms | Redis-Health, DB-Last |
| Integrationsfehler | > 10 / h | M365-Status + Token-Ablauf |

## Backups
- **Postgres**: täglich via `pg_dump` → Hetzner Object Storage, 30 Tage Retention
- **Dokumente**: SharePoint (Microsoft Backup-Policy), bei S3-Fallback: S3 Versioning

Restore-Drill mindestens quartalsweise.

## Incident Response
1. Alert empfangen → Lage sichten (Grafana / Logs)
2. Betroffenheit einschätzen (aktiver Event am Tag?)
3. Fallback-to-Human aktivieren wenn kritisch (Check-in per Papierliste)
4. Ursache beheben, Post-mortem innerhalb 3 Arbeitstagen

## Secrets-Rotation
- JWT/Session-Secrets: quartalsweise
- Entra-Client-Secret: gemäß Ablauf in Entra (max. 24 Monate)
- Postgres-Passwort: jährlich
