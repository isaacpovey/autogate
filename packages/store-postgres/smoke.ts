import type {
  PullRequest,
  StoredEscalation,
  StoredOverride,
  StoredRun,
  StoredVerdict,
} from '@autogate/contracts';
import postgres from 'postgres';
import { createQueue, createStore, runMigrations } from './src/index.js';

const connectionString = process.env.DATABASE_URL;

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

const assert = ({ label, ok, evidence }: { label: string; ok: boolean; evidence: string }): boolean => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label} — ${evidence}`);
  return ok;
};

const main = async () => {
  if (connectionString === undefined || connectionString.length === 0) {
    console.log('DEFERRED: DATABASE_URL is not set; cannot reach a real Postgres.');
    process.exit(0);
  }

  // Start from a known-empty schema so this is a real migrate-from-empty.
  const admin = postgres(connectionString, { max: 1 });
  await admin`DROP TABLE IF EXISTS runs, verdicts, escalations, overrides, jobs CASCADE`;
  await admin.end();

  await runMigrations({ connectionString });
  console.log('PASS: runMigrations created the schema from an empty database.');

  const store = createStore({ connectionString });

  const run: StoredRun = {
    runId: 'run-1',
    pr,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  };
  await store.runs.save({ run });
  const readRun = await store.runs.get({ runId: 'run-1' });
  const results = [
    assert({
      label: 'runs.save + runs.get round-trip',
      ok: readRun?.status === 'completed' && readRun?.pr.number === 42,
      evidence: `status=${readRun?.status} prNumber=${readRun?.pr.number}`,
    }),
  ];

  // upsert: re-save with a new status overwrites (matches mock filter-then-append).
  await store.runs.save({ run: { ...run, status: 'running', updatedAt: now } });
  const reread = await store.runs.get({ runId: 'run-1' });
  const listForRepo = await store.runs.list({ repo: 'askable/autogate' });
  const listOther = await store.runs.list({ repo: 'someone/else' });
  const listLimited = await store.runs.list({ repo: 'askable/autogate', limit: 1 });
  results.push(
    assert({
      label: 'runs.save upserts by runId (no duplicate row)',
      ok: reread?.status === 'running' && listForRepo.length === 1,
      evidence: `status=${reread?.status} repoCount=${listForRepo.length}`,
    }),
    assert({
      label: 'runs.list filters by repo',
      ok: listForRepo.length === 1 && listOther.length === 0,
      evidence: `match=${listForRepo.length} nonMatch=${listOther.length}`,
    }),
    assert({
      label: 'runs.list honours limit',
      ok: listLimited.length === 1,
      evidence: `limited=${listLimited.length}`,
    }),
  );

  const verdict: StoredVerdict = {
    sourceId: 'semantic',
    status: 'pass',
    confidence: 0.92,
    riskContribution: 5,
    summary: 'Copy-only change, no semantic risk.',
    findings: [{ severity: 'info', title: 'noop', detail: 'no findings' }],
    runId: 'run-1',
    layer: 'ai',
    durationMs: 1200,
  };
  await store.verdicts.save({ verdict });
  await store.verdicts.save({ verdict: { ...verdict, status: 'warn' } });
  const verdicts = await store.verdicts.listForRun({ runId: 'run-1' });
  results.push(
    assert({
      label: 'verdicts.save upserts by (runId, sourceId) and listForRun reads it',
      ok: verdicts.length === 1 && verdicts[0]?.status === 'warn' && verdicts[0]?.findings.length === 1,
      evidence: `count=${verdicts.length} status=${verdicts[0]?.status} findings=${verdicts[0]?.findings.length}`,
    }),
  );

  const escalation: StoredEscalation = {
    runId: 'run-1',
    brief: 'Escalating for human review of sensitive path.',
    riskScore: 42,
    createdAt: now,
  };
  await store.escalations.save({ escalation });
  const readEscalation = await store.escalations.get({ runId: 'run-1' });
  results.push(
    assert({
      label: 'escalations.save + get round-trip',
      ok: readEscalation?.riskScore === 42,
      evidence: `riskScore=${readEscalation?.riskScore}`,
    }),
  );

  const override: StoredOverride = {
    runId: 'run-1',
    action: 'approve_merge',
    reason: 'Reviewed manually, approving.',
    createdAt: now,
  };
  await store.overrides.save({ override });
  await store.overrides.save({ override: { ...override, action: 'block', reason: 'changed mind' } });
  const overrides = await store.overrides.listForRun({ runId: 'run-1' });
  results.push(
    assert({
      label: 'overrides.save appends (no dedup) and listForRun returns all',
      ok: overrides.length === 2,
      evidence: `count=${overrides.length} actions=${overrides.map((o) => o.action).join(',')}`,
    }),
  );

  // Queue basic enqueue/claim/complete.
  const queue = createQueue<{ runId: string }>({ connectionString });
  await queue.enqueue({ id: 'job-1', payload: { runId: 'run-1' } });
  const claimed = await queue.claim();
  results.push(
    assert({
      label: 'queue.enqueue + claim returns the job with incremented attempts',
      ok: claimed?.id === 'job-1' && claimed?.attempts === 1 && claimed?.payload.runId === 'run-1',
      evidence: `id=${claimed?.id} attempts=${claimed?.attempts} payload=${JSON.stringify(claimed?.payload)}`,
    }),
  );
  const claimAfter = await queue.claim();
  results.push(
    assert({
      label: 'queue.claim returns undefined once the only job is already claimed',
      ok: claimAfter === undefined,
      evidence: `claimAfter=${String(claimAfter)}`,
    }),
  );
  if (claimed !== undefined) {
    await queue.complete({ id: claimed.id });
  }

  // Concurrency: two claimers race for many jobs, must never double-claim (FOR UPDATE SKIP LOCKED).
  const jobCount = 50;
  const enqueueIds = Array.from({ length: jobCount }, (_unused, index) => `c-${index}`);
  await enqueueIds.reduce(
    (chain, id) => chain.then(() => queue.enqueue({ id, payload: { runId: id } })),
    Promise.resolve(),
  );

  const drain = async (): Promise<string[]> => {
    const collect = async (acc: string[]): Promise<string[]> => {
      const job = await queue.claim();
      return job === undefined ? acc : collect([...acc, job.id]);
    };
    return collect([]);
  };

  const [claimsA, claimsB] = await Promise.all([drain(), drain()]);
  const allClaimed = [...claimsA, ...claimsB];
  const unique = new Set(allClaimed);
  const overlap = claimsA.filter((id) => claimsB.includes(id));
  results.push(
    assert({
      label: 'concurrent claim: every job claimed exactly once (FOR UPDATE SKIP LOCKED)',
      ok: allClaimed.length === jobCount && unique.size === jobCount && overlap.length === 0,
      evidence: `total=${allClaimed.length} unique=${unique.size} A=${claimsA.length} B=${claimsB.length} overlap=${overlap.length}`,
    }),
  );

  const allPassed = results.every((ok) => ok);
  console.log(`\nSmoke ${allPassed ? 'complete: all checks PASS' : 'FAILED: see FAIL lines above'}.`);
  process.exit(allPassed ? 0 : 1);
};

main().catch((error) => {
  console.error('FAIL: smoke threw an unexpected error —', error);
  process.exit(1);
});
