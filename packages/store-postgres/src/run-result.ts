import type { RunDecision, RunDetail } from '@autogate/contracts';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runResults } from './schema.js';

/**
 * The per-run snapshot `runPipeline` produces but the `Store` port doesn't hold:
 * the decision (minus the brief, which lives in `escalations`), the Layer-1 gate
 * check runs, the timeline, and the aggregate risk score. Shapes are derived from
 * the `RunDetail` contract so they stay structurally identical to what the
 * orchestrator computes and the dashboard provider consumes.
 */
export type RunResultInput = {
  runId: string;
  decision: { outcome: RunDecision; riskScore: number; reasons: string[] };
  gateChecks: RunDetail['gateChecks'];
  timeline: RunDetail['timeline'];
  riskScore: number;
};

export type RunResult = RunResultInput & { createdAt: string };

export type RunResultStore = {
  save: (args: { result: RunResultInput }) => Promise<void>;
  get: (args: { runId: string }) => Promise<RunResult | undefined>;
};

/**
 * Accessor for the `run_results` snapshot table. Deliberately separate from the
 * `Store` port so persisting the orchestrator's derived view never widens the
 * contract `@autogate/contracts` exposes.
 */
export const createRunResults = ({
  connectionString,
}: {
  connectionString: string;
}): RunResultStore => {
  const sql = postgres(connectionString);
  const db = drizzle(sql);

  return {
    save: async ({ result }) => {
      const values = {
        runId: result.runId,
        decision: result.decision,
        gateChecks: result.gateChecks,
        timeline: result.timeline,
        riskScore: result.riskScore,
        createdAt: new Date().toISOString(),
      };
      await db
        .insert(runResults)
        .values(values)
        .onConflictDoUpdate({ target: runResults.runId, set: values });
    },
    get: async ({ runId }) => {
      const rows = await db.select().from(runResults).where(eq(runResults.runId, runId)).limit(1);
      const row = rows[0];
      return row === undefined
        ? undefined
        : {
            runId: row.runId,
            decision: row.decision,
            gateChecks: row.gateChecks,
            timeline: row.timeline,
            riskScore: row.riskScore,
            createdAt: row.createdAt,
          };
    },
  };
};
