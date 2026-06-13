import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAiAgent, standardToVerdict, type ToolName } from '@autogate/agent-sdk';
import type { AgentEntry } from '../types.js';
import { architectureReviewSchema, type ArchitectureReviewOutput } from './schema.js';

const id = 'architecture-review';
const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));
const instructions = readFileSync(here('./prompt.md'), 'utf8');
const tools: ToolName[] = ['read', 'grep', 'list', 'memory.code_knowledge'];

export const entry: AgentEntry = {
  id,
  description: 'Boundary, coupling and layering concerns.',
  evalsDir: here('./evals/'),
  promptPath: here('./prompt.md'),
  build: ({ sdk }) =>
    createAiAgent({ sdk })<ArchitectureReviewOutput>({
      id,
      instructions,
      tools,
      outputSchema: architectureReviewSchema,
      toVerdict: standardToVerdict,
    }),
};
