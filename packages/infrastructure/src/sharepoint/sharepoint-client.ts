import { rootLogger } from "@mexp/shared";
import {
  GraphListItemsResponse,
  GraphSiteResponse,
  GraphTokenResponse,
  type StudiRecord,
} from "./sharepoint.types.js";

const log = rootLogger.child({ module: "infrastructure/sharepoint" });

/**
 * Field-Mapping: mögliche SharePoint-Spalten-Namen für jede semantische Rolle,
 * in Priorität. Der Client probiert der Reihe nach und nimmt den ersten Treffer
 * mit nicht-leerem Wert. Toleranter Ansatz weil wir die exakten Spalten-Namen
 * der Ziel-Liste nicht kennen — Sina justiert per Log-Report nach (siehe
 * docs/sharepoint-integration.md, Abschnitt "Post-Sync-Debug").
 */
const FIELD_CANDIDATES = {
  firstName: ["Vorname", "FirstName", "First_x0020_Name", "field_1"],
  lastName: ["Nachname", "LastName", "Last_x0020_Name", "field_2"],
  displayName: ["Title", "LinkTitle", "Name", "field_3"],
  email: ["EMail", "Email", "E_x002d_Mail", "E-Mail", "Mail", "field_4"],
  position: ["Position", "Rolle", "Typ", "Art", "Bereich"],
  team: ["Team", "Abteilung", "Bereich"],
  endDate: ["EndDatum", "Vertragsende", "Ende", "EndDate", "Bis"],
};

function extractField(fields: Record<string, unknown>, candidates: string[]): string | null {
  for (const key of candidates) {
    const v = fields[key];
    if (v !== null && v !== undefined && v !== "") {
      return typeof v === "string" ? v : String(v);
    }
  }
  return null;
}

/**
 * Dünner HTTP-Client für Microsoft Graph (App-only, Client-Credentials-Flow):
 * Token holen + cachen, Site-Id auflösen, Listen-Items paginiert abrufen.
 * Bewusst zustandsbehaftet (Token-Cache pro Instanz) — eine Instanz pro Sync-Request
 * reicht (siehe admin-sharepoint.ts), das ist bei einem manuellen Sync unkritisch.
 */
export class SharePointClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly tenantId: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly siteUrl: string, // https://<hostname>/sites/<path>
    private readonly listId: string,
  ) {}

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Azure token fetch failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const parsed = GraphTokenResponse.parse(await res.json());
    this.token = parsed.access_token;
    this.tokenExpiresAt = Date.now() + (parsed.expires_in - 300) * 1000; // 5min Puffer
    log.info("azure token OK");
    return this.token;
  }

  private async resolveSiteId(): Promise<string> {
    const token = await this.getToken();
    // siteUrl parsen: "https://<hostname>/sites/<path>" → "<hostname>:/sites/<path>"
    const u = new URL(this.siteUrl);
    const graphPath = `${u.hostname}:${u.pathname}`;
    const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${graphPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph site lookup failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const parsed = GraphSiteResponse.parse(await res.json());
    return parsed.id;
  }

  async listStudis(): Promise<StudiRecord[]> {
    const token = await this.getToken();
    const siteId = await this.resolveSiteId();
    const items: StudiRecord[] = [];
    let nextUrl: string | undefined =
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${this.listId}/items?expand=fields&$top=200`;

    while (nextUrl) {
      const res: Response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Graph list items failed: ${res.status} ${text.slice(0, 200)}`);
      }
      const parsed = GraphListItemsResponse.parse(await res.json());
      for (const item of parsed.value) {
        const fields = item.fields;
        const firstName = extractField(fields, FIELD_CANDIDATES.firstName);
        const lastName = extractField(fields, FIELD_CANDIDATES.lastName);
        const displayName =
          extractField(fields, FIELD_CANDIDATES.displayName) ??
          ([firstName, lastName].filter(Boolean).join(" ") || "(unbenannt)");
        items.push({
          id: item.id,
          firstName,
          lastName,
          displayName,
          email: extractField(fields, FIELD_CANDIDATES.email),
          position: extractField(fields, FIELD_CANDIDATES.position),
          team: extractField(fields, FIELD_CANDIDATES.team),
          endDate: extractField(fields, FIELD_CANDIDATES.endDate),
          rawFields: fields,
        });
      }
      nextUrl = parsed["@odata.nextLink"];
    }
    log.info({ count: items.length }, "sharepoint studis fetched");
    return items;
  }
}
