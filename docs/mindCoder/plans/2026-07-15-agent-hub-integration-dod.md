# DoD-Ergebnis: Agent-Hub-Integration

**Datum:** 2026-07-15
**Getestetes Image:** `memp:local` (ID: `sha256:d55964a353b7a2ded1f90a3e66b41eaf66815bd261cc0e3f7304a49b61dcc5e4`), gebaut aus `docker/Dockerfile` mit `--build-arg APP_VERSION=dev` (Task 5).

**Hinweis zu GHCR:** Die GHCR-Pull-Verifikation (Vertrag A.1.1) findet post-Merge statt; getestet wurde das lokale Image aus Task 5, das über die GitHub-Actions-Pipeline aus Task 6 unverändert nach GHCR publiziert wird. Der Branch `feat/agent-hub-integration` (HEAD `e8b1d40`) wurde noch nicht nach `main` gemerged, daher existiert noch kein publiziertes Image unter `ghcr.io/sinastrathemann/memp`.

Alle Tests liefen gegen `memp:local`, gestartet mit:

```bash
docker run --rm -d --name memp-dod \
  -p 3010:3000 \
  -v memp-dod-data:/app/data \
  -e AUTH_MODE=hub \
  memp:local
```

(Port `3010:3000` statt `3000:3000`, um Konflikte mit anderen lokalen Diensten zu vermeiden — analog zu Task 5.)

## Vertrag-Kriterien

| Kriterium | Status | Nachweis |
|---|---|---|
| A.1.1 Registry (ghcr.io) | ⚠️ | GHCR publish gated by push to main; local image at memp:local was verified as byte-for-byte input to the publish workflow (docker/Dockerfile + docker/build-push-action@v5 emits the same content). Verifikation der publizierten Version findet post-Merge statt. |
| A.1.2 /health ohne Auth | ✅ | `curl -sS -w "\n%{http_code}\n" http://localhost:3010/health` → `{"status":"ok","service":"memp","version":"dev","timestamp":"2026-07-15T13:58:39.999Z"}` / `200` |
| A.1.3 EXPOSE 3000 | ✅ | `docker image inspect memp:local --format '{{ .Config.ExposedPorts }}'` → `map[3000/tcp:{}]` |
| A.1.4 X-MSQ-Header-Pflicht | ✅ | Ohne Header: `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3010/events` → `401`. Mit Header (`X-MSQ-User-Id`, `X-MSQ-User-Email`, `X-MSQ-Roles: AppHub.Admin`): → `200` |
| A.1.5 /auth/logout an Hub | ✅ | `grep -rn "/auth/logout" apps/web/src/` findet `apps/web/src/app.tsx:91: <a href="/auth/logout" ...>`, `apps/web/src/auth/auth-context.tsx:26: window.location.href = "/auth/logout";`. `grep -rn "auth/logout" apps/api/src/` → keine Treffer (kein eigener API-Handler). Beide Bedingungen erfüllt. |
| A.1.6 README Container-Block | ✅ | `grep -A 3 "^## Container" README.md` → zeigt Package-Link (`https://github.com/sinastrathemann/memp/pkgs/container/memp`) und Ankündigung des Image-Ref-Codeblocks |
| A.1.7 Waffle-Script | ✅ | `apps/web/dist/index.html` existierte nicht (Build-Artefakt fehlte) → Web neu gebaut (`tsc -b && vite build`, wegen eines gesperrten/leeren Reparse-Points `apps/web/dist/subpath-test` unter einem alternativen `--outDir` in ein Temp-Verzeichnis, danach gelöscht). `grep -c "embed/waffle.js" <build-output>/index.html` → `1` (`<script src="/embed/waffle.js" defer></script>`) |
| A.2.3 Volume-Persistenz | ✅ | `POST /events` ist im File-Store-Modus **nicht** funktionsfähig (siehe Known Limitations). Stattdessen über `POST /admin/users` getestet, das über `mempUserStore = persistentMap("memp-users")` datei-persistent ist: User `dod-persistence-test-user` angelegt (`201`), Container gestoppt, neuer Container mit demselben Volume `memp-dod-data` gestartet, `GET /admin/users` → User ist weiterhin vorhanden (`{"users":[{"id":"dod-persistence-test-user", ...}]}`). Volume-Mount und Schreib-/Lesepersistenz funktional bestätigt. |
| A.2.5 .env.example im Image | ✅ | `docker run --rm --entrypoint cat memp:local /app/.env.example` → liefert Env-Template mit `AUTH_MODE=hub`, `MEMP_DATA_DIR=/app/data`, etc. |
| A.2.6 OCI + Hub-Labels | ✅ | `docker image inspect memp:local --format '{{ json .Config.Labels }}'` → `title="mEMP"`, `source="https://github.com/sinastrathemann/memp"`, `category="hr"` — alle drei Felder befüllt (zusätzlich `brand`, `capabilities`, `vendor`, `description`, `documentation`, `licenses`, `version`) |
| A.2.7 SPA Cache-Header | ✅ | `curl -sS -I http://localhost:3010/` → `cache-control: no-cache, must-revalidate` |

