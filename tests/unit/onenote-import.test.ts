import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOneNoteImportedEvents } from "../../apps/api/src/onenote-import.js";

describe("OneNote event import", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("imports only planned employee events from today onward", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
    const events = buildOneNoteImportedEvents();

    expect(events).toHaveLength(11);
    expect(events.map((event) => event.title)).toEqual([
      "Teamevent KI",
      "Kochstudio Pöschel",
      "Coworking Köln",
      "CA-Abendessen",
      "Zertifeier",
      "Kundensegmentevent IT für ProLo",
      "TopGolf",
      "Teamevent IT für IT PU Security",
      "Projektteam-Event bei Mainova",
      "Cocktail Workshop",
      "Coworking HR Service Emden",
    ]);
    expect(events[0]).toMatchObject({
      id: "onenote-team-teamevent-ki-20261013",
      title: "Teamevent KI",
      eventType: "team",
      status: "planned",
      visibility: "internal",
      startAt: "2026-10-13T16:30:00.000Z",
      location: "Eventcenter Dissen",
    });
    expect(events.some((event) => /jobhub|chance osnabrück/i.test(event.title))).toBe(false);
  });

  it("omits imported events after their end date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-06-05T00:00:00.000Z"));

    expect(buildOneNoteImportedEvents()).toEqual([]);
  });
});
