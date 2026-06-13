import { z } from 'zod';
import { checkLayerSchema, pullRequestSchema, verdictSchema } from './domain.js';

export const runStatusSchema = z.enum(['awaiting_checks', 'running', 'completed']);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runDecisionSchema = z.enum([
  'pending',
  'auto_merge',
  'escalate',
  'blocked',
  'merged',
  'rolled_back',
]);
export type RunDecision = z.infer<typeof runDecisionSchema>;

export const runSummarySchema = z.object({
  runId: z.string(),
  pr: pullRequestSchema.pick({
    number: true,
    title: true,
    repo: true,
    author: true,
    url: true,
    branch: true,
  }),
  status: runStatusSchema,
  decision: runDecisionSchema,
  riskScore: z.number(),
  gate: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    pending: z.number(),
  }),
  checkSummary: z.object({
    pass: z.number(),
    warn: z.number(),
    fail: z.number(),
    pending: z.number(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RunSummary = z.infer<typeof runSummarySchema>;

export const checkResultSchema = verdictSchema.extend({
  layer: checkLayerSchema,
  durationMs: z.number(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const runDetailSchema = runSummarySchema.extend({
  gateChecks: z.array(
    z.object({
      name: z.string(),
      conclusion: z.string(),
      url: z.string().optional(),
    }),
  ),
  checks: z.array(checkResultSchema),
  decision: z.object({
    outcome: runDecisionSchema,
    riskScore: z.number(),
    reasons: z.array(z.string()),
    brief: z.string().optional(),
  }),
  monitoring: z
    .object({
      canaryPercent: z.number(),
      newErrors: z.number(),
      window: z.string(),
      rolledBack: z.boolean(),
    })
    .optional(),
  timeline: z.array(
    z.object({
      at: z.string(),
      event: z.string(),
    }),
  ),
});
export type RunDetail = z.infer<typeof runDetailSchema>;

export const trustMetricsSchema = z.object({
  agreementRate: z.array(z.object({ date: z.string(), rate: z.number() })),
  escalation: z.object({ precision: z.number(), recall: z.number() }),
  overridesPerWeek: z.array(z.object({ week: z.string(), count: z.number() })),
});
export type TrustMetrics = z.infer<typeof trustMetricsSchema>;

export const repoSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  agents: z.array(z.string()),
});
export type RepoSummary = z.infer<typeof repoSummarySchema>;

export const overrideActionSchema = z.enum(['approve_merge', 'block']);
export type OverrideAction = z.infer<typeof overrideActionSchema>;

export const overrideRequestSchema = z.object({
  action: overrideActionSchema,
  reason: z.string(),
});
export type OverrideRequest = z.infer<typeof overrideRequestSchema>;

export const runsQuerySchema = z.object({
  repo: z.string().optional(),
  status: runStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.number().optional(),
});
export type RunsQuery = z.infer<typeof runsQuerySchema>;

export const runsListResponseSchema = z.object({
  items: z.array(runSummarySchema),
  nextCursor: z.string().optional(),
});
export type RunsListResponse = z.infer<typeof runsListResponseSchema>;

export type DashboardApi = {
  listRuns: (query: RunsQuery) => Promise<RunsListResponse>;
  getRun: (args: { runId: string }) => Promise<RunDetail>;
  override: (args: { runId: string; request: OverrideRequest }) => Promise<RunDetail>;
  rollback: (args: { runId: string }) => Promise<RunDetail>;
  metrics: () => Promise<TrustMetrics>;
  repos: () => Promise<RepoSummary[]>;
};
