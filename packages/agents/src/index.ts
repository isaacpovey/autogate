import { entry as semanticReview } from './semantic-review/agent.js';
import { entry as blastRadius } from './blast-radius/agent.js';
import { entry as riskScoring } from './risk-scoring/agent.js';
import { entry as patternCompliance } from './pattern-compliance/agent.js';
import { entry as securityReview } from './security-review/agent.js';
import { entry as architectureReview } from './architecture-review/agent.js';
import type { AgentEntry } from './types.js';

export type { AgentEntry } from './types.js';

/** Every Layer-2 agent, keyed by id. The CLI and eval harness resolve agents here. */
export const agentRegistry: Record<string, AgentEntry> = {
  [semanticReview.id]: semanticReview,
  [blastRadius.id]: blastRadius,
  [riskScoring.id]: riskScoring,
  [patternCompliance.id]: patternCompliance,
  [securityReview.id]: securityReview,
  [architectureReview.id]: architectureReview,
};

export const agentIds: string[] = Object.keys(agentRegistry);

export const getAgent = ({ id }: { id: string }): AgentEntry => {
  const entry = agentRegistry[id];
  if (entry === undefined) {
    throw new Error(`Unknown agent "${id}". Known agents: ${agentIds.join(', ')}`);
  }
  return entry;
};
