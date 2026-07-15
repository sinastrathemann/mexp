/**
 * Dev-Mode: Persistente Map-Stores als JSON auf Disk.
 * Damit gehen Daten bei tsx-watch Neustarts NICHT verloren.
 * Pfad: <api>/data/<name>.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dirRoot = dirname(fileURLToPath(import.meta.url));
const dataDir = join(dirRoot, "..", "data");

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
