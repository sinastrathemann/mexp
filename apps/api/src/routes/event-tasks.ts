import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import {
  type EventTask,
  TASK_PRIORITIES,
  TEAM_ROLES,
  eventTaskStore,
  httpsUrlSchema,
  linkLabelSchema,
  taskTitleSchema,
  withTaskDefaults,
} from "../project-plan/model.js";
import { mexpUserStore, requireMexpRole } from "./_user-resolution.js";

const MAX_TASKS_PER_EVENT = 200;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Link nur komplett (Text + URL) oder gar nicht.
const linkPairOk = (v: {
  linkLabel?: string | null | undefined;
  linkUrl?: string | null | undefined;
}) =>
  v.linkLabel === undefined && v.linkUrl === undefined
    ? true
    : (v.linkLabel ?? null) === null
      ? (v.linkUrl ?? null) === null
      : (v.linkUrl ?? null) !== null;
const linkPairMessage = { message: "Link braucht Text und https-URL.", path: ["linkUrl"] };

const createSchema = z
  .object({
    title: taskTitleSchema,
    startDate: dateSchema.nullable().optional(),
    dueDate: dateSchema.nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    linkLabel: linkLabelSchema.nullable().optional(),
    linkUrl: httpsUrlSchema.nullable().optional(),
  })
  .refine(linkPairOk, linkPairMessage);

const orderSchema = z.object({ ids: z.array(z.string().min(1)).max(MAX_TASKS_PER_EVENT) });

const updateSchema = z
  .object({
    title: taskTitleSchema.optional(),
    startDate: dateSchema.nullable().optional(),
    dueDate: dateSchema.nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    linkLabel: linkLabelSchema.nullable().optional(),
    linkUrl: httpsUrlSchema.nullable().optional(),
    done: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Leeres Update." });

export function teamMember(id: string) {
  const user = mexpUserStore.get(id);
  if (
    !user ||
    !user.isActive ||
    !user.roles.some((r) => (TEAM_ROLES as readonly string[]).includes(r))
  ) {
    return null;
  }
  return { id: user.id, displayName: user.displayName ?? user.email ?? user.id };
}

const invalidAssignee = {
  error: { code: "INVALID_ASSIGNEE", message: "Diese Person gehört nicht zum Event-Team." },
};
const notFound = { error: { code: "NOT_FOUND", message: "Aufgabe nicht gefunden." } };

// Projektplan-Aufgaben je Event. Die eventId wird bewusst nicht geprüft (Spec: Events
// kommen im Datei-Modus aus drei Quellen); Aufgaben ohne Event werden nirgends angezeigt.
const invalidDateRange = {
  error: { code: "INVALID_DATE_RANGE", message: "Das ab-Datum liegt nach dem bis-Datum." },
};

/** „ab" darf nicht nach „bis" liegen (beide optional). */
function dateRangeOk(task: { startDate?: string | null; dueDate: string | null }): boolean {
  return !task.startDate || !task.dueDate || task.startDate <= task.dueDate;
}

export const eventTaskRoutes = new Hono();

eventTaskRoutes.get("/events/:eventId/tasks", requireMexpRole(...TEAM_ROLES), (c) =>
  c.json({ tasks: (eventTaskStore.get(c.req.param("eventId")) ?? []).map(withTaskDefaults) }),
);

eventTaskRoutes.get("/task-assignees", requireMexpRole(...TEAM_ROLES), (c) => {
  const assignees = Array.from(mexpUserStore.values())
    .map((u) => teamMember(u.id))
    .filter((u): u is { id: string; displayName: string } => u !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));
  return c.json({ assignees });
});

eventTaskRoutes.post(
  "/events/:eventId/tasks",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", createSchema),
  (c) => {
    const eventId = c.req.param("eventId");
    const input = c.req.valid("json");
    if ((eventTaskStore.get(eventId) ?? []).length >= MAX_TASKS_PER_EVENT) {
      return c.json(
        { error: { code: "TOO_MANY_TASKS", message: "Maximal 200 Aufgaben je Event." } },
        400,
      );
    }
    let assignee: { id: string; displayName: string } | null = null;
    if (input.assigneeId) {
      assignee = teamMember(input.assigneeId);
      if (!assignee) return c.json(invalidAssignee, 400);
    }
    const task: EventTask = {
      id: randomUUID(),
      title: input.title,
      dueDate: input.dueDate ?? null,
      ...(input.startDate ? { startDate: input.startDate } : {}),
      priority: input.priority ?? "medium",
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.displayName ?? null,
      linkLabel: input.linkLabel ?? null,
      linkUrl: input.linkUrl ?? null,
      done: false,
      doneBy: null,
      doneAt: null,
      createdBy: getHubUser(c).id,
      createdAt: new Date().toISOString(),
    };
    if (!dateRangeOk(task)) return c.json(invalidDateRange, 400);
    eventTaskStore.set(eventId, [...(eventTaskStore.get(eventId) ?? []), task]);
    return c.json({ task: withTaskDefaults(task) }, 201);
  },
);

eventTaskRoutes.patch(
  "/events/:eventId/tasks/:taskId",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", updateSchema),
  (c) => {
    const eventId = c.req.param("eventId");
    const tasks = eventTaskStore.get(eventId) ?? [];
    const current = tasks.find((t) => t.id === c.req.param("taskId"));
    if (!current) return c.json(notFound, 404);
    const input = c.req.valid("json");
    const updated: EventTask = { ...current };
    if (input.title !== undefined) updated.title = input.title;
    if (input.dueDate !== undefined) updated.dueDate = input.dueDate;
    if (input.startDate !== undefined) updated.startDate = input.startDate;
    if (!dateRangeOk(updated)) return c.json(invalidDateRange, 400);
    if (input.priority !== undefined) updated.priority = input.priority;
    if (input.linkLabel !== undefined) updated.linkLabel = input.linkLabel;
    if (input.linkUrl !== undefined) updated.linkUrl = input.linkUrl;
    // Link nur komplett: Teilupdates (nur Text oder nur URL) dürfen keinen halben Link hinterlassen.
    if ((updated.linkLabel === null) !== (updated.linkUrl === null)) {
      return c.json(
        { error: { code: "INVALID_LINK", message: "Link braucht Text und https-URL." } },
        400,
      );
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId === null) {
        updated.assigneeId = null;
        updated.assigneeName = null;
      } else {
        const assignee = teamMember(input.assigneeId);
        if (!assignee) return c.json(invalidAssignee, 400);
        updated.assigneeId = assignee.id;
        updated.assigneeName = assignee.displayName;
      }
    }
    if (input.done !== undefined && input.done !== current.done) {
      updated.done = input.done;
      updated.doneBy = input.done ? getHubUser(c).id : null;
      updated.doneAt = input.done ? new Date().toISOString() : null;
    }
    eventTaskStore.set(
      eventId,
      tasks.map((t) => (t.id === updated.id ? updated : t)),
    );
    return c.json({ task: withTaskDefaults(updated) });
  },
);

