import { describe, expect, it } from "vitest";

// Requires the API to be running (`pnpm dev:api`) with AUTH_MODE=hub against
// http://localhost:3000. Not part of the default `pnpm test` run — set
// RUN_INTEGRATION=1 to opt in, e.g.:
//   RUN_INTEGRATION=1 pnpm --filter @memp/api exec vitest run tests/integration/auth-flow.test.ts
describe.skipIf(!process.env.RUN_INTEGRATION)("API auth flow (integration)", () => {
  it("health returns 200 without auth headers", async () => {
    const res = await fetch("http://localhost:3000/health");
    expect(res.status).toBe(200);
  });

  it("events returns 401 without X-MSQ-User-Id in hub mode", async () => {
    const res = await fetch("http://localhost:3000/events");
    expect(res.status).toBe(401);
  });

  it("events returns 200 with X-MSQ headers", async () => {
    const res = await fetch("http://localhost:3000/events", {
      headers: {
        "X-MSQ-User-Id": "test-user",
        "X-MSQ-User-Email": "test@mindsquare.de",
        "X-MSQ-Roles": "AppHub.Admin",
      },
    });
    expect(res.status).toBe(200);
  });
});
