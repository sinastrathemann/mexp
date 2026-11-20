/** Trennt ausgewählte Dateien in hochladbare und zu große (Runde 6, Mehrfach-Upload). */
export function partitionBySize(files: File[], maxBytes: number): { ok: File[]; tooLarge: File[] } {
  return {
    ok: files.filter((f) => f.size <= maxBytes),
    tooLarge: files.filter((f) => f.size > maxBytes),
  };
}

/** Neue Auswahl an die bisherige anhängen, gleiche Datei (Name + Größe) nur einmal. */
export function mergeFiles(current: File[], added: File[]): File[] {
  const key = (f: File) => `${f.name}|${f.size}`;
  const seen = new Set(current.map(key));
  return [...current, ...added.filter((f) => !seen.has(key(f)))];
}
