import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAiAgent, standardToVerdict, type ToolName } from '@autogate/agent-sdk';
import type { AgentEntry } from '../types.js';
import { securityReviewSchema, type SecurityReviewOutput } from './schema.js';

const id = 'security-review';
const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));
const instructions = readFileSync(here('./prompt.md'), 'utf8');
const tools: ToolName[] = ['read', 'grep', 'memory.code_knowledge'];

export const entry: AgentEntry = {
  id,
  description: 'Static security review: secrets, injection, authz, unsafe patterns.',
  evalsDir: here('./evals/'),
  promptPath: here('./prompt.md'),
  build: ({ sdk }) =>
    createAiAgent({ sdk })<SecurityReviewOutput>({
      id,
      instructions,
      tools,
      outputSchema: securityReviewSchema,
      toVerdict: standardToVerdict,
    }),
};
