import { describe, expect, it } from "vitest";
import { mergeFiles, partitionBySize } from "./doc-upload-utils";

const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

describe("Mehrfach-Upload", () => {
  it("trennt zu große Dateien ab", () => {
    const r = partitionBySize([file("a.pdf", 5), file("b.pdf", 11), file("c.pdf", 10)], 10);
    expect(r.ok.map((f) => f.name)).toEqual(["a.pdf", "c.pdf"]);
    expect(r.tooLarge.map((f) => f.name)).toEqual(["b.pdf"]);
  });

  it("hängt neue Auswahl an, ohne Doppelte", () => {
    const merged = mergeFiles([file("a.pdf", 5)], [file("a.pdf", 5), file("b.pdf", 3)]);
    expect(merged.map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
  });
});
