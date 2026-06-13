import { z } from "zod";
import { runsQuerySchema } from "@autogate/contracts";
import { publicProcedure, router } from "../trpc";

const runIdInput = z.object({ runId: z.string() });

// Built from local zod (not composed from contracts' schema) to keep a single
// zod identity in this package's type graph. The literal union still matches
// the contract's `OverrideAction` structurally.
const overrideInput = z.object({
  runId: z.string(),
  action: z.enum(["approve_merge", "block"]),
  reason: z.string(),
});

/**
 * `runs` sub-router — the read/write slice of the `DashboardApi` (spec §6).
 * Every procedure delegates to the injected `DashboardApi` provider, so the
 * shapes are locked while the data source (mock now, orchestrator later) swaps
 * underneath.
 */
export const runsRouter = router({
  list: publicProcedure
    .input(runsQuerySchema)
    .query(({ ctx, input }) => ctx.dashboard.listRuns(input)),

  byId: publicProcedure
    .input(runIdInput)
    .query(({ ctx, input }) => ctx.dashboard.getRun(input)),

  override: publicProcedure
    .input(overrideInput)
    .mutation(({ ctx, input }) =>
      ctx.dashboard.override({
        runId: input.runId,
        request: { action: input.action, reason: input.reason },
      }),
    ),

  rollback: publicProcedure
    .input(runIdInput)
    .mutation(({ ctx, input }) => ctx.dashboard.rollback(input)),
});
