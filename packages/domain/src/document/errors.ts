import { MempError } from "@memp/shared";

export class DocumentNotFoundError extends MempError {
  constructor(id: string) {
    super("DOCUMENT_NOT_FOUND", "Dokument nicht gefunden", 404, { id });
  }
}

export class DocumentFileTooLargeError extends MempError {
  constructor(size: number, max: number) {
    super("DOCUMENT_FILE_TOO_LARGE", `Datei zu groß (${size} > ${max} Bytes)`, 413, {
      size,
      max,
    });
  }
}
