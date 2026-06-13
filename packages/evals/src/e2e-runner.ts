import {
  mockAgent,
  mockMemory,
  mockSandbox,
  mockStore,
  mockVcs,
  type AgentSdk,
  type CheckRun,
  type CheckSource,
  type MemorySeed,
  type Policy,
  type RepoConfig,
  type RunDetail,
} from '@autogate/contracts';
import { getAgent } from '@autogate/agents';
import { runPipeline, type OrchestratorPorts } from 'api/orchestrator';
import type { E2eExpect, E2eFixture, TrustLoop } from './e2e-fixture.js';

/** Default policy for the e2e tier — mirrors the orchestrator worker's defaults. */
export const DEFAULT_POLICY: Policy = {
  riskEscalateThreshold: 50,
  escalateOnDisagreement: true,
  alwaysEscalatePaths: ['src/auth/**'],
};

/** Fixed clock so e2e replays are deterministic. */
const FIXED_NOW = '2026-01-01T00:00:00.000Z';

/** A single all-green check so every fixture clears the Layer 1 gate. */
const greenChecks: CheckRun[] = [{ name: 'ci', conclusion: 'success' }];

const prKey = ({ repo, number }: { repo: string; number: number }): string => `${repo}#${number}`;

/**
 * A precedent-aware `AgentSdk` for the trust loop: it queries the `decisions`
 * collection and returns the downgraded response when a precedent is retrieved,
 * the flagged response otherwise. This is the one place the e2e tier reads
 * memory through the live `RunContext` rather than ignoring it.
 */
const precedentAwareSdk = ({ trustLoop }: { trustLoop: TrustLoop }): AgentSdk => ({
  run: async ({ outputSchema, context }) => {
    const hits = await context.memory.query({
      collection: 'decisions',
      text: trustLoop.query,
      limit: 3,
    });
    const branch = hits.length > 0 ? trustLoop.withPrecedent : trustLoop.withoutPrecedent;
    return outputSchema.parse(branch.response);
  },
});

const buildRegistry = ({
  fixture,
  trustLoopAgent,
}: {
  fixture: E2eFixture;
  trustLoopAgent?: CheckSource;
}): CheckSource[] => {
  const staticAgents = Object.entries(fixture.agents).map(([id, response]) =>
    getAgent({ id }).build({ sdk: mockAgent({ seed: { defaultResponse: response } }) }),
  );
  return trustLoopAgent === undefined ? staticAgents : [...staticAgents, trustLoopAgent];
};

const repoConfigFor = ({ fixture }: { fixture: E2eFixture }): RepoConfig => ({
  id: fixture.pr.repo,
  ragInclude: Object.keys(fixture.files ?? {}),
  sensitivePaths: fixture.sensitivePaths ?? [],
  requiredChecks: fixture.requiredChecks ?? 'all',
  agents: Object.keys(fixture.agents),
});

/**
 * Replay one fixture PR through `runPipeline` against all mocks with the gate
 * forced green. `withPrecedent` selects the trust-loop condition (undefined for
 * standard fixtures). Returns the orchestrator's full `RunDetail`.
 */
