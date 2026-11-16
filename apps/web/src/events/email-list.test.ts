import { describe, expect, it } from "vitest";
import { appendEmail, parseEmails, pendingToken } from "./email-list";

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
  it("ersetzt einen angefangenen Namen am Ende durch die E-Mail", () => {
    expect(appendEmail("jan", "jan.m@mindsquare.de")).toBe("jan.m@mindsquare.de");
    expect(appendEmail("a@mindsquare.de, jan", "jan.m@mindsquare.de")).toBe(
      "a@mindsquare.de, jan.m@mindsquare.de",
    );
  });
  it("pendingToken liefert nur Nicht-E-Mail-Wörter am Ende", () => {
    expect(pendingToken("a@x.de, jan")).toBe("jan");
    expect(pendingToken("jan")).toBe("jan");
    expect(pendingToken("a@x.de, ")).toBe("");
    expect(pendingToken("a@x.de")).toBe("");
  });
  it("parseEmails trennt an Komma, Semikolon und Zeilenumbruch", () => {
    expect(parseEmails("a@x.de;b@x.de\nc@x.de, kein")).toEqual(["a@x.de", "b@x.de", "c@x.de"]);
  });
});
