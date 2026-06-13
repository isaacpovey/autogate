import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildVerdict, createAiAgent, toFinding, type ToolName } from '@autogate/agent-sdk';
import type { AgentEntry } from '../types.js';
import { riskScoringSchema, type RiskScoringOutput } from './schema.js';

const id = 'risk-scoring';
const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));
const instructions = readFileSync(here('./prompt.md'), 'utf8');
const tools: ToolName[] = ['read', 'list', 'memory.code_knowledge'];

export const entry: AgentEntry = {
  id,
  description: 'Scope, complexity and sensitivity rolled into an explicit risk score.',
  evalsDir: here('./evals/'),
  promptPath: here('./prompt.md'),
  build: ({ sdk }) =>
    createAiAgent({ sdk })<RiskScoringOutput>({
      id,
      instructions,
      tools,
      outputSchema: riskScoringSchema,
      toVerdict: ({ id: sourceId, result }) =>
        buildVerdict({
          sourceId,
          status: result.status,
          confidence: result.confidence,
          riskContribution: result.riskContribution,
          summary: result.summary,
          findings: result.findings.map(toFinding),
        }),
    }),
};