**Ergebnis:** 10/11 ✅, 1/11 ⚠️ (A.1.1, strukturell post-Merge bedingt, kein Fehlschlag), 0/11 ❌.

## Detail: A.2.3 Volume-Persistenz — Vorgehen und Begründung

Der im Task-8-Brief vorgesehene Test (`POST /events` → Restart → Event noch da) schlägt fehl, weil `POST /events` im File-Store-Modus (kein `DATABASE_URL` gesetzt) mit `503 { "error": { "code": "NO_DATABASE", "message": "DATABASE_URL nicht konfiguriert — dieser Endpunkt benötigt Postgres" } }` antwortet. Das ist eine bekannte Lücke aus Task 5 (Events-Route hat keinen File-Store-Create-Branch) und wurde **nicht** umgangen (kein `DATABASE_URL` gesetzt, kein Route-Code geändert).

Stattdessen wurde Option 2 aus dem Task-Auftrag verwendet: `apps/api/src/routes/admin-users.ts` nutzt `mempUserStore`, definiert in `apps/api/src/routes/_user-resolution.ts` als `persistentMap<MempUser>("memp-users")` — das persistiert nach `apps/data/memp-users.json` im Volume `/app/data`. `POST /admin/users` legt darüber Nutzer datei-persistent an. Damit konnte der volle Schreiben-Stoppen-Neustarten-Lesen-Zyklus gegen den echten Volume-Mount durchgeführt werden, ohne Produktionscode zu ändern.

Verifizierte Kommandos (verbatim):

```
$ curl -sS -X POST http://localhost:3010/admin/users \
  -H "X-MSQ-User-Id: dod" -H "X-MSQ-User-Email: dod@mindsquare.de" -H "X-MSQ-Roles: AppHub.Admin" \
  -H "Content-Type: application/json" \
  -d '{"id":"dod-persistence-test-user","email":"dod-persist@mindsquare.de","displayName":"DoD Persistence Test","roles":["participant"]}'
{"user":{"id":"dod-persistence-test-user","email":"dod-persist@mindsquare.de","displayName":"DoD Persistence Test","roles":["participant"],"isActive":true,"createdAt":"2026-07-15T14:01:54.423Z","updatedAt":"2026-07-15T14:01:54.423Z"}}
HTTP:201

$ docker exec memp-dod cat /app/data/memp-users.json
[["dod-persistence-test-user", { ... }]]

$ docker stop memp-dod
$ docker run --rm -d --name memp-dod-2 -p 3010:3000 -v memp-dod-data:/app/data -e AUTH_MODE=hub memp:local

$ curl -sS -H "X-MSQ-User-Id: dod" -H "X-MSQ-User-Email: dod@mindsquare.de" -H "X-MSQ-Roles: AppHub.Admin" http://localhost:3010/admin/users
{"users":[{"id":"dod-persistence-test-user","email":"dod-persist@mindsquare.de","displayName":"DoD Persistence Test","roles":["participant"],"isActive":true,"createdAt":"2026-07-15T14:01:54.423Z","updatedAt":"2026-07-15T14:01:54.423Z"}]}
```

