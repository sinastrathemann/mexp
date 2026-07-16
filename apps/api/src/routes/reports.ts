import { Hono } from "hono";
import { env } from "../deps.js";
import { requireMexpRole } from "./_user-resolution.js";
import { devBudgetStore } from "./budget.js";
import { devLiveParticipantsStore } from "./registration-form.js";

const MANAGE_ROLES = ["admin", "manager", "event_office"] as const;

// ─── Hilfsfunktionen ────────────────────────────────────────────
function buildMockEventList() {
  // Synchron mit der Liste in events.ts — eigenständig damit Reports unabhängig sind
  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
  const ownerId = "550e8400-e29b-41d4-a716-446655440000";
  return [
    {
      id: "evt-001",
      title: "Code & Pizza — Frontend Night",
      eventType: "team",
      status: "open",
      startAt: inDays(7),
      location: "Bielefeld HQ",
      capacity: 20,
      ownerId,
    },
    {
      id: "evt-002",
      title: "Sommerfest 2026",
      eventType: "mindsquare",
      status: "planned",
      startAt: inDays(45),
      location: "Heidewald",
      capacity: 150,
      ownerId,
    },
    {
      id: "evt-003",
      title: "Q2 Strategie-Tag",
      eventType: "strategy",
      status: "running",
      startAt: inDays(-1),
      location: "Online",
      capacity: 30,
      ownerId,
    },
    {
      id: "evt-004",
      title: "Onboarding Welcome Day",
      eventType: "office",
      status: "open",
      startAt: inDays(14),
      location: "Bielefeld HQ",
      capacity: 12,
      ownerId,
    },
    {
      id: "evt-005",
      title: "Padel & Pizza Evening",
      eventType: "feelgood",
      status: "open",
      startAt: inDays(21),
      location: "Padelhaus Bielefeld",
      capacity: 24,
      ownerId,
    },
    {
      id: "evt-006",
      title: "SAP Bereich All-Hands",
      eventType: "division",
      status: "planned",
      startAt: inDays(28),
      location: "Online",
      capacity: 80,
      ownerId,
    },
    {
      id: "evt-007",
      title: "Brauerei-Tour Bielefeld",
      eventType: "local_experience",
      status: "draft",
      startAt: inDays(60),
      location: "Brauerei Joh. Albrecht",
      capacity: 18,
      ownerId,
    },
  ];
}

interface MonthBucket {
  events: ReturnType<typeof buildMockEventList>;
  totalEvents: number;
  byType: Record<string, number>;
  byLocation: Record<string, number>;
  participantsRegistered: number;
  participantsAttended: number;
  participantsNoShow: number;
  totalCapacity: number;
  avgUtilization: number | null;
  attendanceRate: number | null;
  noShowRate: number | null;
  biggestEvent: { id: string; title: string; count: number } | null;
  topLocations: { location: string; count: number }[];
  // Budget
  totalPlannedCents: number;
  totalNetCents: number;
  byTypeNetCents: Record<string, number>;
  byTypePlannedCents: Record<string, number>;
  costPerPersonCents: number | null;
  topEventsByCost: { id: string; title: string; eventType: string; netCents: number }[];
}

