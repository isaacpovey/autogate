import type { StorePort } from "./store";

/**
 * Per-request context. Holds the injected ports the procedures read from —
 * never concrete adapters. Swapping the in-memory mock for the real Postgres
 * `Store` (ticket 03) is a one-line change at the server boundary; no
 * procedure changes.
 */
export type Context = {
  store: StorePort;
};

/**
 * `(dependencies) => (arguments)` — bind the ports once at boot, then hand the
 * returned function to a tRPC adapter as its `createContext`. The adapter calls
 * it per request (with request/response args we don't need yet, hence ignored).
 */
export const createContext =
  (deps: { store: StorePort }) =>
  async (): Promise<Context> => ({
    store: deps.store,
  });
