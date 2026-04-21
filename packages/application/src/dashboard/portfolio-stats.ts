import type { DashboardPort, PortfolioStats } from "../ports.js";

export interface PortfolioStatsDeps {
  dashboard: DashboardPort;
}

export async function getPortfolioStats(deps: PortfolioStatsDeps): Promise<PortfolioStats> {
  return deps.dashboard.portfolioStats();
}
