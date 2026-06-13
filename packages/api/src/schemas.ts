import { z } from "zod";

/**
 * ⚠️ SCAFFOLD ONLY — these mirror a slice of the `DashboardApi` payloads in the
 * design spec §6. The real Zod schemas + inferred types live in
 * `@autogate/contracts` (ticket 00, owned by another engineer). Once that
 * package lands, delete this file and import the schemas from there instead:
 *
 *   import { runSummary, listRunsInput, type RunSummary } from "@autogate/contracts";
 *
 * Nothing in the router references these by path other than `routers/runs.ts`,
 * so the swap is contained.
 */

export const runStatusSchema = z.enum(["awaiting_checks", "running", "completed"]);

export const decisionSchema = z.enum([
  "pending",
  "auto_merge",
  "escalate",
  "blocked",
  "merged",
  "rolled_back",
]);

export const runSummarySchema = z.object({
  runId: z.string(),
  pr: z.object({
    number: z.number().int(),
    title: z.string(),
    repo: z.string(),
    author: z.string(),
    url: z.url(),
    branch: z.string(),
  }),
  status: runStatusSchema,
  decision: decisionSchema,
  riskScore: z.number(),
  gate: z.object({
    total: z.number().int(),
    passed: z.number().int(),
    failed: z.number().int(),
    pending: z.number().int(),
  }),
  checkSummary: z.object({
    pass: z.number().int(),
    warn: z.number().int(),
    fail: z.number().int(),
    pending: z.number().int(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RunSummary = z.infer<typeof runSummarySchema>;

/** Input for `runs.list` — mirrors the `GET /api/runs` query params in §6. */
export const listRunsInputSchema = z.object({
  repo: z.string().optional(),
  status: runStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export type ListRunsInput = z.infer<typeof listRunsInputSchema>;
