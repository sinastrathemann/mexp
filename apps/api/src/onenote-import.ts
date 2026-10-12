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
  title: string;
  eventType: EventType;
  startAt: string;
  endAt: string;
  location: string;
};

const eventSourcePages: EventSourceEntry[] = [
  {
    title: "Agritechnica 2026",
    eventType: "local_experience",
    startAt: "2026-11-09T08:00:00.000Z",
    endAt: "2026-11-15T17:00:00.000Z",
    location: "Messegelände Hannover",
  },
];

export function buildOneNoteImportedEvents(): OneNoteImportedEvent[] {
  const now = new Date().toISOString();

  return eventSourcePages
    .filter(({ endAt }) => new Date(endAt).getTime() > Date.now())
    .map(({ title, eventType, startAt, endAt, location }, index) => {
      return {
        id: `onenote-${eventType}-${index + 1}`,
        title,
        description: "Import aus Sina @ mindsquare AG / Temine 2026 in OneNote.",
        eventType,
        visibility: "internal",
        status: "planned",
        startAt,
        endAt,
        location: location ?? "mindsquare / nach Vereinbarung",
        capacity: null,
        ownerId: "onenote-import",
        createdAt: now,
        updatedAt: now,
      };
    });
}
