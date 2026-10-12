import type { EventType } from "@mexp/domain";

export interface OneNoteImportedEvent {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  visibility: "internal";
  status: "planned" | "open" | "draft";
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

type EventSourceEntry = {
  id: string;
  title: string;
  eventType: EventType;
  status: "planned";
  startAt: string;
  endAt: string;
  location: string | null;
  source: string;
};

const eventSourcePages: EventSourceEntry[] = [
  {
    id: "onenote-team-teamevent-ki-20261013",
    title: "Teamevent KI",
    eventType: "team",
    status: "planned",
    startAt: "2026-10-13T16:30:00.000Z",
    endAt: "2026-10-13T20:00:00.000Z",
    location: "Eventcenter Dissen",
    source: "Personal_Mitarbeiter halten / Teamevents",
  },
  {
    id: "onenote-team-kochstudio-poeschel-20261013",
    title: "Kochstudio Pöschel",
    eventType: "team",
    status: "planned",
    startAt: "2026-10-13T16:30:00.000Z",
    endAt: "2026-10-13T21:00:00.000Z",
    location: "Kochstudio Pöschel",
    source: "Young Professional Programm / 2026_Oktober",
  },
  {
    id: "onenote-team-coworking-koeln-20261014",
    title: "Coworking Köln",
    eventType: "team",
    status: "planned",
    startAt: "2026-10-14T14:00:00.000Z",
    endAt: "2026-10-14T18:00:00.000Z",
    location: "STARTPLATZ Köln, Raum Alicante",
    source: "Personal_Mitarbeiter halten / Teamevents",
  },
  {
    id: "onenote-team-ca-abendessen-20261015",
    title: "CA-Abendessen",
    eventType: "team",
    status: "planned",
    startAt: "2026-10-15T16:30:00.000Z",
    endAt: "2026-10-15T20:00:00.000Z",
    location: null,
    source: "Young Professional Programm / 2026_Oktober",
  },
  {
    id: "onenote-team-zertifeier-20261029",
    title: "Zertifeier",
    eventType: "team",
    status: "planned",
    startAt: "2026-10-29T17:30:00.000Z",
    endAt: "2026-10-29T21:00:00.000Z",
    location: null,
    source: "Young Professional Programm / 2026_Oktober",
  },
  {
    id: "onenote-division-prolo-20261109",
    title: "Kundensegmentevent IT für ProLo",
    eventType: "division",
    status: "planned",
    startAt: "2026-11-09T08:00:00.000Z",
    endAt: "2026-11-13T16:00:00.000Z",
    location: "Bielefelder Büro",
    source: "Personal_Mitarbeiter halten / Teamevents",
  },
  {
    id: "onenote-team-topgolf-20261112",
    title: "TopGolf",
    eventType: "team",
    status: "planned",
    startAt: "2026-11-12T18:00:00.000Z",
    endAt: "2026-11-12T21:00:00.000Z",
    location: "TopGolf",
    source: "Young Professional Programm / 2026_Oktober",
  },
  {
    id: "onenote-division-security-20261116",
    title: "Teamevent IT für IT PU Security",
    eventType: "division",
    status: "planned",
    startAt: "2026-11-16T08:00:00.000Z",
    endAt: "2026-11-18T16:00:00.000Z",
    location: "Villa Hermine, Goslar-Hahnenklee",
    source: "Personal_Mitarbeiter halten / Teamevents",
  },
  {
    id: "onenote-team-mainova-20261201",
    title: "Projektteam-Event bei Mainova",
    eventType: "team",
    status: "planned",
    startAt: "2026-12-01T08:00:00.000Z",
    endAt: "2026-12-02T17:00:00.000Z",
    location: "WoodCutter Frankfurt",
    source: "Personal_Mitarbeiter halten / Teamevents",
  },
  {
    id: "onenote-team-cocktailworkshop-20270122",
    title: "Cocktail Workshop",
    eventType: "team",
    status: "planned",
    startAt: "2027-01-22T18:00:00.000Z",
    endAt: "2027-01-22T22:00:00.000Z",
    location: null,
    source: "Young Professional Programm / 2026_Oktober",
  },
  {
    id: "onenote-team-coworking-emden-20270531",
    title: "Coworking HR Service Emden",
    eventType: "team",
    status: "planned",
    startAt: "2027-05-31T07:00:00.000Z",
    endAt: "2027-06-04T15:00:00.000Z",
    location: "Emden",
    source: "Personal_Mitarbeiter halten / Teamevents",
  },
];

export function buildOneNoteImportedEvents(): OneNoteImportedEvent[] {
  const now = new Date().toISOString();
  const berlinDateKey = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = new Map(parts.map(({ type, value }) => [type, value]));
    return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
  };
  const today = berlinDateKey(new Date());

  return eventSourcePages
    .filter(
      ({ startAt, status }) => status === "planned" && berlinDateKey(new Date(startAt)) >= today,
    )
    .map(({ id, title, eventType, status, startAt, endAt, location, source }) => {
      return {
        id,
        title,
        description: `Geplanter OneNote-Termin aus ${source}.`,
        eventType,
        visibility: "internal",
        status,
        startAt,
        endAt,
        location,
        capacity: null,
        ownerId: "onenote-import",
        createdAt: now,
        updatedAt: now,
      };
    });
}
