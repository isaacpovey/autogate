import { agentIds, getAgent, type AgentEntry } from '@autogate/agents';
import { buildContext, loadFixtures, scoreVerdict, type Fixture } from '@autogate/evals';
import { createClaudeAgentSdk } from './src/index.js';

/**
 * Live per-agent suite: every agent × every fixture against the REAL Claude
 * Agent SDK (the live counterpart to `pnpm eval`'s per-agent tier, which uses
 * the canned mock). Real Claude investigates each fixture checkout and produces
 * a Verdict; each is scored against the fixture's labels. Bounded concurrency
 * keeps us under rate limits (the SDK also auto-retries 429s).
 *
 *   ANTHROPIC_API_KEY=... node --import tsx run-live-all.ts
 */
const CONCURRENCY = 4;

type Task = { id: string; entry: AgentEntry; fixture: Fixture };
type RunResult = {
  id: string;
  fixture: string;
  ok: boolean;
  pass: boolean;
  status?: string;
  risk?: number;
  findings?: number;
  failed?: string[];
  error?: string;
};

const printResult = (result: RunResult): void => {
  const mark = result.ok ? (result.pass ? '✓' : '~') : '✗';
  const body = result.ok
    ? `${result.status} risk=${result.risk} findings=${result.findings}${result.pass ? '' : ` — failed: ${(result.failed ?? []).join(', ')}`}`
    : `ERROR ${result.error}`;
  console.log(`  ${mark} ${result.id} / ${result.fixture}: ${body}`);
};

const main = async (): Promise<void> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    console.log('DEFERRED: ANTHROPIC_API_KEY not set — drop a key in .env to run the live suite.');
    return;
  }
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';
  const sdk = createClaudeAgentSdk({ apiKey, model });

  const tasks: Task[] = agentIds.flatMap((id) => {
    const entry = getAgent({ id });
    return loadFixtures({ evalsDir: entry.evalsDir }).map((fixture) => ({ id, entry, fixture }));
  });

  console.log(
    `=== LIVE per-agent suite: ${tasks.length} runs across ${agentIds.length} agents (model ${model}, concurrency ${CONCURRENCY}) ===\n`,
  );

  const runOne = async ({ id, entry, fixture }: Task): Promise<RunResult> => {
    try {
      const agent = entry.build({ sdk });
      const context = await buildContext({ fixture });
      const verdict = await agent.run(context);
      const checks = scoreVerdict({ id, fixture, verdict });
      return {
        id,
        fixture: fixture.name,
        ok: true,
        pass: checks.every((check) => check.pass),
        status: verdict.status,
        risk: verdict.riskContribution,
        findings: verdict.findings.length,
        failed: checks.filter((check) => !check.pass).map((check) => check.label),
      };
    } catch (error) {
      return {
        id,
        fixture: fixture.name,
        ok: false,
        pass: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const batches = Array.from({ length: Math.ceil(tasks.length / CONCURRENCY) }, (_unused, batchIndex) =>
    tasks.slice(batchIndex * CONCURRENCY, (batchIndex + 1) * CONCURRENCY),
  );

  const results = await batches.reduce<Promise<RunResult[]>>(async (accPromise, batch) => {
    const acc = await accPromise;
    const batchResults = await Promise.all(batch.map(runOne));
    batchResults.forEach(printResult);
    return [...acc, ...batchResults];
  }, Promise.resolve([]));

  const passed = results.filter((result) => result.pass).length;
  const errored = results.filter((result) => !result.ok).length;
  console.log(
    `\nLIVE SUITE: ${passed}/${results.length} fixtures passed${errored > 0 ? `, ${errored} errored` : ''} — real ${model}.`,
  );
  if (passed !== results.length) {
    process.exit(2);
  }
};

main().catch((error) => {
  console.error('LIVE SUITE FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
