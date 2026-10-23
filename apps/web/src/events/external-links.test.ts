import { describe, expect, it } from "vitest";
import { BUDGET_TOOL_URL, isBudgetToolUrl } from "./external-links";

describe("isBudgetToolUrl", () => {
  it("erkennt den Budget-Link mit und ohne Schrägstrich am Ende", () => {
    expect(isBudgetToolUrl(BUDGET_TOOL_URL)).toBe(true);
    expect(isBudgetToolUrl("https://personal-hub.mindsquare.de/budget-control-agent")).toBe(true);
  });
  it("lässt andere Tools durch", () => {
    expect(isBudgetToolUrl("https://personal-hub.mindsquare.de/coworking-copilot/")).toBe(false);
  });
});
