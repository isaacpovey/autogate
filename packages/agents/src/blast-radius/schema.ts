import { z } from 'zod';
import { agentOutputBaseSchema } from '@autogate/agent-sdk';

/**
 * Blast-radius output: the shared base plus a dependency graph of every path
 * and system the change reaches transitively — evidence for how wide the
 * impact of this PR actually spreads.
 */
export const blastRadiusSchema = agentOutputBaseSchema.extend({
  affectedPaths: z.array(z.string()),
  downstreamSystems: z.array(z.string()),
  fanout: z.number(),
});

export type BlastRadiusOutput = z.infer<typeof blastRadiusSchema>;
