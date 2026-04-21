import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function App() {
  const { t, i18n } = useTranslation();

  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ fontFamily: "system-ui", padding: "2rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>{t("app.title")}</h1>
          <button
            type="button"
            onClick={() => i18n.changeLanguage(i18n.language === "de" ? "en" : "de")}
          >
            {i18n.language === "de" ? "EN" : "DE"}
          </button>
        </header>
        <p>{t("app.welcome")}</p>
      </div>
    </QueryClientProvider>
  );
}
