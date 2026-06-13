import type {
  Store,
  StoredEscalation,
  StoredRun,
  StoredVerdict,
} from '@autogate/contracts';
import type { RunResultInput, RunResultStore } from '@autogate/store-postgres';

const SEED_NOW = '2026-01-01T00:00:00.000Z';

const pr = ({
  number,
  title,
  branch,
}: {
  number: number;
  title: string;
  branch: string;
}): StoredRun['pr'] => ({
  number,
  title,
  repo: 'askable/autogate',
  author: 'seed-bot',
  url: `https://github.com/askable/autogate/pull/${number}`,
  branch,
  baseRef: 'main',
  headRef: branch,
  headSha: `seed${number}`,
  description: `Seeded demo PR #${number}.`,
});

/** Demo dataset: a completed auto-merge run, a completed escalation, and one awaiting checks. */
export const demoSeed: {
  runs: StoredRun[];
  verdicts: StoredVerdict[];
  escalations: StoredEscalation[];
  results: RunResultInput[];
} = {
  runs: [
    {
      runId: 'seed-clean',
      pr: pr({ number: 101, title: 'Add formatDuration helper', branch: 'chore/format-duration' }),
      status: 'completed',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    {
      runId: 'seed-escalate',
      pr: pr({ number: 142, title: 'Rework job scheduler', branch: 'feat/priority-scheduler' }),
      status: 'completed',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    {
      runId: 'seed-awaiting',
      pr: pr({ number: 188, title: 'Tweak session cookie max-age', branch: 'fix/session-maxage' }),
      status: 'awaiting_checks',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  ],
  verdicts: [
    {
      runId: 'seed-clean',
      sourceId: 'security-review',
      status: 'pass',
      confidence: 0.96,
      riskContribution: 0,
      summary: 'No secrets, injection, or auth surface.',
      findings: [],
      layer: 'ai',
      durationMs: 1200,
    },
    {
      runId: 'seed-clean',
      sourceId: 'semantic-review',
      status: 'pass',
      confidence: 0.93,
      riskContribution: 0,
      summary: 'Implementation matches stated intent.',
      findings: [],
      layer: 'ai',
      durationMs: 1500,
    },
    {
      runId: 'seed-escalate',
      sourceId: 'risk-scoring',
      status: 'warn',
      confidence: 0.82,
      riskContribution: 60,
      summary: 'Broad blast radius across worker and store layers.',
      findings: [],
      layer: 'ai',
      durationMs: 1800,
    },
  ],
  escalations: [
    {
      runId: 'seed-escalate',
      brief: '## Escalation: askable/autogate#142 — Rework job scheduler\nAggregate risk 60 ≥ threshold 50.',
      riskScore: 60,
      createdAt: SEED_NOW,
    },
  ],
  results: [
    {
      runId: 'seed-clean',
      decision: {
        outcome: 'auto_merge',
        riskScore: 0,
        reasons: ['Aggregate risk 0 below threshold; agents agree.'],
      },
      gateChecks: [
        { name: 'ci / build', conclusion: 'success' },
        { name: 'ci / lint', conclusion: 'success' },
      ],
      timeline: [
        { at: SEED_NOW, event: 'Run created.' },
        { at: SEED_NOW, event: 'Decision: auto_merge.' },
      ],
      riskScore: 0,
    },
    {
      runId: 'seed-escalate',
      decision: {
        outcome: 'escalate',
        riskScore: 60,
        reasons: ['Aggregate risk 60 ≥ threshold 50.'],
      },
      gateChecks: [
        { name: 'ci / build', conclusion: 'success' },
        { name: 'ci / lint', conclusion: 'success' },
      ],
      timeline: [
        { at: SEED_NOW, event: 'Run created.' },
        { at: SEED_NOW, event: 'Decision: escalate.' },
      ],
      riskScore: 60,
    },
    {
      runId: 'seed-awaiting',
      decision: {
        outcome: 'blocked',
        riskScore: 0,
        reasons: ['Layer 1 gate not green.'],
      },
      gateChecks: [
        { name: 'ci / build', conclusion: 'success' },
        { name: 'ci / e2e', conclusion: 'pending' },
      ],
      timeline: [
        { at: SEED_NOW, event: 'Run created.' },
        { at: SEED_NOW, event: 'Layer 1 gate not green; awaiting checks.' },
      ],
      riskScore: 0,
    },
  ],
};

/**
 * Write the demo dataset through the Store port (idempotent — repositories
 * upsert). When `runResults` is supplied, also write the per-run snapshots so the
 * dashboard renders the seeded runs with full decision/gate/timeline detail.
 */
export const seedStore = async ({
  store,
  runResults,
}: {
  store: Store;
  runResults?: RunResultStore;
}): Promise<{ runs: number; verdicts: number; escalations: number; results: number }> => {
  for (const run of demoSeed.runs) {
    await store.runs.save({ run });
  }
  for (const verdict of demoSeed.verdicts) {
    await store.verdicts.save({ verdict });
  }
  for (const escalation of demoSeed.escalations) {
    await store.escalations.save({ escalation });
  }
  if (runResults !== undefined) {
    for (const result of demoSeed.results) {
      await runResults.save({ result });
    }
  }
  return {
    runs: demoSeed.runs.length,
    verdicts: demoSeed.verdicts.length,
    escalations: demoSeed.escalations.length,
    results: runResults === undefined ? 0 : demoSeed.results.length,
  };
};
