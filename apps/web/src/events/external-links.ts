// Fest verdrahtet (Spec): der Budget-Kasten soll nicht kaputtgehen, wenn jemand
// den Eintrag aus der Tools-Liste löscht.
export const BUDGET_TOOL_URL = "https://personal-hub.mindsquare.de/budget-control-agent/";

const withoutTrailingSlash = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();

/** Zeigt der Link auf das Budget-Tool? Dann gehört er in den Budget-Kasten, nicht zu den Tools. */
export function isBudgetToolUrl(url: string): boolean {
  return withoutTrailingSlash(url) === withoutTrailingSlash(BUDGET_TOOL_URL);
}
