import type {
  CheckResult,
  DashboardApi,
  PullRequest,
  RepoConfig,
  RepoSummary,
  RunDecision,
  RunDetail,
  RunsListResponse,
  RunSummary,
  Store,
  StoredOverride,
  StoredRun,
  StoredVerdict,
  TrustMetrics,
} from "@autogate/contracts";
import type { RunResultStore } from "@autogate/store-postgres";

/**
 * The real, Store-backed `DashboardApi` provider (ticket 01 remainder). Reads
 * runs/verdicts/escalations/overrides through the `Store` port plus the per-run
 * snapshot written by `runPipeline` (decision/gate/timeline) via `runResults`,
 * and projects them into the locked `DashboardApi` contract. Drop-in replacement
 * for `createMockDashboardApi` — no router or contract changes.
 *
 * v1 fidelity: runs/getRun/repos/override + overridesPerWeek are real;
 * agreementRate + escalation precision/recall are stubbed (no labeled history
 * yet), `monitoring` is omitted (Layer 3 / ticket 10), and `rollback` is a no-op
 * that returns the current detail (no infra revert).
 */

const pickPr = ({ pr }: { pr: PullRequest }): RunSummary["pr"] => ({
  number: pr.number,
  title: pr.title,
  repo: pr.repo,
  author: pr.author,
  url: pr.url,
  branch: pr.branch,
});

const gateTally = ({
  gateChecks,
}: {
  gateChecks: RunDetail["gateChecks"];
}): RunSummary["gate"] => {
  const counts = gateChecks.reduce(
    (acc, check) => ({
      passed: acc.passed + (check.conclusion === "success" ? 1 : 0),
      failed:
        acc.failed +
        (check.conclusion === "failure" || check.conclusion === "timed_out" ? 1 : 0),
      pending:
        acc.pending +
        (check.conclusion === "success" ||
        check.conclusion === "failure" ||
        check.conclusion === "timed_out"
          ? 0
          : 1),
    }),
    { passed: 0, failed: 0, pending: 0 },
  );
  return { total: gateChecks.length, ...counts };
};

const checkSummary = ({
  verdicts,
}: {
  verdicts: StoredVerdict[];
}): RunSummary["checkSummary"] =>
  verdicts.reduce(
    (summary, verdict) => ({
      pass: summary.pass + (verdict.status === "pass" ? 1 : 0),
      warn: summary.warn + (verdict.status === "warn" ? 1 : 0),
      fail:
        summary.fail +
        (verdict.status === "fail" || verdict.status === "needs_human" ? 1 : 0),
      pending: summary.pending,
    }),
    { pass: 0, warn: 0, fail: 0, pending: 0 },
  );

const toCheckResult = ({ verdict }: { verdict: StoredVerdict }): CheckResult => ({
  sourceId: verdict.sourceId,
  status: verdict.status,
  confidence: verdict.confidence,
  riskContribution: verdict.riskContribution,
  summary: verdict.summary,
  findings: verdict.findings,
  layer: verdict.layer,
  durationMs: verdict.durationMs,
});

/** ISO-8601 week label (`YYYY-Www`) for the overrides-per-week metric. */
const isoWeek = ({ iso }: { iso: string }): string => {
  const parsed = new Date(iso);
  const date = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const overridesPerWeek = ({
  overrides,
}: {
  overrides: StoredOverride[];
}): TrustMetrics["overridesPerWeek"] => {
  const counts = overrides.reduce<Map<string, number>>((acc, override) => {
    const week = isoWeek({ iso: override.createdAt });
    return acc.set(week, (acc.get(week) ?? 0) + 1);
  }, new Map());
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));
};

export const createStoreDashboardApi = ({
  store,
  runResults,
  listOverrides,
  repoConfigs,
}: {
  store: Store;
  runResults: RunResultStore;
  listOverrides: () => Promise<StoredOverride[]>;
  repoConfigs: RepoConfig[];
}): DashboardApi => {
  const summarize = async ({ run }: { run: StoredRun }): Promise<RunSummary> => {
    const [verdicts, result] = await Promise.all([
      store.verdicts.listForRun({ runId: run.runId }),
      runResults.get({ runId: run.runId }),
    ]);
    return {
      runId: run.runId,
      pr: pickPr({ pr: run.pr }),
      status: run.status,
      decision: result?.decision.outcome ?? "pending",
      riskScore: result?.riskScore ?? 0,
      gate: gateTally({ gateChecks: result?.gateChecks ?? [] }),
      checkSummary: checkSummary({ verdicts }),
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  };

  const detail = async ({ runId }: { runId: string }): Promise<RunDetail> => {
    const run = await store.runs.get({ runId });
    if (run === undefined) {
      throw new Error(`run not found: ${runId}`);
    }
    const [verdicts, escalation, result] = await Promise.all([
      store.verdicts.listForRun({ runId }),
      store.escalations.get({ runId }),
      runResults.get({ runId }),
    ]);
    return {
      runId,
      pr: pickPr({ pr: run.pr }),
      status: run.status,
      riskScore: result?.riskScore ?? 0,
      gate: gateTally({ gateChecks: result?.gateChecks ?? [] }),
      checkSummary: checkSummary({ verdicts }),
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      gateChecks: result?.gateChecks ?? [],
      checks: verdicts.map((verdict) => toCheckResult({ verdict })),
      decision: {
        outcome: result?.decision.outcome ?? "pending",
        riskScore: result?.riskScore ?? 0,
        reasons: result?.decision.reasons ?? [],
        brief: escalation?.brief,
      },
      timeline: result?.timeline ?? [],
    };
  };

  return {
    listRuns: async (query): Promise<RunsListResponse> => {
      const runs = await store.runs.list({ repo: query.repo });
      const filtered = runs
        .filter((run) => (query.status === undefined ? true : run.status === query.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const limited = query.limit === undefined ? filtered : filtered.slice(0, query.limit);
      const items = await Promise.all(limited.map((run) => summarize({ run })));
      return { items };
    },

    getRun: async ({ runId }) => detail({ runId }),

    override: async ({ runId, request }) => {
      await store.overrides.save({
        override: {
          runId,
          action: request.action,
          reason: request.reason,
          createdAt: new Date().toISOString(),
        },
      });
      const result = await runResults.get({ runId });
      if (result !== undefined) {
        const outcome: RunDecision = request.action === "approve_merge" ? "merged" : "blocked";
        await runResults.save({
          result: {
            runId,
            decision: {
              outcome,
              riskScore: result.decision.riskScore,
              reasons: [...result.decision.reasons, `Human override: ${request.reason}`],
            },
            gateChecks: result.gateChecks,
            timeline: [
              ...result.timeline,
              {
                at: new Date().toISOString(),
                event: `Human ${
                  outcome === "merged" ? "approved merge" : "blocked"
                }: ${request.reason}`,
              },
            ],
            riskScore: result.riskScore,
          },
        });
      }
      return detail({ runId });
    },

    // v1 stub: records intent only — no VCS/Layer-3 revert wired yet (ticket 10).
    rollback: async ({ runId }) => detail({ runId }),

    metrics: async (): Promise<TrustMetrics> => {
      const overrides = await listOverrides();
      return {
        // Stubbed until agent-vs-human agreement history is captured.
        agreementRate: [],
        escalation: { precision: 0, recall: 0 },
        overridesPerWeek: overridesPerWeek({ overrides }),
      };
    },

    repos: async (): Promise<RepoSummary[]> =>
      repoConfigs.map((config) => ({ id: config.id, name: config.id, agents: config.agents })),
  };
};
