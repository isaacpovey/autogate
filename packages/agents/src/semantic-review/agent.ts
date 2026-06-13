import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAiAgent, standardToVerdict, type ToolName } from '@autogate/agent-sdk';
import type { AgentEntry } from '../types.js';
import { semanticReviewSchema, type SemanticReviewOutput } from './schema.js';

const id = 'semantic-review';
const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));
const instructions = readFileSync(here('./prompt.md'), 'utf8');
const tools: ToolName[] = ['read', 'grep', 'memory.code_knowledge'];

export const entry: AgentEntry = {
  id,
  description: 'Does the change do what it says — intent vs implementation.',
  evalsDir: here('./evals/'),
  promptPath: here('./prompt.md'),
  build: ({ sdk }) =>
    createAiAgent({ sdk })<SemanticReviewOutput>({
      id,
      instructions,
      tools,
      outputSchema: semanticReviewSchema,
      toVerdict: standardToVerdict,
    }),
};
