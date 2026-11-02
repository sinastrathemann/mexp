import { describe, expect, it } from "vitest";
import { isRichTextHtml, plainTextToHtml, richTextToPlain } from "./rich-text-utils";

describe("isRichTextHtml", () => {
  it("erkennt Editor-HTML", () => {
    expect(isRichTextHtml("<p>Hallo</p>")).toBe(true);
    expect(isRichTextHtml("<ul><li><p>a</p></li></ul>")).toBe(true);
  });

  it("behandelt Alt-Text als reinen Text", () => {
    expect(isRichTextHtml("Grillabend <3 mit Team")).toBe(false);
    expect(isRichTextHtml("")).toBe(false);
  });
});

describe("plainTextToHtml", () => {
  it("macht aus jeder Zeile einen Absatz und escaped HTML", () => {
    expect(plainTextToHtml("a <b>\nzweite")).toBe("<p>a &lt;b&gt;</p><p>zweite</p>");
  });

  it("liefert für leeren Text einen leeren String", () => {
    expect(plainTextToHtml("  ")).toBe("");
  });
});

describe("richTextToPlain", () => {
  it("entfernt Formatierung und macht Stichpunkte lesbar", () => {
    expect(
      richTextToPlain("<p><strong>Wichtig</strong> &amp; gut</p><ul><li><p>Eins</p></li></ul>"),
    ).toBe("Wichtig & gut\n• Eins");
  });

  it("lässt reinen Text unverändert", () => {
    expect(richTextToPlain("a < b")).toBe("a < b");
  });
});
