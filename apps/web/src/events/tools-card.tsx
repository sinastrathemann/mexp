import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { isBudgetToolUrl } from "./external-links";
import type { ToolLinkDto } from "./project-plan-types";

/** Zentrale Tools-Liste (Admin → Tools), in jedem Event gleich. */
export function ToolsCard() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["tools"],
    queryFn: () => apiFetch<{ tools: ToolLinkDto[] }>("/tools"),
  });
  // Budget-Tool steht schon im eigenen Budget-Kasten — hier nicht doppelt zeigen.
  const tools = (q.data?.tools ?? []).filter((tool) => !isBudgetToolUrl(tool.url));
  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.toolsTitle")}</h2>
      {tools.length === 0 ? (
        <p className="muted">{t("projectPlan.toolsEmpty")}</p>
      ) : (
        <div className="stack" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          {tools.map((tool) => (
            <a
              key={tool.id ?? tool.url}
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              ↗ {tool.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
