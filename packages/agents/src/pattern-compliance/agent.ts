import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAiAgent, standardToVerdict, type ToolName } from '@autogate/agent-sdk';
import type { AgentEntry } from '../types.js';
import { patternComplianceSchema, type PatternComplianceOutput } from './schema.js';

const id = 'pattern-compliance';
const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));
const instructions = readFileSync(here('./prompt.md'), 'utf8');
const tools: ToolName[] = ['read', 'grep', 'memory.patterns'];

export const entry: AgentEntry = {
  id,
  description: 'Conventions and house patterns, checked against the patterns memory.',
  evalsDir: here('./evals/'),
  promptPath: here('./prompt.md'),
  build: ({ sdk }) =>
    createAiAgent({ sdk })<PatternComplianceOutput>({
      id,
      instructions,
      tools,
      outputSchema: patternComplianceSchema,
      toVerdict: standardToVerdict,
    }),
};
