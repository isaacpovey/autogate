import type { z } from 'zod';
import type { AgentSdk, CheckSource, RunContext, Verdict } from '@autogate/contracts';
import { assertKnownTools, type ToolName } from './tools.js';

/**
 * The pure declaration of a Layer-2 AI agent. Authoring an agent means writing
 * one of these (prompt + tool allowlist + output schema + a `toVerdict` mapper);
 * the factory turns it into a `CheckSource` the orchestrator can run blind.
 */
export type AiAgentDeclaration<TOutput> = {
  id: string;
  instructions: string;
  tools: ToolName[];
  outputSchema: z.ZodType<TOutput>;
  toVerdict: (args: { id: string; result: TOutput }) => Verdict;
  appliesTo?: (ctx: RunContext) => boolean;
};

/**
 * `(dependencies) => (arguments)` — inject the `AgentSdk` port once, then stamp
 * out `CheckSource`s from declarations. The agent's structured output is parsed
 * by the SDK against `outputSchema`, then mapped to a `Verdict` by `toVerdict`.
 * Mirrors spec §5.
 */
export const createAiAgent =
  ({ sdk }: { sdk: AgentSdk }) =>
  <TOutput>({
    id,
    instructions,
    tools,
    outputSchema,
    toVerdict,
    appliesTo = () => true,
  }: AiAgentDeclaration<TOutput>): CheckSource => {
    assertKnownTools({ tools });
    return {
      id,
      layer: 'ai',
      appliesTo,
      run: async (context) =>
        toVerdict({ id, result: await sdk.run({ instructions, tools, outputSchema, context }) }),
    };
  };
