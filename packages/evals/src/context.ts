import { mockMemory, mockSandbox, type RunContext } from '@autogate/contracts';
import type { Fixture } from './fixture.js';

/**
 * Build a fully-mocked `RunContext` for a fixture: repo reads come from the
 * fixture's seeded files (via `mockSandbox`), memory from its seeded records.
 * The canned `AgentSdk` ignores these, but wiring them keeps the context honest
 * and ready for the live SDK swap later.
 */
export const buildContext = async ({ fixture }: { fixture: Fixture }): Promise<RunContext> => {
  const files = fixture.files ?? {};
  const sandbox = mockSandbox({ seed: { files } });
  const checkout = await sandbox.clone({
    repo: fixture.pr.repo,
    ref: fixture.pr.headRef,
    config: {
      id: fixture.pr.repo,
      ragInclude: Object.keys(files),
      sensitivePaths: [],
      agents: [],
    },
  });
  return {
    pr: fixture.pr,
    repo: checkout.access,
    memory: mockMemory({ seed: fixture.memory }),
  };
};
