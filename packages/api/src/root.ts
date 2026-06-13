import { publicProcedure, router } from "./trpc";
import { runsRouter } from "./routers/runs";

/**
 * The single typed contract between the orchestrator/API and the dashboard.
 * The dashboard imports only the `AppRouter` *type* (below) and gets
 * end-to-end inference; rename a field here and the client fails to compile.
 */
export const appRouter = router({
  /** Liveness probe — proves the transport end-to-end with no dependencies. */
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    time: new Date().toISOString(),
  })),

  runs: runsRouter,
});

export type AppRouter = typeof appRouter;
