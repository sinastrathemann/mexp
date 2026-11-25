import { describe, expect, it } from "vitest";
import { type DateInputs, fromDateInputs, toDateInputs } from "./event-date-input";

const empty: DateInputs = { startDate: "", startTime: "", endDate: "", endTime: "" };

describe("fromDateInputs (Runde 7, Punkte 20/21)", () => {
  it("ohne Datum: kein Termin", () => {
    expect(fromDateInputs(empty)).toEqual({
      ok: true,
      value: { startAt: null, endAt: null, timeTbd: false },
    });
  });

  it("nur Startdatum: ganztägig mit offener Uhrzeit, Ende = gleicher Tag", () => {
    expect(fromDateInputs({ ...empty, startDate: "2027-03-10" })).toEqual({
      ok: true,
      value: {
        startAt: "2027-03-10T10:00:00.000Z",
        endAt: "2027-03-10T14:00:00.000Z",
        timeTbd: true,
      },
    });
  });

  it("Start- und Enddatum ohne Uhrzeit: mehrtägig mit offener Uhrzeit", () => {
    const r = fromDateInputs({ ...empty, startDate: "2027-03-10", endDate: "2027-03-12" });
    expect(r).toMatchObject({
      ok: true,
      value: { endAt: "2027-03-12T14:00:00.000Z", timeTbd: true },
    });
  });

  it("mit Uhrzeiten: genaue Zeitpunkte", () => {
    const r = fromDateInputs({
      startDate: "2027-03-10",
      startTime: "18:00",
      endDate: "",
      endTime: "22:30",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        startAt: new Date("2027-03-10T18:00").toISOString(),
        endAt: new Date("2027-03-10T22:30").toISOString(),
        timeTbd: false,
      },
    });
  });

  it("Startzeit ohne Endzeit: Ende 2 Stunden später", () => {
    const r = fromDateInputs({ ...empty, startDate: "2027-03-10", startTime: "18:00" });
    expect(r).toMatchObject({
      ok: true,
      value: { endAt: new Date("2027-03-10T20:00").toISOString(), timeTbd: false },
    });
  });

  it("Endzeit ohne Startzeit: Fehler", () => {
    expect(fromDateInputs({ ...empty, startDate: "2027-03-10", endTime: "20:00" })).toEqual({
      ok: false,
      error: "startTimeMissing",
    });
  });

  it("Ende ohne Start: Fehler", () => {
    expect(fromDateInputs({ ...empty, endDate: "2027-03-10" })).toEqual({
      ok: false,
      error: "startDateMissing",
    });
  });

  it("Ende vor Start: Fehler", () => {
    expect(fromDateInputs({ ...empty, startDate: "2027-03-10", endDate: "2027-03-09" })).toEqual({
      ok: false,
      error: "endBeforeStart",
    });
    expect(
      fromDateInputs({
        startDate: "2027-03-10",
        startTime: "18:00",
        endDate: "",
        endTime: "17:00",
      }),
    ).toEqual({ ok: false, error: "endBeforeStart" });
  });
});

describe("toDateInputs", () => {
  it("kein Termin → leere Felder", () => {
    expect(toDateInputs(null, null, false)).toEqual(empty);
  });

  it("offene Uhrzeit → nur Datum; eintägig → Enddatum leer", () => {
    expect(toDateInputs("2027-03-10T10:00:00.000Z", "2027-03-10T14:00:00.000Z", true)).toEqual({
      ...empty,
      startDate: "2027-03-10",
    });
    expect(toDateInputs("2027-03-10T10:00:00.000Z", "2027-03-12T14:00:00.000Z", true)).toEqual({
      ...empty,
      startDate: "2027-03-10",
      endDate: "2027-03-12",
    });
  });

  it("mit Uhrzeit → lokale Datum- und Zeitfelder; gleicher Tag → Enddatum leer", () => {
    const start = new Date("2027-03-10T18:00").toISOString();
    const end = new Date("2027-03-10T22:30").toISOString();
    expect(toDateInputs(start, end, false)).toEqual({
      startDate: "2027-03-10",
      startTime: "18:00",
      endDate: "",
      endTime: "22:30",
    });
  });

  it("Hin- und Rückweg ergeben dasselbe", () => {
    const inputs: DateInputs = {
      startDate: "2027-06-01",
      startTime: "09:15",
      endDate: "2027-06-02",
      endTime: "16:00",
    };
    const r = fromDateInputs(inputs);
    if (!r.ok) throw new Error(r.error);
    expect(toDateInputs(r.value.startAt, r.value.endAt, r.value.timeTbd)).toEqual(inputs);
  });
});
