import type { DashboardApi } from "@autogate/contracts";

/**
 * Per-request context. Holds the injected `DashboardApi` provider the
 * procedures delegate to — never a concrete adapter. Swapping the in-memory
 * mock for the real Store/orchestrator-backed provider (ticket 01) is a
 * one-line change at the server boundary; the router and its procedures —
 * and therefore the dashboard — never change.
 */
export type Context = {
  dashboard: DashboardApi;
};

/**
 * `(dependencies) => (arguments)` — bind the provider once at boot, then hand
 * the returned function to a tRPC adapter as its `createContext`. The adapter
 * calls it per request (with request/response args we don't need yet).
 */
export const createContext =
  (deps: { dashboard: DashboardApi }) =>
  async (): Promise<Context> => ({
    dashboard: deps.dashboard,
  });
