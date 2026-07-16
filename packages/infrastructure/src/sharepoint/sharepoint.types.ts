/**
 * Zod-Schemas für die Microsoft-Graph-API (SharePoint-Liste, App-only via
 * Client-Credentials-Flow). Anders als bei Personio kennen wir die exakten Spalten
 * der Ziel-Liste NICHT im Voraus — `fields` bleibt daher bewusst `z.record(z.unknown())`
 * statt eines starren Schemas. Die Extraktion der semantischen Felder (Name, E-Mail, ...)
 * passiert tolerant in sharepoint-client.ts über eine Kandidaten-Fallback-Kette.
 */
import { z } from "zod";

export const GraphTokenResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  token_type: z.literal("Bearer"),
});

export const GraphSiteResponse = z.object({
  id: z.string(), // "hostname,siteGuid,webGuid"
  displayName: z.string().optional(),
});

// SharePoint fields sind ein Objekt mit beliebigen Keys (Spalten der Liste).
// Wir bleiben tolerant — der Client extrahiert dann per Fallback-Kette (siehe unten).
export const GraphListItem = z.object({
  id: z.string(),
  fields: z.record(z.unknown()),
});

export const GraphListItemsResponse = z.object({
  value: z.array(GraphListItem),
  "@odata.nextLink": z.string().optional(),
});

export interface StudiRecord {
  id: string; // SharePoint item-id
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  email: string | null;
  position: string | null;
  team: string | null;
  endDate: string | null; // ISO oder null
  rawFields: Record<string, unknown>; // für Debug + spätere Erweiterungen
}
