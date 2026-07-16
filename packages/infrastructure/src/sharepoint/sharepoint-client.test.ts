import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SharePointClient } from "./sharepoint-client.js";

const TENANT_ID = "tenant-1";
const CLIENT_ID = "client-1";
const CLIENT_SECRET = "secret-1";
const SITE_URL = "https://mindsquare1.sharepoint.com/sites/fk/tl";
const LIST_ID = "c2364bea-6f17-4532-b1ca-ebd9dee40c13";
const SITE_ID = "mindsquare1.sharepoint.com,site-guid,web-guid";

function tokenBody(token = "tok-123", expiresIn = 3599) {
  return { access_token: token, expires_in: expiresIn, token_type: "Bearer" as const };
}

function siteBody(id = SITE_ID) {
  return { id, displayName: "fk/tl" };
}

function listItemsBody(
  items: Array<{ id: string; fields: Record<string, unknown> }>,
  nextLink?: string,
) {
  const body: Record<string, unknown> = { value: items };
  if (nextLink) body["@odata.nextLink"] = nextLink;
  return body;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SharePointClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("caches the auth token: two listStudis() calls only trigger one token request", async () => {
    fetchMock
      // call 1: token + site + items
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(jsonResponse(siteBody()))
      .mockResolvedValueOnce(jsonResponse(listItemsBody([])))
      // call 2: site (reused token) + items
      .mockResolvedValueOnce(jsonResponse(siteBody()))
      .mockResolvedValueOnce(jsonResponse(listItemsBody([])));

    const client = new SharePointClient(TENANT_ID, CLIENT_ID, CLIENT_SECRET, SITE_URL, LIST_ID);
    await client.listStudis();
    await client.listStudis();

    const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/oauth2/v2.0/token"),
    );
    expect(tokenCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(5); // 1x token + 2x site + 2x items
  });

  it("resolves the site-id again on every listStudis() call (repeated per instance)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(jsonResponse(siteBody()))
      .mockResolvedValueOnce(jsonResponse(listItemsBody([])))
      .mockResolvedValueOnce(jsonResponse(siteBody()))
      .mockResolvedValueOnce(jsonResponse(listItemsBody([])));

    const client = new SharePointClient(TENANT_ID, CLIENT_ID, CLIENT_SECRET, SITE_URL, LIST_ID);
    await client.listStudis();
    await client.listStudis();

    const siteCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith("https://graph.microsoft.com/v1.0/sites/mindsquare1.sharepoint.com:"),
    );
    expect(siteCalls).toHaveLength(2);
  });

  it("extracts fields via the fallback candidate chain (first non-empty wins)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(jsonResponse(siteBody()))
      .mockResolvedValueOnce(
        jsonResponse(
          listItemsBody([
            {
              id: "1",
              fields: {
                // "Vorname" missing entirely -> falls back to "FirstName"
                FirstName: "Sina",
                Nachname: "Strathemann",
                Title: "", // empty string -> skipped, falls back further
                Name: "Sina Strathemann (Studi)",
                EMail: "", // empty -> skip
                Email: "sina.studi@mindsquare.de",
                Position: "Werkstudentin",
                Team: "Marketing",
                EndDatum: "2026-12-31",
              },
            },
          ]),
        ),
      );

    const client = new SharePointClient(TENANT_ID, CLIENT_ID, CLIENT_SECRET, SITE_URL, LIST_ID);
    const studis = await client.listStudis();

    expect(studis).toHaveLength(1);
    expect(studis[0]).toMatchObject({
      id: "1",
      firstName: "Sina",
      lastName: "Strathemann",
      displayName: "Sina Strathemann (Studi)",
      email: "sina.studi@mindsquare.de",
      position: "Werkstudentin",
      team: "Marketing",
      endDate: "2026-12-31",
    });
  });

  it("falls back to first+last name joined when no display-name candidate matches", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(jsonResponse(siteBody()))
      .mockResolvedValueOnce(
        jsonResponse(
          listItemsBody([
            {
              id: "2",
              fields: {
                Vorname: "Tobias",
                Nachname: "Muster",
                Email: "tobias@mindsquare.de",
              },
            },
          ]),
        ),
      );

    const client = new SharePointClient(TENANT_ID, CLIENT_ID, CLIENT_SECRET, SITE_URL, LIST_ID);
    const studis = await client.listStudis();

    expect(studis[0]?.displayName).toBe("Tobias Muster");
  });

  it("follows @odata.nextLink pagination until exhausted", async () => {
    const page2Url =
      "https://graph.microsoft.com/v1.0/sites/x/lists/y/items?expand=fields&$top=200&$skiptoken=abc";

    fetchMock
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(jsonResponse(siteBody()))
      .mockResolvedValueOnce(
        jsonResponse(
          listItemsBody(
            [{ id: "1", fields: { Title: "Erste Seite", Email: "a@mindsquare.de" } }],
            page2Url,
          ),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          listItemsBody([{ id: "2", fields: { Title: "Zweite Seite", Email: "b@mindsquare.de" } }]),
        ),
      );

    const client = new SharePointClient(TENANT_ID, CLIENT_ID, CLIENT_SECRET, SITE_URL, LIST_ID);
    const studis = await client.listStudis();

    expect(studis).toHaveLength(2);
    expect(studis.map((s) => s.id)).toEqual(["1", "2"]);
    const secondPageCall = fetchMock.mock.calls.find(([url]) => String(url) === page2Url);
    expect(secondPageCall).toBeDefined();
  });

  it("throws when the token request fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid_client" }, 401));

    const client = new SharePointClient(TENANT_ID, CLIENT_ID, "bad-secret", SITE_URL, LIST_ID);
    await expect(client.listStudis()).rejects.toThrow(/Azure token fetch failed: 401/);
  });

  it("throws when the site lookup fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404));

    const client = new SharePointClient(TENANT_ID, CLIENT_ID, CLIENT_SECRET, SITE_URL, LIST_ID);
    await expect(client.listStudis()).rejects.toThrow(/Graph site lookup failed: 404/);
  });
});
