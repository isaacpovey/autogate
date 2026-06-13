import { publicProcedure, router } from "./trpc";
import { runsRouter } from "./routers/runs";

/**
 * The single typed contract between the orchestrator/API and the dashboard.
 * The dashboard imports only the `AppRouter` *type* (below) and gets
 * end-to-end inference; rename a field here and the client fails to compile.
 *
 * Live SSE deltas (spec §6 `stream` / `runs.onUpdate`) are not yet implemented
 * — they map to tRPC v11 SSE subscriptions and will be added without changing
 * any existing procedure. The dashboard builds all surfaces today with these
 * queries + mutations (refetch/invalidate for freshness).
 */
export const appRouter = router({
  /** Liveness probe — proves the transport end-to-end with no dependencies. */
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    time: new Date().toISOString(),
  })),

  runs: runsRouter,

  /** Trust metrics for the dashboard chart (agreement rate, escalation P/R). */
  metrics: publicProcedure.query(({ ctx }) => ctx.dashboard.metrics()),

  /** Configured repos + which agents run on each. */
  repos: publicProcedure.query(({ ctx }) => ctx.dashboard.repos()),
});

export type AppRouter = typeof appRouter;
