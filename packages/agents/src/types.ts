import type { AgentSdk, CheckSource } from '@autogate/contracts';

/**
 * A packaged Layer-2 agent: its declaration assembled into a `CheckSource` via
 * an injected `AgentSdk`, plus the on-disk locations of its prompt and fixture
 * evals so the CLI and eval harness can load them by id. One per agent folder.
 */
export type AgentEntry = {
  id: string;
  description: string;
  build: (deps: { sdk: AgentSdk }) => CheckSource;
  evalsDir: string;
  promptPath: string;
};
