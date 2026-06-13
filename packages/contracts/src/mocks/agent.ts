import type { AgentSdk } from '../ports/index.js';

export type AgentSeed = {
  responses?: Record<string, unknown>;
  defaultResponse?: unknown;
};

export const mockAgent = ({ seed }: { seed?: AgentSeed } = {}): AgentSdk => {
  const responses = seed?.responses ?? {};

  return {
    run: async ({ instructions, outputSchema }) => {
      const canned = instructions in responses ? responses[instructions] : seed?.defaultResponse;
      return outputSchema.parse(canned);
    },
  };
};