// Manuelle Reihenfolge: ids muss genau die vorhandenen Aufgaben enthalten (jede einmal).
// Geändert wird nur die Reihenfolge im Array, nicht die Aufgaben selbst.
eventTaskRoutes.put(
  "/events/:eventId/tasks/order",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", orderSchema),
  (c) => {
    const eventId = c.req.param("eventId");
    const tasks = eventTaskStore.get(eventId) ?? [];
    const { ids } = c.req.valid("json");
    const byId = new Map(tasks.map((t) => [t.id, t]));
    if (
      ids.length !== tasks.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !byId.has(id))
    ) {
      return c.json(
        {
          error: {
            code: "INVALID_ORDER",
            message: "Die Reihenfolge passt nicht zu den Aufgaben. Bitte Seite neu laden.",
          },
        },
        400,
      );
    }
    const reordered = ids.map((id) => byId.get(id)).filter((t): t is EventTask => t !== undefined);
    eventTaskStore.set(eventId, reordered);
    return c.json({ tasks: reordered.map(withTaskDefaults) });
  },
);

// Löschen nur Admin (Sinas Regel: Anlegen/Bearbeiten dürfen mehr Rollen, Löschen nicht).
eventTaskRoutes.delete("/events/:eventId/tasks/:taskId", requireMexpRole("admin"), (c) => {
  const eventId = c.req.param("eventId");
  const tasks = eventTaskStore.get(eventId) ?? [];
  const taskId = c.req.param("taskId");
  if (!tasks.some((t) => t.id === taskId)) return c.json(notFound, 404);
  eventTaskStore.set(
    eventId,
    tasks.filter((t) => t.id !== taskId),
  );
  return c.json({ ok: true });
});
