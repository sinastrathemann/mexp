# Feedback-Runde 1: Anmeldung & Fragen — Design

Datum: 2026-10-23 · Status: freigegeben · Branch: `feat/feedback-anmeldung`

## Anlass

Tester-Feedback zu Event-Anlage, Anmelde-Formular und Anmeldung. Sieben Punkte, alle in einem Branch, ein Commit pro Punkt.

## 1. Größeres Beschreibungsfeld

- Betrifft das Beschreibungsfeld in `event-create.tsx` und `event-edit-modal.tsx`.
- Startet mit 6 Zeilen, wächst automatisch mit dem Inhalt bis ca. 20 Zeilen, danach scrollt das Feld.
- Manuell vertikal vergrößerbar (`resize: vertical`).
- Umsetzung als kleine wiederverwendbare Komponente `AutoGrowTextarea` (passt `height` an `scrollHeight` an).

## 2. Uhrzeit offen

- Neue Checkbox „Uhrzeit steht noch nicht fest“ beim Anlegen und Bearbeiten.
- Ist sie gesetzt, werden statt `datetime-local` nur `date`-Felder für Start und Ende angezeigt.
- Neues Event-Feld `timeTbd: boolean` (Default `false`) in DTO, API-Schema und Persistenz. `startAt`/`endAt` werden auf 00:00 Uhr lokale Zeit gesetzt; Persistiert wird `timeTbd` wie `registrationDeadline` im bestehenden Event-Store (Datei-Modus); das Drizzle-Schema bleibt unverändert.
- Anzeige: Ein zentraler Formatter `formatEventDate(event)` liefert bei `timeTbd` nur das Datum plus „· Uhrzeit folgt“ (EN: „· time to be announced“). Alle Stellen, die Event-Start/-Ende formatieren (Liste, Detail, Startseite, Banner, Anmeldefenster), nutzen ihn.
- ICS: Bei `timeTbd` Ganztags-Termin (`DTSTART;VALUE=DATE:YYYYMMDD`, `DTEND;VALUE=DATE` = Enddatum + 1 Tag).
- Haken entfernen und Uhrzeit nachtragen geht über „Bearbeiten“.

## 3. Leere Frage anlegen

- Im Bereich „Schnell hinzufügen“ des Anmelde-Formular-Editors neue Gruppe „Eigene Frage“ mit Buttons: Einfachauswahl, Mehrfachauswahl, Ja/Nein, Terminabstimmung.
- Neue Frage: leerer Fragetext, `required: false`; Einfach-/Mehrfachauswahl mit zwei leeren Optionen, Terminabstimmung mit einem leeren Slot, Ja/Nein ohne Optionen.
- Die bestehende Client-Validierung verhindert das Speichern unvollständiger Fragen.

## 4. Option „Andere“ mit Freitext

- Neues optionales Fragefeld `allowOther?: boolean`, nur für `single_choice` und `multi_choice` wirksam. Editor: Haken „‚Andere‘ mit Freitext erlauben“.
- Neues optionales Antwortfeld `otherText?: string | null` in `RegistrationAnswer`.
- Teilnehmer-Ansicht: zusätzliche Auswahl „Andere:“ mit Textfeld.
  - Einfachauswahl: Wahl von „Andere“ setzt `value` auf `null` und speichert den Text in `otherText`.
  - Mehrfachauswahl: `value` enthält die festen Optionen, `otherText` den Zusatztext.
  - Wer „Andere“ wählt, muss Text eingeben (Client- und Server-Validierung).
  - Pflichtfrage gilt als beantwortet, wenn eine Option gewählt **oder** `otherText` gefüllt ist.
- Server: `otherText` nur erlaubt, wenn die Frage `allowOther` hat; max. 200 Zeichen, getrimmt.
- Anzeige in Teilnehmerliste, Export (CSV/Excel) und Auswertung: „Andere: <Text>“ (bei Mehrfachauswahl an die übrigen Werte angehängt).

## 5. Eventinfos im Anmeldefenster

- `RegistrationModal` bekommt statt `eventTitle` das Event (bzw. Titel, Datum/Uhrzeit, Ort, Beschreibung) und zeigt oben einen Infoblock.
- Beschreibung auf ca. 5 Zeilen begrenzt, „Mehr anzeigen“ klappt auf. Zeilenumbrüche bleiben erhalten.
- Gilt auch für die Vorschau im Formular-Editor. Im Admin-Bearbeiten-Modus (fremde Anmeldung) entfällt der Infoblock.

## 6. Anmeldefenster im sichtbaren Bereich

- Erst Ursache bestätigen (Verdacht: übergeordnetes Element mit `transform`/Animation macht `position: fixed` relativ zum Container).
- Fix: Modal per React-Portal an `document.body` rendern, damit es immer mittig im Viewport erscheint; zusätzlich Fokus auf das Modal.

## 7. Eigene Anmeldung bearbeiten

- Button „Angaben ändern“ für Personen mit Status `registered` oder `waitlisted`, solange Event-Status `open` und Anmeldefrist nicht abgelaufen.
- Öffnet das Anmeldefenster (Modus `self-edit`) mit bisherigen Antworten und Notiz.
- Neuer Endpunkt `PATCH /events/:id/my-registration` (Body: `answers`, `personalNote`). Gleiche Antwort-Validierung wie `POST /:id/register`. Status und Wartelistenplatz bleiben unverändert.
- Fehler: 404 ohne eigene aktive Anmeldung; 409 `REGISTRATION_CLOSED`, wenn Status ≠ `open` oder Frist abgelaufen.
- Der Hinweis „Änderungen nur über Abmelden“ wird nur angezeigt, wenn Bearbeiten nicht (mehr) möglich ist.

## Tests

- API: `timeTbd` round-trip, ICS-Ganztagstermin, `allowOther`/`otherText`-Validierung (erlaubt, verboten, Pflicht-Text), Self-Edit (Erfolg, geschlossen, Frist abgelaufen, nicht angemeldet, Warteliste behält Position).
- Web: Formatter `formatEventDate`, `RegistrationModal` (Infoblock, „Andere“-Logik, Pflichtprüfung), Editor-Buttons „Eigene Frage“.

## Nicht im Umfang

- Datum komplett optional (Event ohne Termin).
- Freitext an beliebigen einzelnen Optionen.
- Bearbeiten nach Ende der Anmeldefrist durch Teilnehmende.
