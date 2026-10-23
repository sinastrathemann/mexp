import { useTranslation } from "react-i18next";
import { type EventStatus, allowedTransitions } from "./types";

const PHASES: { status: EventStatus; key: string }[] = [
  { status: "draft", key: "projectPlan.phaseDraft" },
  { status: "planned", key: "projectPlan.phasePlanned" },
  { status: "open", key: "projectPlan.phaseOpen" },
  { status: "running", key: "projectPlan.phaseRunning" },
  { status: "closed", key: "projectPlan.phaseClosed" },
];

interface Props {
  status: EventStatus;
  pending: boolean;
  onTransition: (status: EventStatus) => void;
}

/** Status als Fortschrittsleiste; erlaubte Phasen sind klickbar (ersetzt "Status ändern"). */
export function PhaseBar({ status, pending, onTransition }: Props) {
  const { t } = useTranslation();
  const allowed = allowedTransitions(status);

  if (status === "cancelled") {
    return <output className="alert alert-error">{t("projectPlan.cancelledNotice")}</output>;
  }

  const currentIndex = PHASES.findIndex((p) => p.status === status);
  return (
    <div className="card">
      <div className="phase-bar">
        {PHASES.map((phase, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
          const clickable = allowed.includes(phase.status) && !pending;
          const label = t(phase.key);
          return (
            <button
              key={phase.status}
              type="button"
              className={`phase-step phase-step--${state}`}
              disabled={!clickable}
              aria-current={state === "current" ? "step" : undefined}
              title={clickable ? t("projectPlan.phaseSwitchTo", { phase: label }) : undefined}
              onClick={() => onTransition(phase.status)}
            >
              {state === "done" ? "✓ " : state === "current" ? "● " : ""}
              {label}
            </button>
          );
        })}
      </div>
      {allowed.includes("cancelled") && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: "var(--space-3)" }}
          disabled={pending}
          onClick={() => {
            if (window.confirm(t("projectPlan.confirmCancel"))) onTransition("cancelled");
          }}
        >
          {t("projectPlan.cancelEvent")}
        </button>
      )}
    </div>
  );
}
