import { z } from 'zod';
import { agentOutputBaseSchema } from '@autogate/agent-sdk';

/**
 * Semantic-review output: the shared base plus an explicit read of the PR's
 * stated intent and any intent the implementation leaves unmet — the evidence
 * behind the status.
 */
export const semanticReviewSchema = agentOutputBaseSchema.extend({
  intentSummary: z.string(),
  unmetIntent: z.array(z.string()),
});

export type SemanticReviewOutput = z.infer<typeof semanticReviewSchema>;
