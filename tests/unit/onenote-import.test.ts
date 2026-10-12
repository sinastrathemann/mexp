import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOneNoteImportedEvents } from "../../apps/api/src/onenote-import.js";

describe("OneNote event import", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("imports only the confirmed upcoming event from the current OneNote event plan", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
    const events = buildOneNoteImportedEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "onenote-local_experience-1",
      title: "Agritechnica 2026",
      eventType: "local_experience",
      status: "planned",
      visibility: "internal",
      startAt: "2026-11-09T08:00:00.000Z",
      endAt: "2026-11-15T17:00:00.000Z",
      location: "Messegelände Hannover",
    });
  });

  it("omits imported events after their end date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T00:00:00.000Z"));

    expect(buildOneNoteImportedEvents()).toEqual([]);
  });
});
