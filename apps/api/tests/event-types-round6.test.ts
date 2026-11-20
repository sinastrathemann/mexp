import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_TYPES } from "@mexp/domain";
import { describe, expect, it } from "vitest";

const localesDir = join(import.meta.dirname, "..", "..", "web", "src", "locales");
const load = (lang: string) =>
  JSON.parse(readFileSync(join(localesDir, `${lang}.json`), "utf8")) as {
    events: { type: Record<string, string> };
  };

describe("Eventtypen (Runde 6)", () => {
  it("enthält Top-Management-Zirkel und Management-Zirkel", () => {
    expect(EVENT_TYPES).toContain("top_management_circle");
    expect(EVENT_TYPES).toContain("management_circle");
  });

  it.each(["de", "en"])("Locale %s hat ein Label für jeden Typ", (lang) => {
    const labels = load(lang).events.type;
    for (const type of EVENT_TYPES) expect(labels[type], type).toBeTruthy();
  });
});
