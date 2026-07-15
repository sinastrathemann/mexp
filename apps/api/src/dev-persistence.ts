/**
 * Persistente Map-Stores als JSON auf Disk — die MVP-Persistenz-Schicht
 * (Design-Spec §3.4: Postgres ist Follow-up).
 * Pfad: $MEMP_DATA_DIR/<name>.json, falls gesetzt (Container: benanntes Volume,
 * siehe `docker/Dockerfile` `ENV MEMP_DATA_DIR=/app/data` + `VOLUME /app/data`).
 * Fällt lokal (Dev, kein MEMP_DATA_DIR gesetzt) zurück auf <api>/data/<name>.json,
 * damit Daten bei tsx-watch-Neustarts erhalten bleiben.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dirRoot = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env["MEMP_DATA_DIR"] || join(dirRoot, "..", "data");

function ensureDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function pathFor(name: string): string {
  return join(dataDir, `${name}.json`);
}

export function loadJson<T>(name: string, fallback: T): T {
  try {
    ensureDir();
    const file = pathFor(name);
    if (!existsSync(file)) return fallback;
    const raw = readFileSync(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(name: string, value: unknown): void {
  try {
    ensureDir();
    writeFileSync(pathFor(name), JSON.stringify(value, null, 2), "utf-8");
  } catch {
    // Persistenz-Fehler dürfen den Request nicht killen
  }
}

/**
 * Wrappt eine Map<string, T>, schreibt automatisch nach jedem set/delete.
 */
export function persistentMap<T>(name: string): Map<string, T> {
  const initial = loadJson<[string, T][]>(name, []);
  const map = new Map<string, T>(initial);

  const originalSet = map.set.bind(map);
  const originalDelete = map.delete.bind(map);
  const originalClear = map.clear.bind(map);

  map.set = (key, value) => {
    const r = originalSet(key, value);
    saveJson(name, Array.from(map.entries()));
    return r;
  };
  map.delete = (key) => {
    const r = originalDelete(key);
    saveJson(name, Array.from(map.entries()));
    return r;
  };
  map.clear = () => {
    originalClear();
    saveJson(name, []);
  };

  return map;
}
