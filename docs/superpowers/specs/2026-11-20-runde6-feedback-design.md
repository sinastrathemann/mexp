# Feedback-Runde 6 – Design (Punkte 11–15)

Stand: 2026-11-20 · Feedback von Mareike (18./19.11.), abgestimmt mit Sina.
Punkt 10 (Jahresplanung inkl. Import der echten Daten aus OneNote) ist **zurückgestellt** und kommt in einer eigenen Runde.

## Rahmen (gilt für alle Punkte)

- **Live-Daten:** Alle angelegten Events sind live. Bestehende Datensätze werden weder migriert noch umgeschrieben (kein Backfill).
  Neue Felder sind optional und werden beim Lesen mit einem Standardwert ergänzt. Gespeichert werden sie erst, wenn jemand sie aktiv setzt.
- Die Oberfläche ist zweisprachig (DE/EN), wie bisher.
- Rollen: Bearbeiten wie bisher nur für das Team (TEAM_ROLES). Die Sicht der Teilnehmenden bleibt, wie sie ist, außer bei Punkt 12.

## 11 – Neue Eventtypen

- `EVENT_TYPES` bekommt zwei weitere Werte: `top_management_circle` („Top-Management-Zirkel“) und `management_circle` („Management-Zirkel“). Die Labels gibt es auf DE und EN.
- Die Änderung ist rein additiv. Bestehende Events behalten ihren Typ.
  Vorlagen für Aufgaben (Blueprints) kann man auch für die neuen Typen anlegen.

## 12 – Folgefragen im Anmeldeformular (Aufklappen)

- **Teilnehmende:** Eine Folgefrage ist erst sichtbar, wenn die auslösende Frage passend beantwortet ist (z. B. „Teilnahme: Ja“). Bei einer anderen Antwort bleibt sie zugeklappt, ist kein Pflichtfeld und wird nicht gespeichert.
- **Team (Formular-Editor):** Pro Frage gibt es eine optionale Einstellung „Nur anzeigen, wenn …“. Dort wählt man die auslösende Frage und den Antwortwert. Als Auslöser zählen nur Auswahl- und Ja/Nein-Fragen, die weiter oben im Formular stehen.
- **Datenmodell:** Die Frage bekommt das optionale Feld `showIf: { questionId, equals }`. Fragen ohne `showIf` verhalten sich wie bisher, bestehende Formulare bleiben unverändert.
- **Server:** Die Validierung prüft Pflichtfelder nur bei sichtbaren Folgefragen. Antworten auf ausgeblendete Fragen werden verworfen.
- Ausgewertet wird nur eine Ebene direkt. Kettet man Bedingungen (A → B → C), funktioniert das transitiv: Ist B ausgeblendet, gilt B als unbeantwortet.

## 13 – Dokumente wirklich hochladen

- **Ablauf:** Man wählt eine Datei vom eigenen Rechner („Datei auswählen“ oder Drag & Drop). Name, Dateityp und Größe werden automatisch übernommen, die Sichtbarkeit wählt man wie bisher.
- In der Dokumentenliste ist der Name ein Link: Klick öffnet die Datei bzw. lädt sie herunter.
- **Speicherort:** Die Datei liegt im Hub-Volume unter `$MEXP_DATA_DIR/documents/<storageKey>`. Der Zugriff ist hinter einer Schnittstelle gekapselt (`DocumentFileStore`), damit später ein Umzug nach SharePoint ohne Umbau der Oberfläche möglich ist.
- **Berechtigung beim Download:** Es gilt dieselbe Sichtbarkeitsprüfung wie bei der Liste (`event_staff`, `participants`, `public`). Verträge stellt man also auf „nur Team“.
- **Grenze:** 25 MB pro Datei. Einschränkungen beim Dateityp gibt es nicht.
  Die Datei wird mit `Content-Disposition` ausgeliefert. Gängige Typen wie PDF und Bilder öffnen sich inline.
- **Bestehende Dokument-Einträge** (nur Metadaten, ohne Datei) bleiben unverändert. In der Liste erscheinen sie ohne Link, mit dem Hinweis „keine Datei“.
- Beim Löschen eines Dokuments wird auch die Datei gelöscht.
- **Risiko, Sina bekannt:** Für das Volume gibt es kein Backup. SharePoint ist der spätere Schritt.

## 14 – Aufgaben: „ab“-Datum

- Eine Aufgabe bekommt das optionale Feld `startDate` („ab“). Das bisherige `dueDate` („bis“) bleibt bestehen.
- Anzeige: „ab 12.03.“, „bis 15.03.“ oder „ab 12.03. – bis 15.03.“.
- Eine Aufgabe, deren „ab“-Datum noch nicht erreicht ist, wird als „noch nicht fällig“ gedimmt dargestellt. Das gilt als Vorschlag.
  Die Logik für „überfällig“ hängt weiterhin nur an `dueDate`.
- Aufgaben-Vorlagen (Blueprints) bekommen keine Änderung. Das gilt als Vorschlag, weil es für Vorlagen keine festen Kalenderdaten gibt.

## 15 – Event duplizieren

- In der Event-Detailansicht gibt es für das Team den Button „Event duplizieren“.
- **Übernommen werden:** Titel (mit Zusatz „(Kopie)“), Beschreibung, Typ, Sichtbarkeit, Ort, Art (Event/Projekt) samt Planungsfeldern, das Anmeldeformular mit seinen Fragen und alle Aufgaben. Bei den Aufgaben werden Status, Erledigt-Vermerk und Daten zurückgesetzt, Zuständige bleiben erhalten.
- **Nicht übernommen werden:** Datum, Anmeldungen, Teilnehmende, Dokumente und Audit-Einträge.
- Die Kopie entsteht als neues Event im Status Entwurf. Danach öffnet sich direkt die Bearbeitungsansicht, um das Datum zu setzen.
- Das Original-Event wird nur gelesen und nie verändert.

## Approaches (Dokumente, die einzige echte Weg-Entscheidung)

| Weg | Trade-off |
|---|---|
| A: nur Hub-Volume | schnell und ohne IT, aber ohne Backup |
| B: sofort SharePoint | Backup und gewohnte Ablage, braucht aber eine IT-App-Freigabe und verzögert |
| **C: A jetzt, B später (gewählt)** | sofort nutzbar; über die gekapselte Ablage ist der spätere Umzug ohne Oberflächen-Umbau möglich |

## Reihenfolge und Lieferung

1. Paket 1: 11 und 14, klein
2. Paket 2: 15, dann 12, dann 13

Jedes Paket bekommt Tests, Lint (LF-Check) und ein eigenes Image. Sina klickt danach im Hub „Update anwenden“.

## Offen für den Builder

- Wie Antworten auf Auswahlfragen genau gespeichert sind (Wert oder Label), entscheidet, womit `showIf.equals` verglichen wird. Das wird im Plan anhand des Codes festgelegt.
- Ob Uploads per Multipart oder als Roh-Body übertragen werden: Multipart, mit Hono `parseBody`.