function bucketFor(year: number, month: number): MonthBucket {
  const all = buildMockEventList();
  const monthEvents = all.filter((e) => {
    const d = new Date(e.startAt);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const byType: Record<string, number> = {};
  const byLocation: Record<string, number> = {};
  const byTypeNetCents: Record<string, number> = {};
  const byTypePlannedCents: Record<string, number> = {};
  let registered = 0;
  let attended = 0;
  const noShow = 0;
  let totalCapacity = 0;
  let totalPlannedCents = 0;
  let totalNetCents = 0;
  let biggestEvent: MonthBucket["biggestEvent"] = null;
  const eventCostList: { id: string; title: string; eventType: string; netCents: number }[] = [];

  // Alle Budget-Items pro Event vorgruppieren
  const budgetByEvent = new Map<string, { planned: number; net: number }>();
  for (const item of devBudgetStore.values()) {
    const acc = budgetByEvent.get(item.eventId) ?? { planned: 0, net: 0 };
    acc.planned += item.plannedAmountCents;
    acc.net += item.actualNetCents ?? 0;
    budgetByEvent.set(item.eventId, acc);
  }

  for (const e of monthEvents) {
    byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
    if (e.location) byLocation[e.location] = (byLocation[e.location] ?? 0) + 1;
    if (e.capacity) totalCapacity += e.capacity;

    // Teilnehmer aus Live-Store + Mock-Statics zählen
    const live = devLiveParticipantsStore.get(e.id) ?? [];
    const staticCount = 3;
    const staticRegistered = 1;
    const staticAttended = 1;
    const liveRegistered = live.filter((p) => p.status === "registered").length;
    const eventRegistered = staticRegistered + liveRegistered;
    const eventAttended = staticAttended;
    registered += eventRegistered;
    attended += eventAttended;
    const eventTotalParticipants = staticCount + live.length;
    if (!biggestEvent || eventTotalParticipants > biggestEvent.count) {
      biggestEvent = { id: e.id, title: e.title, count: eventTotalParticipants };
    }

    // Budget pro Event aufsummieren + nach Typ aggregieren
    const ebudget = budgetByEvent.get(e.id) ?? { planned: 0, net: 0 };
    totalPlannedCents += ebudget.planned;
    totalNetCents += ebudget.net;
    byTypePlannedCents[e.eventType] = (byTypePlannedCents[e.eventType] ?? 0) + ebudget.planned;
    byTypeNetCents[e.eventType] = (byTypeNetCents[e.eventType] ?? 0) + ebudget.net;
    eventCostList.push({
      id: e.id,
      title: e.title,
      eventType: e.eventType,
      netCents: ebudget.net,
    });
  }

  const avgUtilization = totalCapacity > 0 ? (registered + attended) / totalCapacity : null;
  const totalActuallyPresent = attended;
  const totalParticipants = registered + attended + noShow;
  const attendanceRate = totalParticipants > 0 ? totalActuallyPresent / totalParticipants : null;
  const noShowRate = totalParticipants > 0 ? noShow / totalParticipants : null;

  const topLocations = Object.entries(byLocation)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    events: monthEvents,
    totalEvents: monthEvents.length,
    byType,
    byLocation,
    participantsRegistered: registered,
    participantsAttended: attended,
    participantsNoShow: noShow,
    totalCapacity,
    avgUtilization,
    attendanceRate,
    noShowRate,
    biggestEvent,
    topLocations,
    totalPlannedCents,
    totalNetCents,
    byTypeNetCents,
    byTypePlannedCents,
    costPerPersonCents:
      registered + attended > 0 ? Math.round(totalNetCents / (registered + attended)) : null,
    topEventsByCost: eventCostList
      .filter((e) => e.netCents > 0)
      .sort((a, b) => b.netCents - a.netCents)
      .slice(0, 5),
  };
}

export const reportRoutes = new Hono();

// JSON-Report
reportRoutes.get("/monthly", requireMexpRole(...MANAGE_ROLES), (c) => {
  const year = Number.parseInt(c.req.query("year") ?? "", 10);
  const month = Number.parseInt(c.req.query("month") ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return c.json(
      { error: { code: "INVALID_PARAMS", message: "year + month als Zahl erforderlich" } },
      400,
    );
  }

  if (env.DATABASE_URL) {
    return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Reports nur im Dev-Mode" } }, 501);
  }

  const current = bucketFor(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const previous = bucketFor(prevYear, prevMonth);

  return c.json({
    period: { year, month, label: monthLabel(year, month) },
    previousPeriod: { year: prevYear, month: prevMonth, label: monthLabel(prevYear, prevMonth) },
    current,
    previous,
  });
});

// CSV-Export
reportRoutes.get("/monthly.csv", requireMexpRole(...MANAGE_ROLES), (c) => {
  const year = Number.parseInt(c.req.query("year") ?? "", 10);
  const month = Number.parseInt(c.req.query("month") ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return c.text("Invalid params", 400);
  }
  if (env.DATABASE_URL) {
    return c.text("Not implemented", 501);
  }
  const current = bucketFor(year, month);
  const previous = bucketFor(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);

  const lines: string[] = [];
  lines.push("Kennzahl;Aktueller Monat;Vormonat;Delta");
  const row = (label: string, cur: number | string, prev: number | string) => {
    const delta =
      typeof cur === "number" && typeof prev === "number"
        ? (cur - prev >= 0 ? "+" : "") + (cur - prev).toString()
        : "—";
    lines.push(`${label};${cur};${prev};${delta}`);
  };
  row("Events gesamt", current.totalEvents, previous.totalEvents);
  row("Anmeldungen", current.participantsRegistered, previous.participantsRegistered);
  row("Anwesend", current.participantsAttended, previous.participantsAttended);
  row("No-Shows", current.participantsNoShow, previous.participantsNoShow);
  row("Kapazität gesamt", current.totalCapacity, previous.totalCapacity);
  row(
    "Auslastung (%)",
    current.avgUtilization ? Math.round(current.avgUtilization * 100) : "—",
    previous.avgUtilization ? Math.round(previous.avgUtilization * 100) : "—",
  );
  row(
    "Teilnahmequote (%)",
    current.attendanceRate ? Math.round(current.attendanceRate * 100) : "—",
    previous.attendanceRate ? Math.round(previous.attendanceRate * 100) : "—",
  );
  // Budget
  row(
    "Σ Netto-Ist (€)",
    (current.totalNetCents / 100).toFixed(2),
    (previous.totalNetCents / 100).toFixed(2),
  );
  row(
    "Σ Geplant (€)",
    (current.totalPlannedCents / 100).toFixed(2),
    (previous.totalPlannedCents / 100).toFixed(2),
  );
  row(
    "Netto / Person (€)",
    current.costPerPersonCents !== null ? (current.costPerPersonCents / 100).toFixed(2) : "—",
    previous.costPerPersonCents !== null ? (previous.costPerPersonCents / 100).toFixed(2) : "—",
  );

  lines.push("");
  lines.push("Eventtyp;Anzahl im Monat;Geplant (€);Netto-Ist (€)");
  for (const [type, count] of Object.entries(current.byType)) {
    const planned = ((current.byTypePlannedCents[type] ?? 0) / 100).toFixed(2);
    const net = ((current.byTypeNetCents[type] ?? 0) / 100).toFixed(2);
    lines.push(`${type};${count};${planned};${net}`);
  }
  lines.push("");
  lines.push("Top-Locations;Anzahl");
  for (const { location, count } of current.topLocations) {
    lines.push(`${location};${count}`);
  }
  lines.push("");
  lines.push("Teuerste Events;Eventtyp;Netto-Ist (€)");
  for (const e of current.topEventsByCost) {
    lines.push(`${e.title};${e.eventType};${(e.netCents / 100).toFixed(2)}`);
  }

  const csv = `﻿${lines.join("\n")}`; // BOM für Excel-DE
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename=mexp-report-${year}-${String(month).padStart(2, "0")}.csv`,
  );
  return c.body(csv);
});

function monthLabel(year: number, month: number): string {
  const months = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];
  return `${months[month - 1]} ${year}`;
}
