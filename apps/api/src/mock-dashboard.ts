import type {
  DashboardApi,
  RunDetail,
  RunSummary,
  RunsQuery,
  TrustMetrics,
  RepoSummary,
} from "@autogate/contracts";

/**
 * In-memory mock of the `DashboardApi` port. Returns rich, varied fixtures so
 * the dashboard (ticket 11, stream B) can build every surface against a stable
 * typed contract without waiting on the real orchestrator (ticket 01, stream A).
 *
 * The tRPC router delegates to whatever `DashboardApi` is injected, so swapping
 * this for the real Store/orchestrator-backed implementation is a one-line
 * change at the server boundary — no router or dashboard changes.
 *
 * Mutations (`override`, `rollback`) mutate the in-memory copy so the dashboard
 * sees its writes reflected on refetch.
 */

const fixtures: RunDetail[] = [
  {
    runId: "run_01",
    pr: {
      number: 482,
      title: "Copy tweak on pricing page",
      repo: "askable-services",
      author: "tyron",
      url: "https://github.com/askable/askable-services/pull/482",
      branch: "copy/pricing-tweak",
    },
    status: "completed",
    riskScore: 8,
    gate: { total: 5, passed: 5, failed: 0, pending: 0 },
    checkSummary: { pass: 6, warn: 0, fail: 0, pending: 0 },
    createdAt: "2026-06-13T09:00:00.000Z",
    updatedAt: "2026-06-13T09:04:00.000Z",
    gateChecks: [
      { name: "ci / build", conclusion: "success" },
      { name: "ci / lint", conclusion: "success" },
      { name: "ci / types", conclusion: "success" },
      { name: "ci / test", conclusion: "success" },
      { name: "bugbot", conclusion: "success" },
    ],
    checks: [
      {
        sourceId: "semantic",
        status: "pass",
        confidence: 0.97,
        riskContribution: 2,
        summary: "Copy-only change; matches described intent.",
        findings: [],
        layer: "ai",
        durationMs: 1840,
      },
      {
        sourceId: "blast-radius",
        status: "pass",
        confidence: 0.95,
        riskContribution: 3,
        summary: "Single template file touched; no shared modules.",
        findings: [],
        layer: "ai",
        durationMs: 1520,
      },
    ],
    decision: {
      outcome: "auto_merge",
      riskScore: 8,
      reasons: [
        "All Layer 1 checks green",
        "All agents pass, risk below threshold",
      ],
    },
    timeline: [
      { at: "2026-06-13T09:00:00.000Z", event: "Run created" },
      { at: "2026-06-13T09:01:30.000Z", event: "Layer 1 gate green (5/5)" },
      { at: "2026-06-13T09:03:50.000Z", event: "Agents passed — auto-merge" },
    ],
  },
  {
    runId: "run_02",
    pr: {
      number: 483,
      title: "Refactor session token rotation",
      repo: "askable-services",
      author: "mei",
      url: "https://github.com/askable/askable-services/pull/483",
      branch: "auth/token-rotation",
    },
    status: "completed",
    riskScore: 72,
    gate: { total: 5, passed: 5, failed: 0, pending: 0 },
    checkSummary: { pass: 4, warn: 1, fail: 1, pending: 0 },
    createdAt: "2026-06-13T10:12:00.000Z",
    updatedAt: "2026-06-13T10:19:00.000Z",
    gateChecks: [
      { name: "ci / build", conclusion: "success" },
      { name: "ci / lint", conclusion: "success" },
      { name: "ci / types", conclusion: "success" },
      { name: "ci / test", conclusion: "success" },
      { name: "bugbot", conclusion: "success" },
    ],
    checks: [
      {
        sourceId: "security",
        status: "fail",
        confidence: 0.88,
        riskContribution: 40,
        summary: "Touches auth token lifecycle on a sensitive path.",
        findings: [
          {
            severity: "high",
            title: "Token rotation skips revocation list",
            detail:
              "Rotated tokens are not added to the revocation set; old tokens stay valid until expiry.",
            location: { file: "src/auth/session.ts", line: 142 },
            evidence: "rotateToken() returns before calling revoke(prev)",
          },
        ],
        layer: "ai",
        durationMs: 2600,
      },
      {
        sourceId: "architecture",
        status: "warn",
        confidence: 0.8,
        riskContribution: 22,
        summary: "Session store coupling increased.",
        findings: [
          {
            severity: "medium",
            title: "Direct store access from handler",
            detail: "Bypasses the SessionRepository abstraction.",
            location: { file: "src/auth/session.ts", line: 88 },
          },
        ],
        layer: "ai",
        durationMs: 2600,
      },
    ],
    decision: {
      outcome: "escalate",
      riskScore: 72,
      reasons: [
        "Sensitive path (src/auth/**) — always escalate",
        "Security agent failed with high-severity finding",
        "Risk 72 above escalate threshold (40)",
      ],
      brief:
        "Auth token rotation change. Security agent flags that rotated tokens are not revoked (high). Confirm revocation list is updated before merge; review src/auth/session.ts:142.",
    },
    timeline: [
      { at: "2026-06-13T10:12:00.000Z", event: "Run created" },
      { at: "2026-06-13T10:14:00.000Z", event: "Layer 1 gate green (5/5)" },
      { at: "2026-06-13T10:18:40.000Z", event: "Escalated to human (risk 72)" },
    ],
  },
  {
    runId: "run_03",
    pr: {
      number: 17,
      title: "Add awaitAllChecks gate to vcs-github",
      repo: "autogate",
      author: "tyron",
      url: "https://github.com/askable/autogate/pull/17",
      branch: "feat/await-all-checks",
    },
    status: "awaiting_checks",
    riskScore: 0,
    gate: { total: 4, passed: 2, failed: 0, pending: 2 },
    checkSummary: { pass: 0, warn: 0, fail: 0, pending: 0 },
    createdAt: "2026-06-13T11:30:00.000Z",
    updatedAt: "2026-06-13T11:31:00.000Z",
    gateChecks: [
      { name: "ci / build", conclusion: "success" },
      { name: "ci / lint", conclusion: "success" },
      { name: "ci / types", conclusion: "pending" },
      { name: "bugbot", conclusion: "pending" },
    ],
    checks: [],
    decision: {
      outcome: "pending",
      riskScore: 0,
      reasons: ["Layer 1 gate not yet green (2/4) — agents not started"],
    },
    timeline: [
      { at: "2026-06-13T11:30:00.000Z", event: "Run created" },
      { at: "2026-06-13T11:31:00.000Z", event: "Waiting on GitHub checks" },
    ],
  },
  {
    runId: "run_04",
    pr: {
      number: 911,
      title: "Batch the verdict writes in the orchestrator",
      repo: "askable-services",
      author: "sam",
      url: "https://github.com/askable/askable-services/pull/911",
      branch: "perf/batch-verdicts",
    },
    status: "running",
    riskScore: 31,
    gate: { total: 5, passed: 5, failed: 0, pending: 0 },
    checkSummary: { pass: 2, warn: 0, fail: 0, pending: 4 },
    createdAt: "2026-06-13T12:05:00.000Z",
    updatedAt: "2026-06-13T12:06:30.000Z",
    gateChecks: [
      { name: "ci / build", conclusion: "success" },
      { name: "ci / lint", conclusion: "success" },
      { name: "ci / types", conclusion: "success" },
      { name: "ci / test", conclusion: "success" },
      { name: "bugbot", conclusion: "success" },
    ],
    checks: [
      {
        sourceId: "semantic",
        status: "pass",
        confidence: 0.91,
        riskContribution: 5,
        summary: "Behaviour preserved; batching only.",
        findings: [],
        layer: "ai",
        durationMs: 2100,
      },
      {
        sourceId: "risk",
        status: "pass",
        confidence: 0.84,
        riskContribution: 26,
        summary: "Hot path; moderate blast radius.",
        findings: [],
        layer: "ai",
        durationMs: 2400,
      },
    ],
    decision: {
      outcome: "pending",
      riskScore: 31,
      reasons: ["2/6 agents complete — awaiting remaining verdicts"],
    },
    timeline: [
      { at: "2026-06-13T12:05:00.000Z", event: "Run created" },
      { at: "2026-06-13T12:06:00.000Z", event: "Layer 1 gate green (5/5)" },
      { at: "2026-06-13T12:06:30.000Z", event: "Agents running (2/6)" },
    ],
  },
  {
    runId: "run_05",
    pr: {
      number: 488,
      title: "Tune connection pool size",
      repo: "askable-services",
      author: "mei",
      url: "https://github.com/askable/askable-services/pull/488",
      branch: "perf/pool-size",
    },
    status: "completed",
    riskScore: 55,
    gate: { total: 5, passed: 5, failed: 0, pending: 0 },
    checkSummary: { pass: 5, warn: 1, fail: 0, pending: 0 },
    createdAt: "2026-06-12T15:00:00.000Z",
    updatedAt: "2026-06-12T15:40:00.000Z",
    gateChecks: [
      { name: "ci / build", conclusion: "success" },
      { name: "ci / lint", conclusion: "success" },
      { name: "ci / types", conclusion: "success" },
      { name: "ci / test", conclusion: "success" },
      { name: "bugbot", conclusion: "success" },
    ],
    checks: [
      {
        sourceId: "risk",
        status: "warn",
        confidence: 0.78,
        riskContribution: 30,
        summary: "Infra-affecting config change.",
        findings: [],
        layer: "ai",
        durationMs: 1900,
      },
      {
        sourceId: "monitor",
        status: "fail",
        confidence: 0.9,
        riskContribution: 25,
        summary: "Error rate climbed on canary post-merge.",
        findings: [
          {
            severity: "high",
            title: "Connection timeouts spiked",
            detail: "p99 connection-acquire latency up 8x on canary.",
          },
        ],
        layer: "monitor",
        durationMs: 0,
      },
    ],
    decision: {
      outcome: "rolled_back",
      riskScore: 55,
      reasons: ["Merged with monitoring", "Datadog flagged new errors on canary"],
      brief: "Auto-merged at risk 55; Datadog detected connection timeouts on canary → rolled back.",
    },
    monitoring: {
      canaryPercent: 10,
      newErrors: 47,
      window: "15m",
      rolledBack: true,
    },
    timeline: [
      { at: "2026-06-12T15:00:00.000Z", event: "Run created" },
      { at: "2026-06-12T15:20:00.000Z", event: "Auto-merged (risk 55)" },
      { at: "2026-06-12T15:35:00.000Z", event: "Datadog: 47 new errors on canary" },
      { at: "2026-06-12T15:40:00.000Z", event: "Rolled back" },
    ],
  },
];

