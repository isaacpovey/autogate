import { z } from 'zod';
import { agentOutputBaseSchema } from '@autogate/agent-sdk';

/**
 * Architecture-review output: the shared base plus lists of detected boundary
 * violations and coupling concerns found in the change.
 */
export const architectureReviewSchema = agentOutputBaseSchema.extend({
  boundaryViolations: z.array(z.string()),
  couplingConcerns: z.array(z.string()),
});

export type ArchitectureReviewOutput = z.infer<typeof architectureReviewSchema>;
