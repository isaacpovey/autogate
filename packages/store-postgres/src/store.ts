import type {
  Store,
  StoredEscalation,
  StoredOverride,
  StoredRun,
  StoredVerdict,
} from '@autogate/contracts';
import { asc, eq } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { escalations, overrides, runs, verdicts } from './schema.js';

type Db = PostgresJsDatabase<Record<string, never>>;

const toStoredRun = ({
  row,
}: {
  row: typeof runs.$inferSelect;
}): StoredRun => ({
  runId: row.runId,
  pr: row.pr,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toStoredVerdict = ({
  row,
}: {
  row: typeof verdicts.$inferSelect;
}): StoredVerdict => ({
  runId: row.runId,
  sourceId: row.sourceId,
  status: row.status,
  confidence: row.confidence,
  riskContribution: row.riskContribution,
  summary: row.summary,
  findings: row.findings,
  layer: row.layer,
  durationMs: row.durationMs,
});

const runsRepository =
  ({ db }: { db: Db }): Store['runs'] => ({
    save: async ({ run }) => {
      const values = {
        runId: run.runId,
        pr: run.pr,
        status: run.status,
        repo: run.pr.repo,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      };
      await db
        .insert(runs)
        .values(values)
        .onConflictDoUpdate({ target: runs.runId, set: values });
    },
    get: async ({ runId }) => {
      const rows = await db.select().from(runs).where(eq(runs.runId, runId)).limit(1);
      const row = rows[0];
      return row === undefined ? undefined : toStoredRun({ row });
    },
    list: async ({ repo, limit }) => {
      const filtered =
        repo === undefined
          ? db.select().from(runs).orderBy(asc(runs.createdAt))
          : db.select().from(runs).where(eq(runs.repo, repo)).orderBy(asc(runs.createdAt));
      const rows = limit === undefined ? await filtered : await filtered.limit(limit);
      return rows.map((row) => toStoredRun({ row }));
    },
  });

const verdictsRepository =
  ({ db }: { db: Db }): Store['verdicts'] => ({
    save: async ({ verdict }) => {
      const values = {
        runId: verdict.runId,
        sourceId: verdict.sourceId,
        status: verdict.status,
        confidence: verdict.confidence,
        riskContribution: verdict.riskContribution,
        summary: verdict.summary,
        findings: verdict.findings,
        layer: verdict.layer,
        durationMs: verdict.durationMs,
      };
      await db
        .insert(verdicts)
        .values(values)
        .onConflictDoUpdate({
          target: [verdicts.runId, verdicts.sourceId],
          set: values,
        });
    },
    listForRun: async ({ runId }) => {
      const rows = await db.select().from(verdicts).where(eq(verdicts.runId, runId));
      return rows.map((row) => toStoredVerdict({ row }));
    },
  });

const escalationsRepository =
  ({ db }: { db: Db }): Store['escalations'] => ({
    save: async ({ escalation }) => {
      await db
        .insert(escalations)
        .values(escalation)
        .onConflictDoUpdate({ target: escalations.runId, set: escalation });
    },
    get: async ({ runId }) => {
      const rows = await db
        .select()
        .from(escalations)
        .where(eq(escalations.runId, runId))
        .limit(1);
      const row = rows[0];
      return row === undefined
        ? undefined
        : {
            runId: row.runId,
            brief: row.brief,
            riskScore: row.riskScore,
            createdAt: row.createdAt,
          };
    },
  });

const overridesRepository =
  ({ db }: { db: Db }): Store['overrides'] => ({
    save: async ({ override }) => {
      await db.insert(overrides).values({ ...override, id: randomUUID() });
    },
    listForRun: async ({ runId }) => {
      const rows = await db
        .select()
        .from(overrides)
        .where(eq(overrides.runId, runId))
        .orderBy(asc(overrides.createdAt));
      return rows.map(
        (row): StoredOverride => ({
          runId: row.runId,
          action: row.action,
          reason: row.reason,
          createdAt: row.createdAt,
        }),
      );
    },
  });

export const createStore = ({
  connectionString,
}: {
  connectionString: string;
}): Store => {
  const sql = postgres(connectionString);
  const db = drizzle(sql);
  return {
    runs: runsRepository({ db }),
    verdicts: verdictsRepository({ db }),
    escalations: escalationsRepository({ db }),
    overrides: overridesRepository({ db }),
  };
};

export type { StoredRun, StoredVerdict, StoredEscalation, StoredOverride };
