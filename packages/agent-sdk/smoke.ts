import { z } from 'zod';
import {
  mockAgent,
  mockMemory,
  mockSandbox,
  verdictSchema,
  type PullRequest,
  type RunContext,
} from '@autogate/contracts';
import {
  buildVerdict,
  clampConfidence,
  clampRisk,
  createAiAgent,
  createToolset,
} from './src/index.js';

const pr: PullRequest = {
  number: 7,
  title: 'Add retry to webhook delivery',
  repo: 'askable/autogate',
  author: 'casey',
  url: 'https://github.com/askable/autogate/pull/7',
  branch: 'webhook-retry',
  baseRef: 'main',
  headRef: 'webhook-retry',
  headSha: 'def5678',
  description: 'Wrap delivery in a bounded retry loop.',
};

// The agent's *raw* structured output (matches outputSchema, not Verdict).
const rawOutputSchema = z.object({
  verdict: z.enum(['pass', 'warn', 'fail']),
  intentMatch: z.number(),
  rationale: z.string(),
  concerns: z.array(z.string()),
});
type RawOutput = z.infer<typeof rawOutputSchema>;

const cannedOutput: RawOutput = {
  verdict: 'warn',
  intentMatch: 0.7,
  rationale: 'Retry loop is bounded but lacks jitter; acceptable with a note.',
  concerns: ['No backoff jitter'],
};

const main = async () => {
  // 1. createAiAgent against the canned-response mock yields a schema-valid Verdict.
  const sdk = mockAgent({ seed: { defaultResponse: cannedOutput } });
  const agent = createAiAgent({ sdk })<RawOutput>({
    id: 'demo-semantic',
    instructions: 'Assess whether the change does what the PR says.',
    tools: ['read', 'grep', 'memory.code_knowledge'],
    outputSchema: rawOutputSchema,
    toVerdict: ({ id, result }) =>
      buildVerdict({
        sourceId: id,
        status: result.verdict,
        confidence: result.intentMatch,
        riskContribution: result.verdict === 'warn' ? 30 : 5,
        summary: result.rationale,
        findings: result.concerns.map((concern) => ({
          severity: 'low' as const,
          title: concern,
          detail: concern,
        })),
      }),
  });

  const context: RunContext = {
    pr,
    repo: (await mockSandbox({ seed: { files: { 'src/webhook.ts': 'export const send = () => {};' } } }).clone({ repo: pr.repo, ref: pr.headRef, config: { id: 'autogate', ragInclude: ['src'], sensitivePaths: [], agents: ['demo-semantic'] } })).access,
    memory: mockMemory(),
  };

  const verdict = await agent.run(context);
  const parsed = verdictSchema.safeParse(verdict);
  console.log('[factory] agent id:', agent.id, '| layer:', agent.layer);
  console.log('[factory] verdict schema-valid:', parsed.success);
  console.log('[factory] verdict:', JSON.stringify(verdict));

  // 2. Tool allowlist is enforced at call time.
  const toolset = createToolset({ allow: ['read'], context });
  const readOk = await toolset.read({ path: 'src/webhook.ts' });
  console.log('[tools] allowed read ->', JSON.stringify(readOk));
  try {
    await toolset.grep({ pattern: 'send' });
    console.log('[tools] ERROR: disallowed grep did not throw');
  } catch (error) {
    console.log('[tools] disallowed grep blocked ->', (error as Error).message);
  }

  // 3. Declaring an unknown tool fails to assemble.
  try {
    createAiAgent({ sdk })<RawOutput>({
      id: 'bad-agent',
      instructions: 'x',
      // @ts-expect-error — 'shell' is not a known tool; rejected at runtime too.
      tools: ['shell'],
      outputSchema: rawOutputSchema,
      toVerdict: ({ id, result }) =>
        buildVerdict({ sourceId: id, status: result.verdict, confidence: 1, riskContribution: 0, summary: '' }),
    });
    console.log('[tools] ERROR: unknown tool did not throw');
  } catch (error) {
    console.log('[tools] unknown tool rejected ->', (error as Error).message);
  }

  // 4. toVerdict helpers clamp out-of-range inputs.
  console.log('[verdict] clampConfidence(1.4) =', clampConfidence({ confidence: 1.4 }));
  console.log('[verdict] clampRisk(250) =', clampRisk({ risk: 250 }));
  const clamped = buildVerdict({
    sourceId: 'clamp-demo',
    status: 'pass',
    confidence: 1.9,
    riskContribution: -10,
    summary: 'Out-of-range inputs are clamped.',
  });
  console.log('[verdict] clamped verdict confidence/risk:', clamped.confidence, clamped.riskContribution);

  console.log('\nagent-sdk smoke complete: factory + toVerdict + tool allowlist all verified.');
};

main().catch((error) => {
  console.error('agent-sdk smoke failed:', error);
  process.exit(1);
});
