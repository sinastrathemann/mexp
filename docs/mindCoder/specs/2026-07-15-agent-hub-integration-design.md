# Design: mEMP → Agent-Hub-Integration + Container-Autopublish

- **Datum:** 2026-07-15
- **Autor:** Sina Strathemann (mit mindCoder)
- **Status:** Draft — wartet auf User-Approval
- **Related plans:** `docs/mindCoder/plans/2026-07-15-agent-hub-integration.md` (folgt nach Approval)

## 1 · Ziel

mEMP wird vom aktuellen Hetzner-First-Design auf einen **mindsquare Agent Hub Managed Agent** umgestellt. Konkret:

1. mEMP läuft als **ein Container-Image**, das der Hub startet/stoppt/rollbacked
2. **Authentifizierung entfällt in mEMP** — Identität kommt aus `X-MSQ-*`-Headern
3. **CI/CD automatisiert das Image-Publishing** nach `ghcr.io/sinastrathemann/memp`
4. **Repo-Struktur mindCoder-konform** — `docs/mindCoder/specs|plans/`

Terminal-Zustand: Ein Push auf `main` produziert ein neues GHCR-Package. Der Hub-Admin trägt den Image-Ref ein → mEMP läuft unter `https://<hub-domain>/memp/`.

## 2 · Nicht-Ziele (bewusst ausgeklammert)

- **Postgres-Migration** — bleibt Follow-up. Persistenz weiter über `apps/api/data/*.json`, aber in einem Docker-Volume.
- **M365 Mail/Calendar-Versand** — separater Brainstorm (war der ursprüngliche `/brainstorm`-Topic, wurde durch diesen Ask verdrängt)
- **KI-/LLM-Anbindung** — Phase 4 laut CLAUDE.md, nicht Teil dieses Umbaus
- **Salesforce-Capability** — mEMP braucht kein SF, deshalb A.1.8 nicht relevant
- **MCP-Server-Modus** — mEMP ist ein Web-Frontend, kein MCP-Agent

## 3 · Architektur-Änderungen

### 3.1 · Container-Architektur — Ein Node-Prozess

Ein einziger Hono-Prozess bedient alles:

```
Container (EXPOSE 3000)
├── Hono-Router
│   ├── GET /health           (unauth, immer 200)
│   ├── /events, /budget, /tenders, …  (API-Routes, auth via Middleware)
│   └── /*                    (Fallback: serveStatic aus apps/web/dist/)
└── Volume: /app/data         (persistentMap-JSONs)
```

- **Node.js 22**, `hono` + `@hono/node-server`
- Vite-Build (`apps/web/dist/`) wird beim Docker-Build in `/app/web-dist/` kopiert
- Hono `serveStatic({ root: "/app/web-dist" })` fängt alle nicht-API-Routes
- SPA-Fallback: für Requests ohne Dateiendung → `index.html`
- `index.html` wird mit `Cache-Control: no-cache, must-revalidate` ausgeliefert (A.2.7)
- `assets/*` mit `Cache-Control: public, max-age=31536000, immutable` (Vite-Hash-Assets)

**Verworfen:** Nginx-Sidecar, getrennte Container. Ein Prozess reicht, Rollback ist atomarer, CI ist simpler.

### 3.2 · Auth-Umbau

**Raus:**
- `apps/web/src/pages/login.tsx`
- `apps/api/src/routes/auth.ts` — Login/Logout/Password-Reset-Endpoints
- Cookie-Session-Middleware
- Passwort-Speicherung im User-Store
- Admin-UI-Passwort-Reset

**Neu:** `packages/auth/src/hub-middleware.ts`

```
Für jeden Request:
  1. Header lesen: X-MSQ-User-Id, -Email, -Name, -Roles, -Groups, -Guest
  2. Wenn User-Id fehlt UND AUTH_MODE=hub → 401
  3. Wenn AUTH_MODE=dev-bypass → Default-User aus config/dev-user.yaml injizieren
  4. Guest-Requests (X-MSQ-Guest=true): nur Read-Only-Routes
  5. User-Objekt an Context anhängen → c.set("user", …)
  6. mEMP-interne Rollen aus mEMP-DB via User-Id auflösen (siehe 3.3)
```

