/**
 * `@autogate/api` — the tRPC contract for the orchestrator/API ↔ dashboard seam.
 *
 * Servers import `appRouter` + `createContext` to serve it (see `apps/api`).
 * Clients import only `type AppRouter` for full end-to-end type inference
 * (see `apps/web`). Domain/dashboard schemas + the `Store` port come from
 * `@autogate/contracts`; import those from there directly, not via this package.
 */
export { appRouter } from "./root";
export type { AppRouter } from "./root";

export { createContext } from "./context";
export type { Context } from "./context";

export { createCallerFactory } from "./trpc";
