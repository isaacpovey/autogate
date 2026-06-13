/**
 * `@autogate/api` — the tRPC contract for the orchestrator/API ↔ dashboard seam.
 *
 * Servers import `appRouter` + `createContext` to serve it (see `apps/api`).
 * Clients import only `type AppRouter` for full end-to-end type inference
 * (see `apps/web`). Scaffold schemas/store re-exported here will be replaced by
 * `@autogate/contracts` (ticket 00) once it lands.
 */
export { appRouter } from "./root";
export type { AppRouter } from "./root";

export { createContext } from "./context";
export type { Context } from "./context";

export { createCallerFactory } from "./trpc";

export { mockStore } from "./store";
export type { StorePort } from "./store";

export * from "./schemas";