**Dev-Bypass-Fail-Safe:**
```typescript
const authMode =
  process.env.AUTH_MODE === "hub" || process.env.AUTH_MODE === "dev-bypass"
    ? process.env.AUTH_MODE
    : process.env.NODE_ENV === "production"
      ? "hub"            // Default in Prod: closed
      : "dev-bypass";    // Default lokal: open
```

**Logout-Link:** `apps/web/src/*` verlinkt `/auth/logout` — der Hub übernimmt.

**Waffle-Menü:** `apps/web/index.html` bekommt `<script src="/embed/waffle.js" defer></script>` in `<head>`. Same-Origin gegen Hub, kein CSS-Leak (Shadow DOM). Feedback-Button ist damit automatisch drin.

### 3.3 · Rollen-Modell — mEMP-eigene DB, X-MSQ-User-Id als FK

Hub-Header → mEMP-Rolle:

| Hub-Signal | mEMP-Interpretation |
|---|---|
| `X-MSQ-Roles` enthält `AppHub.Admin` | mEMP-Admin (Superuser, kann alles) |
| Sonstige Entra-App-Roles im Header | **ignoriert** (kein Mapping) |
| `X-MSQ-User-Id` unbekannt in mEMP-DB | Auto-Registrierung als `participant` |
| `X-MSQ-User-Id` bekannt | Rollen aus mEMP-User-Tabelle (`roles: string[]`) |

**Neuer Endpoint:** `POST /users/:id/roles` und `DELETE /users/:id/roles/:role` — bereits vorhanden für interne Rollen (`admin`, `manager`, `event_office`, `budget_owner`, `werkstudent`, `participant`), bleibt unverändert. Nur der Login-Weg dahin ist neu.

**AppHub.Admin-User** haben automatisch mEMP-`admin`-Rechte, unabhängig von der mEMP-DB — Hub-Signal ist authoritativ.

### 3.4 · Persistenz — JSON-Files im Volume

Aktuell: `persistentMap()` schreibt nach `apps/api/data/*.json` (in Repo-Struktur relativ zu API-Prozess-CWD).

**Änderung:**
- Path-Konstante: `DATA_DIR = process.env.MEMP_DATA_DIR ?? "/app/data"`
- Dockerfile: `VOLUME /app/data` — Hub schlägt bei Onboarding automatisch `appdata-memp-data` vor
- Lokal (Dev): `MEMP_DATA_DIR=./apps/api/data` in `.env`
- Wenn Verzeichnis nicht existiert: einmalig anlegen beim API-Start

Postgres kommt in einem späteren Spec — Drizzle-Schemas existieren bereits in `packages/infrastructure/`, sind aber ungenutzt.

### 3.5 · Reserved-Path-Check

Vertrag A.2.1: Hub strippt `/memp/`, meine App sieht Pfade ohne Prefix. Also:

| Aktueller mEMP-Pfad | Public via Hub | Von Hub gestrippt zu | Konflikt? |
|---|---|---|---|
| `/events` | `/memp/events` | `/events` | ✅ frei |
| `/budget` | `/memp/budget` | `/budget` | ✅ frei |
| `/health` | `/memp/health` | `/health` | ✅ **Pflicht** |
| `/auth/*` | (entfällt) | — | Login-Form entfernt |
| `/admin/users` | `/memp/admin/users` | `/admin/users` | ✅ frei (intern, nicht Hub-`/admin/`) |
| `/embed/*` | — | — | ✅ nicht in mEMP verwendet |
| `/assets/*` | `/memp/assets/*` | `/assets/*` | Vite-Assets, OK |

Der Hub-`/embed/waffle.js` wird per **absolutem Pfad** (`<script src="/embed/waffle.js">`) vom Browser direkt gegen die Hub-Origin geladen, nicht durch mEMP.

### 3.6 · Dockerfile — Neustruktur

Multi-Stage:

