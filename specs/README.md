# Spezifikation & Prozessdiagramme

Alle Diagramme als Mermaid (`.mmd`) neben dem Code im Git versioniert.

## Übersicht

| Diagramm | Datei | Beschreibung |
|---|---|---|
| Haupt-Workflow | `workflows/event-lifecycle.mmd` | Event-Lifecycle von Anlage bis Abschluss |
| Check-in Flow | `workflows/checkin.mmd` | QR-basierter Check-in-Ablauf |
| Freigabe | `workflows/approval.mmd` | Budget- und Event-Freigabe |
| API ↔ M365 | `sequences/m365-integration.mmd` | Outlook, Teams, SharePoint, Graph |
| Auth Flow | `sequences/auth-oidc.mmd` | Entra ID OIDC Login |
| Event States | `states/event-states.mmd` | Entwurf → Freigabe → Live → Abschluss |
| Participation States | `states/participation-states.mmd` | Eingeladen → Angemeldet → Check-in → No-Show |
| Domänenmodell | `domain/entities.mmd` | Entitäten und Beziehungen |

## Konventionen

- Dateiendung: `.mmd`
- Kommentar-Header pro Datei: Zweck, Datum, Autor
- Flowcharts: Top-Down (`TD`)
- Sequenzdiagramme: Systemnamen in PascalCase
- Max. 30 Knoten pro Diagramm — sonst aufteilen
- Komplexe Gesamtarchitektur: draw.io/Excalidraw → SVG-Export

Die Diagramme werden aus `mEMP-Doku.md` und `docs/architecture.md` referenziert, nicht eingebettet.
