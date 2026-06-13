import { z } from 'zod';
import { agentOutputBaseSchema } from '@autogate/agent-sdk';

/**
 * Security-review output: the shared base plus the set of vulnerability classes
 * identified in the diff — e.g. 'secret-exposure', 'sql-injection', 'missing-authz'.
 */
export const securityReviewSchema = agentOutputBaseSchema.extend({
  vulnerabilityClasses: z.array(z.string()),
});

export type SecurityReviewOutput = z.infer<typeof securityReviewSchema>;