```dockerfile
# Stage 1: build web
FROM node:22-alpine AS web-builder
WORKDIR /build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
RUN corepack enable && pnpm install --frozen-lockfile --filter @memp/web...
RUN pnpm --filter @memp/web build

# Stage 2: build api
FROM node:22-alpine AS api-builder
WORKDIR /build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @memp/api build

# Stage 3: runtime
FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY --from=api-builder /build/apps/api/dist ./dist
COPY --from=api-builder /build/apps/api/package.json ./
COPY --from=api-builder /build/node_modules ./node_modules
COPY --from=web-builder /build/apps/web/dist ./web-dist
COPY .env.example /app/.env.example
COPY config/ ./config/

ENV NODE_ENV=production
ENV AUTH_MODE=hub
ENV MEMP_DATA_DIR=/app/data
ENV PORT=3000

VOLUME /app/data
EXPOSE 3000

LABEL org.opencontainers.image.title="mEMP" \
      org.opencontainers.image.description="mindsquare Event Management Platform" \
      org.opencontainers.image.vendor="mindsquare AG" \
      org.opencontainers.image.source="https://github.com/sinastrathemann/memp" \
      org.opencontainers.image.documentation="https://github.com/sinastrathemann/memp/blob/main/README.md" \
      org.opencontainers.image.licenses="proprietary" \
      de.mindsquare.agenthub.category="hr" \
      de.mindsquare.agenthub.brand="memp" \
      de.mindsquare.agenthub.capabilities="events,budget,tender,reporting"

CMD ["node", "dist/index.js"]
```

**Wichtig:** `org.opencontainers.image.version` wird nicht im Dockerfile hardcoded, sondern via `--build-arg` aus dem GitHub-Workflow gesetzt (`ARG APP_VERSION` + `LABEL org.opencontainers.image.version="$APP_VERSION"`).

### 3.7 · Vite-Config

`apps/web/vite.config.ts`:

```typescript
export default defineConfig({
  base: "./",  // relative Asset-Pfade — Hub-Sub-Path-safe
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
  // …
});
```

Vite generiert content-gehashte Assets in `assets/`, `index.html` referenziert relativ. Hono's `serveStatic` liefert alles korrekt aus.

## 4 · CI/CD — Auto-Publish

### 4.1 · `.github/workflows/publish-container.yml`

```yaml
name: Publish Container

on:
  push:
    branches: [main]
    tags: ["v*"]
  workflow_dispatch:

permissions:
  contents: read
  packages: write
  id-token: write   # für Provenance

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/sinastrathemann/memp
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,format=short
            type=semver,pattern={{version}}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            APP_VERSION=${{ steps.meta.outputs.version }}
          platforms: linux/amd64
          provenance: true
          sbom: true
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 4.2 · `.github/workflows/ci.yml`

Auf PRs:
- `pnpm install --frozen-lockfile`
- `pnpm -r typecheck`
- `pnpm lint`
- `pnpm -r test` (falls Tests existieren)

### 4.3 · Container-Package-Sichtbarkeit

Nach dem ersten erfolgreichen Push wird das Package unter `github.com/users/sinastrathemann/packages/container/memp` liegen. **Muss auf `public` oder auf `private mit Hub-Credentials` gestellt werden** — Hub-Operator entscheidet, ob er GHCR-Credentials in "Git-Hosts" hinterlegt oder wir das Package öffentlich machen. → im Runbook dokumentieren.

## 5 · Dokumentations-Updates

- **`README.md`** — komplette Neufassung mit dem Container-Block (A.1.6 Pflicht):
  ```
  ## Container
  - 📦 Package: https://github.com/sinastrathemann/memp/pkgs/container/memp
  - Image-Ref:
    ```
    ghcr.io/sinastrathemann/memp:latest
    ```
  ```
- **`CLAUDE.md`** — "Hetzner-Deployment" ersetzen durch "Agent-Hub-Deployment", Auth-Sektion aktualisieren
- **`docs/agent-hub-integration.md`** (NEU) — dokumentiert Env-Variablen, Volumes, Registrierungs-Werte für Step F (Registration Summary)
- **`docs/runbook.md`** — Deploy-Kapitel: "Push auf main → Hub-Admin trägt neuen `sha-xxx`-Tag ein oder wartet auf `:latest`"

## 6 · Definition of Done (nach Vertrag A.5)

Verifikations-Kriterien, die vor "fertig" grün sein müssen:

- [ ] Container startet lokal via `docker run` mit `AUTH_MODE=dev-bypass`
- [ ] `curl http://localhost:3000/health` → `200 OK` ohne Auth
- [ ] `curl -H "X-MSQ-User-Id: <uuid>" -H "X-MSQ-Roles: AppHub.Admin" http://localhost:3000/events` → 200 mit Events
- [ ] `curl http://localhost:3000/events` ohne Header + `AUTH_MODE=hub` → `401`
- [ ] SPA-Root `/` liefert `index.html` mit `Cache-Control: no-cache, must-revalidate`
- [ ] `/assets/index-*.js` liefert `Cache-Control: public, max-age=31536000, immutable`
- [ ] `index.html` enthält `<script src="/embed/waffle.js" defer>`
- [ ] Volume-Test: `docker run -v memp-test:/app/data`, Event anlegen, Container neu → Event überlebt
- [ ] `docker image inspect` zeigt OCI-Labels + `de.mindsquare.agenthub.category="hr"`
- [ ] `docker image inspect` findet `.env.example` unter `/app/.env.example`
- [ ] `EXPOSE 3000` im Image
- [ ] GitHub-Workflow läuft grün, Package sichtbar unter GHCR
- [ ] README enthält den Container-Block mit Package-Link + Image-Ref
- [ ] Alte Login-Seite ist nicht mehr erreichbar (404 oder redirect)
- [ ] `apps/api/src/routes/auth.ts` gelöscht bzw. auf `/me`-Endpoint reduziert

