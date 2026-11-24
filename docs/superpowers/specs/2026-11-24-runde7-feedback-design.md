# Feedback-Runde 7 (Julian, Punkt 16, 19.11.2026) – Design

Kleine Änderung, Sina hat Weg A gewählt („bau erstmal, verbessern beim Testen“).

## Ziele
1. **Teilnehmerliste auf Laptop-Bildschirmen**: Person und Zusatzangaben gleichzeitig sehen, ohne Zoomen und ohne Scrollbalken ganz unten.
2. **Infos pro Aufgabe (wie OneNote-Spalte „Infos“)**: Hinweise, Textbausteine (Terminupdate, Reminder), Zwischenstände pro To-do festhalten – für Selbstorga, Übergabe bei Ausfall und Orientierung an ähnlichen Events.
3. **Feedback-Link kopieren**: wie Anmeldelink; Link öffnet das Event und springt zum Feedback-Formular. Button oben im Kopf und unten im Feedback-Bereich.

## Nicht-Ziele
- Keine eigene Notiz-Seite mit festen Abschnitten (Weg B) und kein freies Großnotizfeld (Weg C).
- Kosten bleiben im Budget-Bereich. Jahresplanung/OneNote-Import bleibt zurückgestellt.

## Harte Randbedingung (Live-Daten)
Kein bestehendes Event, keine bestehende Aufgabe und keine Vorlage wird umgeschrieben: kein Backfill, keine Migration. Neue Felder sind optional, beim Lesen gilt `null`, gespeichert wird nur bei aktiver Änderung.

## Ansätze
- **A – Info-Feld pro Aufgabe (gewählt):** passt 1:1 zur OneNote-Logik (To-do + Infos), nutzt Vorlagen und Duplizieren mit.
- B – Eigener Notizbereich mit festen Abschnitten: doppelt zu den Aufgaben.
- C – Ein freies Notizfeld pro Event: schnell gebaut, aber nicht vergleichbar und ohne Struktur für die Übergabe.

## Design
**1 Teilnehmerliste:** Der Tabellen-Container bekommt `max-height` (≈ Bildschirmhöhe minus Kopf), dadurch ist der horizontale Scrollbalken immer sichtbar. Kopfzeile `position: sticky; top: 0`, Namensspalte `position: sticky; left: 0` mit Hintergrund.

**2 Infos:**
- `EventTask.info?: string | null` und `BlueprintTask.info?: string | null` (mehrzeilig, max. 5000 Zeichen).
- API: `withTaskDefaults` liefert `info: null`, wenn das Feld fehlt; Erstellen und Ändern nehmen `info` optional an.
- Vorlage → Event: `copyBlueprintTasksToEvent` übernimmt `info`. Duplizieren übernimmt `info` automatisch (Spread in `copyEventExtras`).
- UI Checkliste: Aufgaben mit Infos zeigen ein Info-Symbol. Aufklappen zeigt den Text, im Bearbeiten-Formular gibt es ein mehrzeiliges Feld „Infos“. Vorlagen-Editor bekommt dasselbe Feld.

**3 Feedback-Link:** URL `/events/:id?feedback=1`. Das Feedback-Panel scrollt bei diesem Parameter zu sich und entfernt ihn danach (wie `?anmelden=1`). Der Button „Feedback-Link kopieren“ erscheint nur für Team-Rollen und nur, wenn Feedback möglich ist (Status „Laufend“ oder „Abgeschlossen“), oben neben dem Anmeldelink und im Feedback-Panel.

## Dem Builder überlassen
Genaue Max-Höhe, Symbol und Texte, Platzierung des Info-Felds im Formular.
