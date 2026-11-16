import { describe, expect, it } from "vitest";
import { appendEmail, parseEmails } from "./email-list";

describe("appendEmail", () => {
  it("leere Liste → nur die neue Adresse", () => {
    expect(appendEmail("", "Max@mindsquare.de")).toBe("max@mindsquare.de");
  });
  it("hängt mit Komma an und übernimmt ein angefangenes Trennzeichen", () => {
    expect(appendEmail("a@mindsquare.de", "b@mindsquare.de")).toBe(
      "a@mindsquare.de, b@mindsquare.de",
    );
    expect(appendEmail("a@mindsquare.de, ", "b@mindsquare.de")).toBe(
      "a@mindsquare.de, b@mindsquare.de",
    );
  });
  it("keine Dubletten", () => {
    expect(appendEmail("A@mindsquare.de", "a@mindsquare.de")).toBe("A@mindsquare.de");
  });
  it("parseEmails trennt an Komma, Semikolon und Zeilenumbruch", () => {
    expect(parseEmails("a@x.de;b@x.de\nc@x.de, kein")).toEqual(["a@x.de", "b@x.de", "c@x.de"]);
  });
});
