import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAiAgent, standardToVerdict, type ToolName } from '@autogate/agent-sdk';
import type { AgentEntry } from '../types.js';
import { blastRadiusSchema, type BlastRadiusOutput } from './schema.js';

const id = 'blast-radius';
const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));
const instructions = readFileSync(here('./prompt.md'), 'utf8');
const tools: ToolName[] = ['read', 'grep', 'list', 'memory.code_knowledge'];

export const entry: AgentEntry = {
  id,
  description: 'Dependency graph of the systems and paths a change reaches.',
  evalsDir: here('./evals/'),
  promptPath: here('./prompt.md'),
  build: ({ sdk }) =>
    createAiAgent({ sdk })<BlastRadiusOutput>({
      id,
      instructions,
      tools,
      outputSchema: blastRadiusSchema,
      toVerdict: standardToVerdict,
    }),
};
