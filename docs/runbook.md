# Runbook

Betriebshandbuch für mEMP. Zielgruppe: DevOps / On-Call.

## Deployment

```bash
# Docker-Image bauen und deployen
TAG=0.1.0 docker compose -f docker/docker-compose.yaml build
TAG=0.1.0 docker compose -f docker/docker-compose.yaml up -d
```

Rollback: `TAG=<vorherige-version> docker compose up -d`.

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
