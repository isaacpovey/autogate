import { mockAgent, type Verdict } from '@autogate/contracts';
import { agentIds, getAgent, type AgentEntry } from '@autogate/agents';
import { buildContext } from './context.js';
import { loadFixture, loadFixtures, type Fixture } from './fixture.js';
import { scoreVerdict, type FixtureResult } from './score.js';

/**
 * Run one agent over one fixture against the canned mock `AgentSdk`. The mock
 * returns the fixture's `agentResponse`, validated against the agent's output
 * schema; the agent's `toVerdict` then maps it to a `Verdict`.
 */
export const runAgentOnFixture = async ({
  entry,
  fixture,
}: {
  entry: AgentEntry;
  fixture: Fixture;
}): Promise<Verdict> => {
  const sdk = mockAgent({ seed: { defaultResponse: fixture.agentResponse } });
  const agent = entry.build({ sdk });
  const context = await buildContext({ fixture });
  return agent.run(context);
};

const evalFixture = async ({
  entry,
  fixture,
}: {
  entry: AgentEntry;
  fixture: Fixture;
}): Promise<FixtureResult> => {
  try {
    const verdict = await runAgentOnFixture({ entry, fixture });
    const checks = scoreVerdict({ id: entry.id, fixture, verdict });
    return {
      fixture: fixture.name,
      description: fixture.description,
      pass: checks.every((check) => check.pass),
      checks,
      verdict,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      fixture: fixture.name,
      description: fixture.description,
      pass: false,
      checks: [{ label: 'agent run did not throw', pass: false, detail: message }],
      error: message,
    };
  }
};

export type AgentEvalReport = {
  id: string;
  description: string;
  total: number;
  passed: number;
  passRate: number;
  results: FixtureResult[];
};

/** Score every fixture in one agent's evals folder. Backs `agent eval <id>`. */
export const runAgentEval = async ({ id }: { id: string }): Promise<AgentEvalReport> => {
  const entry = getAgent({ id });
  const fixtures = loadFixtures({ evalsDir: entry.evalsDir });
  const results: FixtureResult[] = [];
  for (const fixture of fixtures) {
    results.push(await evalFixture({ entry, fixture }));
  }
  const passed = results.filter((result) => result.pass).length;
  return {
    id,
    description: entry.description,
    total: results.length,
    passed,
    passRate: results.length === 0 ? 0 : passed / results.length,
    results,
  };
};

/** Run the per-agent tier across every registered agent. Backs `pnpm eval`. */
export const runAllAgentEvals = async (): Promise<AgentEvalReport[]> => {
  const reports: AgentEvalReport[] = [];
  for (const id of agentIds) {
    reports.push(await runAgentEval({ id }));
  }
  return reports;
};

/** Resolve the agent + fixture for a single ad-hoc run. Backs `agent run <id>`. */
export const resolveRun = ({
  id,
  fixtureName,
}: {
  id: string;
  fixtureName?: string;
}): { entry: AgentEntry; fixture: Fixture } => {
  const entry = getAgent({ id });
  if (fixtureName !== undefined) {
    return { entry, fixture: loadFixture({ evalsDir: entry.evalsDir, name: fixtureName }) };
  }
  const [first] = loadFixtures({ evalsDir: entry.evalsDir });
  if (first === undefined) {
    throw new Error(`Agent "${id}" has no fixtures in ${entry.evalsDir}`);
  }
  return { entry, fixture: first };
};
