import {
  runsQuerySchema,
  type RunSummary,
  type StoredRun,
} from "@autogate/contracts";
import { publicProcedure, router } from "../trpc";

/**
 * Project a `StoredRun` (system-of-record row) into a `RunSummary` (dashboard
 * view). The Store does not persist the derived fields — `decision`,
 * `riskScore`, and the gate/check tallies are computed by the orchestrator
 * (ticket 01) from verdicts + check runs. Until that lands they default here;
 * the orchestrator will replace this projection with the real aggregation.
 */
const toRunSummary = (run: StoredRun): RunSummary => ({
  runId: run.runId,
  pr: {
    number: run.pr.number,
    title: run.pr.title,
    repo: run.pr.repo,
    author: run.pr.author,
    url: run.pr.url,
    branch: run.pr.branch,
  },
  status: run.status,
  decision: "pending",
  riskScore: 0,
  gate: { total: 0, passed: 0, failed: 0, pending: 0 },
  checkSummary: { pass: 0, warn: 0, fail: 0, pending: 0 },
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
});

/**
 * `runs` sub-router — the read slice of the `DashboardApi` (spec §6).
 * Scaffold ships `list`; `byId`, `override`, `rollback` land with ticket 11/01.
 */
export const runsRouter = router({
  list: publicProcedure
    .input(runsQuerySchema)
    .query(async ({ ctx, input }): Promise<RunSummary[]> => {
      const stored = await ctx.store.runs.list({ repo: input.repo });
      const filtered = input.status
        ? stored.filter((run) => run.status === input.status)
        : stored;
      const limited =
        input.limit === undefined ? filtered : filtered.slice(0, input.limit);
      return limited.map(toRunSummary);
    }),
});