export const replayFixture = async ({
  fixture,
  withPrecedent,
}: {
  fixture: E2eFixture;
  withPrecedent?: boolean;
}): Promise<RunDetail> => {
  const policy = fixture.policy ?? DEFAULT_POLICY;

  const baseSeed: MemorySeed = { ...(fixture.memory ?? {}) };
  const memorySeed: MemorySeed =
    fixture.trustLoop !== undefined && withPrecedent === true
      ? { ...baseSeed, decisions: [...(baseSeed.decisions ?? []), fixture.trustLoop.precedent] }
      : baseSeed;

  const trustLoopAgent =
    fixture.trustLoop === undefined
      ? undefined
      : getAgent({ id: fixture.trustLoop.agentId }).build({
          sdk: precedentAwareSdk({ trustLoop: fixture.trustLoop }),
        });

  const memory = mockMemory({ seed: memorySeed });
  const store = mockStore();
  const vcs = mockVcs({
    seed: { prs: [fixture.pr], checkRuns: { [prKey(fixture.pr)]: greenChecks } },
  });
  const sandbox = mockSandbox({ seed: { files: fixture.files ?? {} } });

  const suffix = withPrecedent === undefined ? '' : withPrecedent ? '-with' : '-without';
  const runId = `e2e-${fixture.name}${suffix}`;
  await store.runs.save({
    run: {
      runId,
      pr: fixture.pr,
      status: 'awaiting_checks',
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
  });

  const repoConfig = repoConfigFor({ fixture });
  const ports: OrchestratorPorts = {
    vcs,
    sandbox,
    store,
    memory,
    registry: buildRegistry({ fixture, trustLoopAgent }),
    policy,
    resolveRepoConfig: () => repoConfig,
    now: () => FIXED_NOW,
  };

  return runPipeline({ ports })(runId);
};

export type ScoredOutcome = {
  label: string;
  expect: E2eExpect;
  decision: RunDetail['decision'];
  riskScore: number;
  decisionMatch: boolean;
  escalatePredicted: boolean;
  brief?: string;
};

const score = ({
  label,
  expect,
  detail,
}: {
  label: string;
  expect: E2eExpect;
  detail: RunDetail;
}): ScoredOutcome => ({
  label,
  expect,
  decision: detail.decision,
  riskScore: detail.riskScore,
  decisionMatch: detail.decision.outcome === expect.decision,
  escalatePredicted: detail.decision.outcome === 'escalate',
  brief: detail.decision.brief,
});

export type TrustLoopResult = {
  fixture: string;
  description?: string;
  precedentId: string;
  without: ScoredOutcome;
  with: ScoredOutcome;
  /** True when retrieving the precedent flipped the outcome (escalate → not-escalate). */
  flipped: boolean;
};

export type EscalationMetrics = {
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
  precision: number;
  recall: number;
};

export type E2eReport = {
  standard: ScoredOutcome[];
  trustLoops: TrustLoopResult[];
  outcomes: ScoredOutcome[];
  metrics: EscalationMetrics;
  decisionMatches: number;
  total: number;
};

const computeMetrics = ({ outcomes }: { outcomes: ScoredOutcome[] }): EscalationMetrics => {
  const tally = outcomes.reduce(
    (acc, outcome) => {
      const predicted = outcome.escalatePredicted;
      const actual = outcome.expect.escalate;
      return {
        truePositive: acc.truePositive + (predicted && actual ? 1 : 0),
        falsePositive: acc.falsePositive + (predicted && !actual ? 1 : 0),
        trueNegative: acc.trueNegative + (!predicted && !actual ? 1 : 0),
        falseNegative: acc.falseNegative + (!predicted && actual ? 1 : 0),
      };
    },
    { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 },
  );
  const predictedPositive = tally.truePositive + tally.falsePositive;
  const actualPositive = tally.truePositive + tally.falseNegative;
  return {
    ...tally,
    precision: predictedPositive === 0 ? 1 : tally.truePositive / predictedPositive,
    recall: actualPositive === 0 ? 1 : tally.truePositive / actualPositive,
  };
};

/**
 * The end-to-end eval tier. Replays every labeled fixture through the
 * orchestrator, scores each `Decision` against ground truth, runs the
 * trust-loop fixtures in both precedent conditions, and rolls every labeled
 * outcome into an escalation precision/recall summary.
 */
export const runE2eSuite = async ({
  fixtures,
}: {
  fixtures: E2eFixture[];
}): Promise<E2eReport> => {
  const standard: ScoredOutcome[] = [];
  for (const fixture of fixtures) {
    if (fixture.trustLoop !== undefined || fixture.expect === undefined) {
      continue;
    }
    const detail = await replayFixture({ fixture });
    standard.push(score({ label: fixture.name, expect: fixture.expect, detail }));
  }

  const trustLoops: TrustLoopResult[] = [];
  for (const fixture of fixtures) {
    if (fixture.trustLoop === undefined) {
      continue;
    }
    const { trustLoop } = fixture;
    const withoutDetail = await replayFixture({ fixture, withPrecedent: false });
    const withDetail = await replayFixture({ fixture, withPrecedent: true });
    const without = score({
      label: `${fixture.name} (no precedent)`,
      expect: trustLoop.withoutPrecedent.expect,
      detail: withoutDetail,
    });
    const withResult = score({
      label: `${fixture.name} (with precedent)`,
      expect: trustLoop.withPrecedent.expect,
      detail: withDetail,
    });
    trustLoops.push({
      fixture: fixture.name,
      description: fixture.description,
      precedentId: trustLoop.precedent.id,
      without,
      with: withResult,
      flipped: without.escalatePredicted && !withResult.escalatePredicted,
    });
  }

  const outcomes = [
    ...standard,
    ...trustLoops.flatMap((result) => [result.without, result.with]),
  ];
  return {
    standard,
    trustLoops,
    outcomes,
    metrics: computeMetrics({ outcomes }),
    decisionMatches: outcomes.filter((outcome) => outcome.decisionMatch).length,
    total: outcomes.length,
  };
};
