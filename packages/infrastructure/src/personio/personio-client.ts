import { rootLogger } from "@mexp/shared";
import {
  PersonioAuthResponse,
  type PersonioEmployee,
  PersonioEmployeesResponse,
} from "./personio.types.js";

const log = rootLogger.child({ module: "infrastructure/personio" });

/**
 * Dünner HTTP-Client für die Personio-REST-API (v1): Auth-Token holen + cachen,
 * Employee-Liste abrufen. Bewusst zustandsbehaftet (Token-Cache pro Instanz) —
 * eine Instanz pro Prozess reicht (siehe admin-personio.ts: pro Sync-Request neu
 * gebaut, das ist bei einem Sync alle paar Minuten/Tage unkritisch).
 */
export class PersonioClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly baseUrl: string,
  ) {}

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const res = await fetch(`${this.baseUrl}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret }),
    });
    if (!res.ok) throw new Error(`Personio auth failed: ${res.status}`);
    const parsed = PersonioAuthResponse.parse(await res.json());
    this.token = parsed.data.token;
    this.tokenExpiresAt = Date.now() + 23 * 3600 * 1000; // Token gilt ~24h; 23h zur Sicherheit
    log.info("personio auth OK");
    return this.token;
  }

  async listEmployees(): Promise<PersonioEmployee[]> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/company/employees`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Personio employees list failed: ${res.status}`);
    const parsed = PersonioEmployeesResponse.parse(await res.json());
    log.info({ count: parsed.data.length }, "personio employees fetched");
    return parsed.data.map((d) => d.attributes);
  }
}
