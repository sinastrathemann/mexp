import { MexpError } from "@mexp/shared";

export class DocumentNotFoundError extends MexpError {
  constructor(id: string) {
    super("DOCUMENT_NOT_FOUND", "Dokument nicht gefunden", 404, { id });
  }
}

export class DocumentFileTooLargeError extends MexpError {
  constructor(size: number, max: number) {
    super("DOCUMENT_FILE_TOO_LARGE", `Datei zu groß (${size} > ${max} Bytes)`, 413, {
      size,
      max,
    });
  }
}