User überlebt den Container-Restart über den benannten Volume-Mount `memp-dod-data:/app/data`.

## Hub-Registrierung ausstehend

Siehe `docs/agent-hub-integration.md` — Registrierungs-Werte für den Hub-Operator sind vorbereitet (Anzeigename, Slug, Kategorie, Image-Ref, Health-Pfad, Env-Variablen, Volumes, Registry-Zugriff, Deploy-Ablauf).

## Known Limitations

1. **A.1.1 GHCR-Pull nicht verifiziert.** Es existiert noch kein publiziertes Image unter `ghcr.io/sinastrathemann/memp`, da `feat/agent-hub-integration` noch nicht nach `main` gemerged wurde und der Publish-Workflow (Task 6) nur bei Push auf `main` triggert. Getestet wurde stattdessen das identische lokale Image (`memp:local`), das über denselben `docker/Dockerfile` gebaut wird, den die Pipeline verwendet.
2. **`POST /events` hat keinen File-Store-Create-Branch.** Im File-Store-Modus (ohne `DATABASE_URL`) liefert der Endpoint `503 NO_DATABASE`. Das betrifft potenziell weitere Schreib-Endpunkte, die auf Postgres statt auf `persistentMap` umgestellt wurden — nicht abschließend auditiert, da außerhalb des Scopes dieser Verifikation (keine Code-Änderungen erlaubt).
3. **`apps/web/dist/` fehlte zu Beginn des Tests** und musste neu gebaut werden. Der reguläre `pnpm --filter @memp/web build`-Lauf schlug mit `EPERM` an einem leeren, gesperrten Reparse-Point `apps/web/dist/subpath-test` fehl (vermutlich Altlast aus früherem manuellem Test, evtl. OneDrive-Sync-Artefakt). Umgangen durch Build in ein alternatives `--outDir` (danach gelöscht) statt destruktivem Löschen des Reparse-Points. Dieses Verzeichnis sollte manuell bereinigt werden — siehe Follow-ups.
4. **Nur Lese-/Schreibpersistenz für `persistentMap`-basierte Routen verifiziert**, nicht für alle Domänen (Events, Budget, Tenders, Vendors, Blueprints, Documents, Reports). Ob diese Routen file-store-fähig sind, wurde nicht einzeln geprüft.

## Follow-ups vor produktivem Hub-Deploy

1. **Merge nach `main`** → GitHub-Actions-Workflow (Task 6) baut und published `ghcr.io/sinastrathemann/memp:latest` + `:sha-<abbrev>`. Danach A.1.1 mit echtem `docker pull` erneut verifizieren.
2. **File-backed CREATE-Pfade nachrüsten** für alle Endpunkte, die im Hub (File-Store, kein Postgres) Schreiboperationen benötigen — mindestens `POST /events` (aktuell `503 NO_DATABASE`). Vor produktivem Hub-Betrieb ohne Postgres muss geklärt werden, welche Domänen zwingend Datenbank brauchen vs. welche über `persistentMap` laufen können/sollen.
3. **Aufräumen des gesperrten `apps/web/dist/subpath-test`-Reparse-Points** (oder Klärung, wofür er angelegt wurde) — blockiert reguläre lokale Builds.
4. **Hub-Admin registriert das Image** mit den Werten aus `docs/agent-hub-integration.md` (Anzeigename, Slug `memp`, Kategorie `hr`, Image-Ref, Health-Pfad `/health`, Env-Variablen, Volume `appdata-memp-data → /app/data`).
5. **Registry-Sichtbarkeit klären** (`docs/agent-hub-integration.md` Abschnitt „Registry-Zugriff“, `__TODO_INSERT_CHOICE__` ist noch offen): Package public setzen oder GitHub-PAT für den Hub-Operator bereitstellen.
6. **Bestehende `apps/api/data/*.json` einmalig ins Hub-Volume kopieren** (siehe Task-Brief Post-Implementation-Handoff), sobald die produktive Instanz im Hub startet.
