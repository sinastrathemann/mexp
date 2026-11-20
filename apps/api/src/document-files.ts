import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dataDirPath } from "./dev-persistence.js";

/**
 * Ablage der hochgeladenen Dokument-Dateien (Feedback-Runde 6, Punkt 13).
 * Aktuell im Hub-Volume ($MEXP_DATA_DIR/documents/<fileId>), bewusst hinter dieser
 * Schnittstelle gekapselt, damit ein späterer Umzug nach SharePoint die Routen und
 * die Oberfläche nicht berührt. Achtung: Für das Volume gibt es kein Backup.
 */
export interface DocumentFileStore {
  save(fileId: string, data: Uint8Array): void;
  read(fileId: string): Buffer | null;
  remove(fileId: string): void;
}

// Nur UUIDs als Dateiname — nie Nutzereingaben in Pfade übernehmen
const SAFE_ID = /^[0-9a-f-]{36}$/;

function pathFor(fileId: string): string {
  if (!SAFE_ID.test(fileId)) throw new Error("Ungültige Datei-ID");
  return dataDirPath("documents", fileId);
}

export const volumeDocumentFileStore: DocumentFileStore = {
  save(fileId, data) {
    mkdirSync(dataDirPath("documents"), { recursive: true });
    writeFileSync(pathFor(fileId), data);
  },
  read(fileId) {
    const p = pathFor(fileId);
    return existsSync(p) ? readFileSync(p) : null;
  },
  remove(fileId) {
    rmSync(pathFor(fileId), { force: true });
  },
};
