/**
 * Zod-Schemas für die Personio-REST-API (v1). Jedes Standard-Attribut kommt als
 * Wrapper-Objekt `{ value: ... }` zurück (siehe Personio-API-Doku) — die Schemas hier
 * entpacken das direkt auf den Nutzwert, damit Call-Sites (personio-client.ts,
 * admin-personio.ts) keine `.value`-Zugriffe mehr brauchen.
 */
import { z } from "zod";

const attrString = z.object({ value: z.string().nullable() }).transform((v) => v.value);

// Nested-Attribute (department, office): { value: { attributes: { name: { value: "IT" } } } | null }
const attrNested = z
  .object({
    value: z.object({ attributes: z.object({ name: attrString }) }).nullable(),
  })
  .transform((v) => (v.value ? v.value.attributes.name : null));

// Manche Attribute fehlen im Personio-Response komplett, statt als `{value: null}`
// geliefert zu werden (z.B. wenn ein Employee kein Department hat). `.optional()`
// erlaubt das fehlende Feld im Input; der nachgelagerte `.transform` normalisiert
// ein fehlendes Feld auf `null` im Output. Bewusst KEIN `.default(null)` hier: Zods
// `.default()` erwartet den *Input*-Typ des inneren Schemas (das Wrapper-Objekt),
// nicht den *Output*-Typ nach dem `.transform` oben — `null` würde dort nicht passen.
function optionalOrNull<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional().transform((v) => v ?? null);
}

export const PersonioAuthResponse = z.object({
  success: z.boolean(),
  data: z.object({ token: z.string() }),
});

export const PersonioEmployeeAttributes = z.object({
  id: z.object({ value: z.number() }).transform((v) => String(v.value)),
  first_name: attrString,
  last_name: attrString,
  email: attrString,
  status: attrString,
  employment_type: optionalOrNull(attrString),
  department: optionalOrNull(attrNested),
  position: optionalOrNull(attrString),
  office: optionalOrNull(attrNested),
  hire_date: optionalOrNull(z.object({ value: z.string().nullable() }).transform((v) => v.value)),
});

export const PersonioEmployeesResponse = z.object({
  success: z.boolean(),
  data: z.array(
    z.object({
      type: z.literal("Employee"),
      attributes: PersonioEmployeeAttributes,
    }),
  ),
});

export type PersonioEmployee = z.infer<typeof PersonioEmployeeAttributes>;
