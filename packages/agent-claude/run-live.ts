import { agentIds, getAgent } from '@autogate/agents';
import {
  buildContext,
  formatVerdict,
  loadFixture,
  loadFixtures,
  scoreVerdict,
} from '@autogate/evals';
import { createClaudeAgentSdk } from './src/index.js';

/**
 * Live single-agent run against the REAL Claude Agent SDK. Mirrors the evals'
 * `runAgentOnFixture`, but swaps the canned `mockAgent` for `createClaudeAgentSdk`,
 * so a real Claude model investigates the fixture checkout and produces the verdict.
 *
 *   ANTHROPIC_API_KEY=... node --import tsx run-live.ts <agent-id> [fixture-name]
 */
const main = async (): Promise<void> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    console.log('DEFERRED: ANTHROPIC_API_KEY not set — drop a key in .env to run the live agent.');
    return;
  }
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';
  const [, , idArg, fixtureArg] = process.argv;
  const id = idArg ?? 'security-review';
  if (!agentIds.includes(id)) {
    throw new Error(`Unknown agent "${id}". Known: ${agentIds.join(', ')}`);
  }

  const entry = getAgent({ id });
  const fixture =
    fixtureArg !== undefined
      ? loadFixture({ evalsDir: entry.evalsDir, name: fixtureArg })
      : loadFixtures({ evalsDir: entry.evalsDir })[0];
  if (fixture === undefined) {
    throw new Error(`Agent "${id}" has no fixtures.`);
  }

  console.log(`=== LIVE agent run: ${id} on fixture "${fixture.name}" (model ${model}) ===`);
  const sdk = createClaudeAgentSdk({ apiKey, model });
  const agent = entry.build({ sdk });
  const context = await buildContext({ fixture });
  const verdict = await agent.run(context);

  console.log(formatVerdict({ verdict }));
  const checks = scoreVerdict({ id, fixture, verdict });
  checks.forEach((check) => {
    console.log(`  ${check.pass ? 'PASS' : 'FAIL'}: ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  });
  const allPassed = checks.every((check) => check.pass);
  console.log(
    `\nLIVE ${id}/${fixture.name}: ${allPassed ? 'PASS' : 'PARTIAL'} — real Claude produced status=${verdict.status}, risk=${verdict.riskContribution}, findings=${verdict.findings.length}`,
  );
  if (!allPassed) {
    process.exit(2);
  }
};

main().catch((error) => {
  console.error('LIVE RUN FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
