import type {
  PullRequest,
  RunStatus,
  VerdictStatus,
  CheckLayer,
  Finding,
  OverrideAction,
  RunDecision,
  RunDetail,
} from '@autogate/contracts';
import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const runs = pgTable('runs', {
  runId: text('run_id').primaryKey(),
  pr: jsonb('pr').$type<PullRequest>().notNull(),
  status: text('status').$type<RunStatus>().notNull(),
  repo: text('repo').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const verdicts = pgTable(
  'verdicts',
  {
    runId: text('run_id').notNull(),
    sourceId: text('source_id').notNull(),
    status: text('status').$type<VerdictStatus>().notNull(),
    confidence: doublePrecision('confidence').notNull(),
    riskContribution: doublePrecision('risk_contribution').notNull(),
    summary: text('summary').notNull(),
    findings: jsonb('findings').$type<Finding[]>().notNull(),
    layer: text('layer').$type<CheckLayer>().notNull(),
    durationMs: integer('duration_ms').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.runId, table.sourceId] }),
  }),
);

export const escalations = pgTable('escalations', {
  runId: text('run_id').primaryKey(),
  brief: text('brief').notNull(),
  riskScore: doublePrecision('risk_score').notNull(),
  createdAt: text('created_at').notNull(),
});

export const overrides = pgTable('overrides', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  action: text('action').$type<OverrideAction>().notNull(),
  reason: text('reason').notNull(),
  createdAt: text('created_at').notNull(),
});

/**
 * Per-run result snapshot. `runPipeline` computes the decision, gate check runs,
 * and timeline but only persists verdicts/escalations through the `Store` port;
 * this table captures the rest so the dashboard provider can reconstruct a full
 * `RunDetail` from storage alone. Not part of the `Store` contract — read/written
 * via the standalone `createRunResults` accessor.
 */
export const runResults = pgTable('run_results', {
  runId: text('run_id').primaryKey(),
  decision: jsonb('decision')
    .$type<{ outcome: RunDecision; riskScore: number; reasons: string[] }>()
    .notNull(),
  gateChecks: jsonb('gate_checks').$type<RunDetail['gateChecks']>().notNull(),
  timeline: jsonb('timeline').$type<RunDetail['timeline']>().notNull(),
  riskScore: doublePrecision('risk_score').notNull(),
  createdAt: text('created_at').notNull(),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  payload: jsonb('payload').notNull(),
  attempts: integer('attempts').notNull().default(0),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
