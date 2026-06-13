import { z } from 'zod';
import { agentOutputBaseSchema } from '@autogate/agent-sdk';

/**
 * Risk-scoring output: the shared base plus three scored axes — scope,
 * complexity, and sensitivity — combined into an explicit riskContribution
 * that this agent owns directly rather than deriving from findings.
 */
export const riskScoringSchema = agentOutputBaseSchema.extend({
  scope: z.number(),
  complexity: z.number(),
  sensitivity: z.number(),
  riskContribution: z.number(),
});

export type RiskScoringOutput = z.infer<typeof riskScoringSchema>;
