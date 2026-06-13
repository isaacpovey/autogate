import { publicProcedure, router } from "../trpc";
import { listRunsInputSchema, type RunSummary } from "../schemas";

/**
 * `runs` sub-router — the read slice of the `DashboardApi` (spec §6).
 * Scaffold ships `list`; `byId`, `override`, `rollback` land with ticket 11/01.
 */
export const runsRouter = router({
  list: publicProcedure
    .input(listRunsInputSchema)
    .query(({ ctx, input }): Promise<RunSummary[]> => ctx.store.listRuns(input)),
});
