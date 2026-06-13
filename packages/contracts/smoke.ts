import {
  mockAgent,
  mockMemory,
  mockMonitoring,
  mockQueue,
  mockSandbox,
  mockStore,
  mockVcs,
  verdictSchema,
  type CheckRun,
  type PullRequest,
  type StoredEscalation,
  type StoredOverride,
  type StoredRun,
  type StoredVerdict,
  type Verdict,
} from './src/index.js';

const now = '2026-06-13T00:00:00.000Z';

const pr: PullRequest = {
  number: 42,
  title: 'Tidy up copy on the marketing page',
  repo: 'askable/autogate',
  author: 'isaac',
  url: 'https://github.com/askable/autogate/pull/42',
  branch: 'tidy-copy',
  baseRef: 'main',
  headRef: 'tidy-copy',
  headSha: 'abc1234',
  description: 'Pure copy edit, no logic changes.',
};

const greenChecks: CheckRun[] = [
  { name: 'check-types', conclusion: 'success' },
  { name: 'lint', conclusion: 'success' },
  { name: 'bugbot', conclusion: 'success', url: 'https://bugbot.example/42' },
];

const seedVerdict: Verdict = {
  sourceId: 'semantic',
  status: 'pass',
  confidence: 0.92,
  riskContribution: 5,
  summary: 'Copy-only change, no semantic risk.',
  findings: [],
};

const main = async () => {
  const vcs = mockVcs({
    seed: {
      prs: [pr],
      diffs: { 'askable/autogate#42': '--- a/page.tsx\n+++ b/page.tsx\n-Hello\n+Hi' },
      checkRuns: { 'askable/autogate#42': greenChecks },
    },
  });

  const fetchedPr = await vcs.getPR({ repo: 'askable/autogate', number: 42 });
  const diff = await vcs.getDiff({ pr: fetchedPr });
  const checkRuns = await vcs.listCheckRuns({ pr: fetchedPr });
  const gate = await vcs.awaitAllChecks({ pr: fetchedPr, required: 'all' });
  console.log('[vcs] getPR title:', fetchedPr.title);
  console.log('[vcs] getDiff length:', diff.length);
  console.log('[vcs] listCheckRuns:', checkRuns.map((c) => `${c.name}=${c.conclusion}`).join(', '));
  console.log('[vcs] awaitAllChecks.allPassed:', gate.allPassed);

  await vcs.postStatus({ pr: fetchedPr, state: 'success', description: 'Auto-gate passed all checks.' });
  await vcs.postBrief({ pr: fetchedPr, brief: 'Copy-only change, safe to merge.' });
  const mergeResult = await vcs.merge({ pr: fetchedPr });
  console.log('[vcs] postStatus/postBrief posted; merge:', mergeResult.merged, 'sha:', mergeResult.sha);

  const queue = mockQueue<{ runId: string }>();
  await queue.enqueue({ id: 'job-1', payload: { runId: 'run-1' } });
  const claimed = await queue.claim();
  console.log('[queue] claimed:', claimed?.id, 'attempts:', claimed?.attempts);
  if (claimed !== undefined) {
    await queue.complete({ id: claimed.id });
  }
  const afterComplete = await queue.claim();
  console.log('[queue] claim after drain:', afterComplete);

  const store = mockStore();
  const run: StoredRun = {
    runId: 'run-1',
    pr: fetchedPr,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  };
  await store.runs.save({ run });
  const storedVerdict: StoredVerdict = {
    ...seedVerdict,
    runId: 'run-1',
    layer: 'ai',
    durationMs: 1200,
  };
  await store.verdicts.save({ verdict: storedVerdict });
  const readRun = await store.runs.get({ runId: 'run-1' });
  const readVerdicts = await store.verdicts.listForRun({ runId: 'run-1' });
  const listedRuns = await store.runs.list({ repo: 'askable/autogate' });
  console.log('[store] read run status:', readRun?.status);
  console.log('[store] verdicts for run:', readVerdicts.map((v) => `${v.sourceId}=${v.status}`).join(', '));
  console.log('[store] runs.list count:', listedRuns.length);

  const escalation: StoredEscalation = {
    runId: 'run-1',
    brief: 'Escalating for human review of sensitive path.',
    riskScore: 42,
    createdAt: now,
  };
  await store.escalations.save({ escalation });
  const readEscalation = await store.escalations.get({ runId: 'run-1' });
  console.log('[store] escalation riskScore:', readEscalation?.riskScore);

  const override: StoredOverride = {
    runId: 'run-1',
    action: 'approve_merge',
    reason: 'Reviewed manually, approving.',
    createdAt: now,
  };
  await store.overrides.save({ override });
  const readOverrides = await store.overrides.listForRun({ runId: 'run-1' });
  console.log('[store] overrides for run:', readOverrides.map((o) => o.action).join(', '));

  const memory = mockMemory();
  await memory.upsert({
    collection: 'patterns',
    records: [{ id: 'p1', text: 'Prefer functional reduce over imperative loops', metadata: { kind: 'style' } }],
  });
  const memHits = await memory.query({ collection: 'patterns', text: 'functional reduce' });
  console.log('[memory] query hit:', memHits[0]?.text);

  const sandbox = mockSandbox({ seed: { files: { 'src/page.tsx': 'export const Page = () => <h1>Hi</h1>;' } } });
  const checkout = await sandbox.clone({
    repo: 'askable/autogate',
    ref: 'tidy-copy',
    config: { id: 'autogate', ragInclude: ['src'], sensitivePaths: [], agents: ['semantic'] },
  });
  const fileBody = await checkout.access.read({ path: 'src/page.tsx' });
  const grepHits = await checkout.access.grep({ pattern: 'Page' });
  const listed = await checkout.access.list({ dir: 'src' });
  console.log('[sandbox] read file body:', fileBody);
  console.log('[sandbox] grep hits:', grepHits.length);
  console.log('[sandbox] list entries:', listed.map((e) => e.path).join(', '));
  await sandbox.teardown({ checkout });

  const agent = mockAgent({ seed: { responses: { 'review the diff': seedVerdict } } });
  const agentVerdict = await agent.run({
    instructions: 'review the diff',
    tools: ['read', 'grep'],
    outputSchema: verdictSchema,
    context: { pr: fetchedPr, repo: checkout.access, memory },
  });
  console.log('[agent] verdict status:', agentVerdict.status, 'summary:', agentVerdict.summary);

  const monitoring = mockMonitoring({
    seed: {
      errors: {
        'deploy-1': [
          { id: 'e1', message: 'NPE in handler', service: 'web', at: now, correlatedToChange: true },
        ],
      },
    },
  });
  const errs = await monitoring.errorsSince({ deploy: 'deploy-1', change: pr.headSha });
  console.log('[monitoring] errorsSince:', errs.length, 'correlated:', errs[0]?.correlatedToChange);

  console.log('\nSmoke complete: all ports round-tripped seed data successfully.');
};

main().catch((error) => {
  console.error('Smoke failed:', error);
  process.exit(1);
});
