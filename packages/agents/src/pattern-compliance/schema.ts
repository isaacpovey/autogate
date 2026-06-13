import { z } from 'zod';
import { agentOutputBaseSchema } from '@autogate/agent-sdk';

/**
 * Pattern-compliance output: the shared base plus the count of patterns
 * checked and a list of the pattern names that were violated.
 */
export const patternComplianceSchema = agentOutputBaseSchema.extend({
  checkedPatterns: z.number(),
  violatedPatterns: z.array(z.string()),
});

export type PatternComplianceOutput = z.infer<typeof patternComplianceSchema>;