## 7 · Hub-Registrierungs-Summary (Step F, für den späteren Deploy)

Nach erfolgreichem Push ist folgender Block für den Hub-Admin bereit:

```
Hub-Registrierung für mEMP
═══════════════════════════════════════════

Anzeigename:    mEMP — Event Management
Slug:           memp
Beschreibung:   mindsquare Event Management Platform — Events, Budget, Anmeldungen, Reporting
Icon:           📅
Kategorie:      hr

Image-Ref:      ghcr.io/sinastrathemann/memp:latest
Container-Port: 3000 (aus EXPOSE)
Health-Pfad:    /health

Zugriff:        alle angemeldeten Mitarbeiter der mindsquare AG

Env-Variablen:
  NODE_ENV=production
  AUTH_MODE=hub
  MEMP_DATA_DIR=/app/data
  TZ=Europe/Berlin

Volumes:
  appdata-memp-data=/app/data

Timeout:        30s (Standard)
Body-Limit:     50 MB (Standard; ausreichend für PDF-Rechnungs-Uploads)

Salesforce-Integration: nein
```

## 8 · Rollout-Reihenfolge (grob — Details im Plan)

1. `.github/workflows/publish-container.yml` + `ci.yml` schreiben (funktioniert erst ab Dockerfile-Umbau)
2. `packages/auth/` Rewrite: X-MSQ-Middleware + Dev-Bypass
3. `apps/api/src/index.ts`: Middleware einhängen, `/auth/*` entfernen, `/health` unauth, `serveStatic` fürs Web
4. `apps/web/`: Login-Page löschen, Vite-Base auf `./`, Waffle-Script einbauen, Logout auf `/auth/logout` linken
5. Dockerfile Multi-Stage neu schreiben mit EXPOSE + LABEL + VOLUME
6. `.env.example` und README aktualisieren
7. Push auf `main` → verifizieren dass Workflow grün ist und Package erscheint
8. Lokaler Smoke-Test des gepullten Images mit fake X-MSQ-Headern
9. Hub-Registrierungs-Summary an Hub-Admin

## 9 · Offene Risiken

- **Hub-Operator-Absprache:** Der GHCR-Owner ist aktuell `sinastrathemann` (privater GitHub-Account). Der Hub-Operator muss einen Git-Host für `ghcr.io` mit einem PAT konfigurieren, oder das Package wird auf `public` gestellt.
- **Dev-Onboarding wird invasiver:** Ohne Login-Seite muss der Dev-Bypass-User in Config gepflegt sein. Sina kann nicht mehr "einloggen als Max Mustermann" — sie ändert `config/dev-user.yaml` und startet den API neu (oder wir bauen ein UI-Switch dahinter — separater Spec).
- **Migration bestehender Passwort-basierter User:** Die aktuellen Test-User (`sina@mindsquare.de` + Passwort) sind obsolet. Neue User werden via Entra-ID SSO durchgeschleust und auto-registriert.
- **Volumes und lokales `apps/api/data/`:** Bestehende JSON-Files (Event-Overrides etc.) sind wertvolle Test-Daten. Migrationsschritt: `docker cp` von `./apps/api/data/*.json` in das benannte Volume nach dem ersten Hub-Start.
