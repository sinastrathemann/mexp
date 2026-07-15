import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getHubUser, hubAuthMiddleware } from "../src/hub-middleware.js";

describe("hubAuthMiddleware", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.AUTH_MODE = "hub";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 when X-MSQ-User-Id is missing in hub mode", async () => {
    const app = new Hono();
    app.use("*", hubAuthMiddleware());
    app.get("/x", (c) => c.text("ok"));

    const res = await app.request("/x");
    expect(res.status).toBe(401);
  });

  it("passes when X-MSQ-User-Id is present and populates user", async () => {
    const app = new Hono();
    app.use("*", hubAuthMiddleware());
    app.get("/x", (c) => {
      const u = getHubUser(c);
      return c.json({ id: u.id, roles: u.roles, isHubAdmin: u.isHubAdmin });
    });

    const res = await app.request("/x", {
      headers: {
        "X-MSQ-User-Id": "user-1",
        "X-MSQ-User-Email": "max@mindsquare.de",
        "X-MSQ-User-Name": "Max",
        "X-MSQ-Roles": "Marketing,AppHub.Admin",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "user-1", roles: ["Marketing", "AppHub.Admin"], isHubAdmin: true });
  });

  it("flags guest requests", async () => {
    const app = new Hono();
    app.use("*", hubAuthMiddleware());
    app.get("/x", (c) => c.json({ isGuest: getHubUser(c).isGuest }));

    const res = await app.request("/x", {
      headers: { "X-MSQ-User-Id": "guest-abc", "X-MSQ-Guest": "true" },
    });
    expect(await res.json()).toEqual({ isGuest: true });
  });
});
