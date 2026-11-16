import type { EventDto } from "./types";

/** Anzeige-Typ: Projekte heißen „Projekt" statt ihres Event-Typs (z. B. Büroevent). */
export function eventTypeLabel(
  event: Pick<EventDto, "eventType" | "kind">,
  t: (key: string) => string,
): string {
  return event.kind === "project"
    ? t("planning.kind.project")
    : t(`events.type.${event.eventType}`);
}
