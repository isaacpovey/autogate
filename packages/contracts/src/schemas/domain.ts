import { z } from 'zod';

export const severitySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof severitySchema>;

export const verdictStatusSchema = z.enum(['pass', 'warn', 'fail', 'needs_human']);
export type VerdictStatus = z.infer<typeof verdictStatusSchema>;

export const checkLayerSchema = z.enum(['gate', 'ai', 'monitor']);
export type CheckLayer = z.infer<typeof checkLayerSchema>;

export const findingSchema = z.object({
  severity: severitySchema,
  title: z.string(),
  detail: z.string(),
  location: z
    .object({
      file: z.string(),
      line: z.number().optional(),
    })
    .optional(),
  evidence: z.string().optional(),
});
export type Finding = z.infer<typeof findingSchema>;

export const verdictSchema = z.object({
  sourceId: z.string(),
  status: verdictStatusSchema,
  confidence: z.number(),
  riskContribution: z.number(),
  summary: z.string(),
  findings: z.array(findingSchema),
});
export type Verdict = z.infer<typeof verdictSchema>;

export const pullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  repo: z.string(),
  author: z.string(),
  url: z.string(),
  branch: z.string(),
  baseRef: z.string(),
  headRef: z.string(),
  headSha: z.string(),
  description: z.string(),
});
export type PullRequest = z.infer<typeof pullRequestSchema>;

export const policySchema = z.object({
  riskEscalateThreshold: z.number(),
  escalateOnDisagreement: z.boolean(),
  alwaysEscalatePaths: z.array(z.string()),
});
export type Policy = z.infer<typeof policySchema>;

export const repoConfigSchema = z.object({
  id: z.string(),
  ragInclude: z.array(z.string()),
  sensitivePaths: z.array(z.string()),
  requiredChecks: z.union([z.literal('all'), z.array(z.string())]).optional(),
  agents: z.array(z.string()),
});
export type RepoConfig = z.infer<typeof repoConfigSchema>;