const toSummary = (d: RunDetail): RunSummary => ({
  runId: d.runId,
  pr: d.pr,
  status: d.status,
  decision: d.decision.outcome,
  riskScore: d.riskScore,
  gate: d.gate,
  checkSummary: d.checkSummary,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const metrics: TrustMetrics = {
  agreementRate: [
    { date: "2026-06-09", rate: 0.82 },
    { date: "2026-06-10", rate: 0.86 },
    { date: "2026-06-11", rate: 0.88 },
    { date: "2026-06-12", rate: 0.9 },
    { date: "2026-06-13", rate: 0.93 },
  ],
  escalation: { precision: 0.81, recall: 0.74 },
  overridesPerWeek: [
    { week: "2026-W22", count: 6 },
    { week: "2026-W23", count: 4 },
    { week: "2026-W24", count: 3 },
  ],
};

const repos: RepoSummary[] = [
  {
    id: "askable-services",
    name: "askable-services",
    agents: ["semantic", "blast-radius", "risk", "pattern", "security", "architecture"],
  },
  {
    id: "autogate",
    name: "autogate",
    agents: ["semantic", "blast-radius", "risk", "security"],
  },
];

export const createMockDashboardApi = (): DashboardApi => {
  const runs = new Map<string, RunDetail>(fixtures.map((d) => [d.runId, d]));

  const require = (runId: string): RunDetail => {
    const run = runs.get(runId);
    if (!run) throw new Error(`run not found: ${runId}`);
    return run;
  };

  const stamp = (d: RunDetail, event: string): RunDetail => ({
    ...d,
    updatedAt: new Date().toISOString(),
    timeline: [...d.timeline, { at: new Date().toISOString(), event }],
  });

  return {
    listRuns: async (query: RunsQuery) => {
      const all = [...runs.values()]
        .filter((d) => (query.repo ? d.pr.repo === query.repo : true))
        .filter((d) => (query.status ? d.status === query.status : true))
        .map(toSummary);
      const items = query.limit === undefined ? all : all.slice(0, query.limit);
      return { items };
    },
    getRun: async ({ runId }) => require(runId),
    override: async ({ runId, request }) => {
      const current = require(runId);
      const updated = stamp(
        {
          ...current,
          decision: {
            ...current.decision,
            outcome: request.action === "approve_merge" ? "merged" : "blocked",
            reasons: [...current.decision.reasons, `Human override: ${request.reason}`],
          },
        },
        `Human ${request.action === "approve_merge" ? "approved merge" : "blocked"}: ${request.reason}`,
      );
      runs.set(runId, updated);
      return updated;
    },
    rollback: async ({ runId }) => {
      const current = require(runId);
      const updated = stamp(
        {
          ...current,
          decision: { ...current.decision, outcome: "rolled_back" },
          monitoring: {
            canaryPercent: current.monitoring?.canaryPercent ?? 10,
            newErrors: current.monitoring?.newErrors ?? 0,
            window: current.monitoring?.window ?? "15m",
            rolledBack: true,
          },
        },
        "Rolled back",
      );
      runs.set(runId, updated);
      return updated;
    },
    metrics: async () => metrics,
    repos: async () => repos,
  };
};
