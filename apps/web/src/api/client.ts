import { withBasePath } from "../base-path";

export interface ApiError {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, body: { error?: ApiError } | string) {
    const msg =
      typeof body === "object" && body?.error?.message ? body.error.message : `HTTP ${status}`;
    super(msg);
    this.status = status;
    this.code = typeof body === "object" && body?.error?.code ? body.error.code : "UNKNOWN";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // withBasePath ist Pflicht, nicht Kosmetik: hinter dem Agent Hub liegt die App
  // unter /<slug>/, und wurzel-absolute /api/*-Aufrufe landen sonst bei der
  // Hub-eigenen API (reservierter Pfad laut Hub-Vertrag) statt bei mEXP.
  const url = withBasePath(path.startsWith("/api") ? path : `/api${path}`);
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    throw new ApiRequestError(res.status, body as { error?: ApiError } | string);
  }
  return body as T;
}

/**
 * Datei-Upload (multipart) — ohne JSON-Content-Type, damit der Browser die
 * Boundary setzt. Fehlerantworten ohne JSON (z. B. 413 vom Proxy) werden abgefangen.
 */
export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const url = withBasePath(path.startsWith("/api") ? path : `/api${path}`);
  const res = await fetch(url, { method: "POST", body, credentials: "include" });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new ApiRequestError(res.status, parsed as { error?: ApiError } | string);
  }
  return parsed as T;
}

/** URL einer Datei-Ressource der API (z. B. Dokument öffnen) inkl. Basispfad. */
export function apiUrl(path: string): string {
  return withBasePath(path.startsWith("/api") ? path : `/api${path}`);
}
