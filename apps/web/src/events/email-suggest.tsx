import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { parseEmails, pendingToken } from "./email-list";
import type { UserSearchResult } from "./types";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/**
 * Namensvorschläge für die E-Mail-Sichtbarkeitsliste (Feedback-Runde 4, Julian):
 * Name tippen, Person anklicken → E-Mail wird an die Liste angehängt.
 */
export function EmailSuggest({
  id,
  currentRaw,
  onPick,
}: {
  id: string;
  currentRaw: string;
  onPick: (email: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  // Suchbegriff: das eigene Suchfeld, sonst der angefangene Name im E-Mail-Textfeld.
  const effective = query.trim() || pendingToken(currentRaw).trim();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(effective), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [effective]);

  const searchQ = useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () =>
      apiFetch<{ users: UserSearchResult[] }>(
        `/users/search?q=${encodeURIComponent(debounced)}&limit=8`,
      ),
    enabled: debounced.length >= MIN_QUERY_LENGTH,
  });

  const already = new Set(parseEmails(currentRaw));
  const users = (searchQ.data?.users ?? []).filter(
    (u): u is UserSearchResult & { email: string } => u.email !== null,
  );

  return (
    <div style={{ marginTop: "var(--space-2)" }}>
      <input
        id={id}
        type="search"
        className="input"
        placeholder={t("events.emailSuggestPlaceholder")}
        aria-label={t("events.emailSuggestPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {debounced.length >= MIN_QUERY_LENGTH && (
        <ul className="email-suggest-list">
          {searchQ.isLoading && <li className="muted text-sm">{t("projectPlan.loading")}</li>}
          {!searchQ.isLoading && users.length === 0 && (
            <li className="muted text-sm">{t("events.emailSuggestEmpty")}</li>
          )}
          {users.map((u) => {
            const added = already.has(u.email.toLowerCase());
            return (
              <li key={u.id}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={added}
                  onClick={() => {
                    onPick(u.email);
                    setQuery("");
                  }}
                >
                  {added ? "✓" : "+"} {u.displayName}
                  <span className="muted"> · {u.email}</span>
                  {u.team && <span className="muted"> · {u.team}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
