import type {
  CheckSource,
  MemoryClient,
  Policy,
  RepoConfig,
  RunContext,
  RunDetail,
  SandboxRunner,
  Store,
  StoredRun,
  StoredVerdict,
  Verdict,
  VcsProvider,
} from "@autogate/contracts";
import { decide, type Decision } from "./decide";
import { buildBrief } from "./buildBrief";

/**
 * Everything the pipeline touches the outside world through. All I/O is here as
 * injected ports — the loop itself imports no concrete adapter.
 */
export type OrchestratorPorts = {
  vcs: VcsProvider;
  sandbox: SandboxRunner;
  store: Store;
  memory: MemoryClient;
  registry: CheckSource[];
  policy: Policy;
  resolveRepoConfig: (args: { repo: string }) => RepoConfig;
  now: () => string;
};

const toCheckSummary = ({ verdicts }: { verdicts: Verdict[] }) =>
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

const toGateTally = ({ gate }: { gate: { allPassed: boolean; checks: { conclusion: string }[] } }) => {
  const counts = gate.checks.reduce(
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
  return { total: gate.checks.length, ...counts };
};

const summaryPr = ({ run }: { run: StoredRun }) => ({
  number: run.pr.number,
  title: run.pr.title,
  repo: run.pr.repo,
  author: run.pr.author,
  url: run.pr.url,
  branch: run.pr.branch,
});

const blockedDetail = ({
  run,
  decision,
  gate,
  timeline,
}: {
  run: StoredRun;
  decision: Decision;
  gate: { allPassed: boolean; checks: { name: string; conclusion: string; url?: string }[] };
  timeline: RunDetail["timeline"];
}): RunDetail => ({
  runId: run.runId,
  pr: summaryPr({ run }),
  status: run.status,
  riskScore: decision.riskScore,
  gate: toGateTally({ gate }),
  checkSummary: { pass: 0, warn: 0, fail: 0, pending: 0 },
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  gateChecks: gate.checks.map((check) => ({
    name: check.name,
    conclusion: check.conclusion,
    url: check.url,
  })),
  checks: [],
  decision: { outcome: decision.outcome, riskScore: decision.riskScore, reasons: decision.reasons },
  timeline,
});

/**
 * `runPipeline` — the core domain loop. Given a previously-stored run id:
 *   1. Layer 1 gate via `vcs.awaitAllChecks`; if not green, persist
 *      `awaiting_checks` + `blocked` and stop.
 *   2. Clone the head ref into a sandbox and build a {@link RunContext}.
 *   3. Fan out the Layer-2 AI agents (`registry.filter` ai + appliesTo).
 *   4. Persist verdicts, `decide`, then post status (+ brief on escalation).
 *
 * Pure orchestration over injected ports — no provider-specific logic.
 */
export const runPipeline =
  ({ ports }: { ports: OrchestratorPorts }) =>
  async (runId: string): Promise<RunDetail> => {
    const { vcs, sandbox, store, memory, registry, policy, resolveRepoConfig, now } = ports;

    const existing = await store.runs.get({ runId });
    if (existing === undefined) {
      throw new Error(`runPipeline: no run stored for ${runId}`);
    }

    const repoConfig = resolveRepoConfig({ repo: existing.pr.repo });
    const gate = await vcs.awaitAllChecks({
      pr: existing.pr,
      required: repoConfig.requiredChecks ?? "all",
    });

    if (!gate.allPassed) {
      const decision = decide({ policy })({ verdicts: [], gate });
      const blockedRun: StoredRun = {
        ...existing,
        status: "awaiting_checks",
        updatedAt: now(),
      };
      await store.runs.save({ run: blockedRun });
      await vcs.postStatus({
        pr: existing.pr,
        state: "pending",
        description: decision.reasons.join(" "),
      });
      return blockedDetail({
        run: blockedRun,
        decision,
        gate,
        timeline: [
          { at: existing.createdAt, event: "Run created." },
          { at: blockedRun.updatedAt, event: "Layer 1 gate not green; awaiting checks." },
        ],
      });
    }

    const runningRun: StoredRun = { ...existing, status: "running", updatedAt: now() };
    await store.runs.save({ run: runningRun });

    const checkout = await sandbox.clone({
      repo: existing.pr.repo,
      ref: existing.pr.headRef,
      config: repoConfig,
    });

    const ctx: RunContext = {
      pr: existing.pr,
      repo: checkout.access,
      memory,
    };

    const agents = registry.filter(
      (source) => source.layer === "ai" && source.appliesTo(ctx),
    );

    const verdicts = await Promise.all(agents.map((source) => source.run(ctx)));
    await sandbox.teardown({ checkout });

    const completedAt = now();
    await Promise.all(
      verdicts.map((verdict) => {
        const stored: StoredVerdict = { ...verdict, runId, layer: "ai", durationMs: 0 };
        return store.verdicts.save({ verdict: stored });
      }),
    );

    const decision = decide({ policy })({ verdicts, gate });
    const brief =
      decision.outcome === "escalate"
        ? buildBrief()({ pr: existing.pr, verdicts })
        : undefined;

    if (brief !== undefined) {
      await store.escalations.save({
        escalation: {
          runId,
          brief,
          riskScore: decision.riskScore,
          createdAt: completedAt,
        },
      });
    }

    const completedRun: StoredRun = { ...runningRun, status: "completed", updatedAt: completedAt };
    await store.runs.save({ run: completedRun });

    await vcs.postStatus({
      pr: existing.pr,
      state: decision.outcome === "escalate" ? "pending" : "success",
      description: decision.reasons.join(" "),
    });
    if (brief !== undefined) {
      await vcs.postBrief({ pr: existing.pr, brief });
    }

    const storedVerdicts = await store.verdicts.listForRun({ runId });

    return {
      runId,
      pr: summaryPr({ run: completedRun }),
      status: completedRun.status,
      riskScore: decision.riskScore,
      gate: toGateTally({ gate }),
      checkSummary: toCheckSummary({ verdicts }),
      createdAt: completedRun.createdAt,
      updatedAt: completedRun.updatedAt,
      gateChecks: gate.checks.map((check) => ({
        name: check.name,
        conclusion: check.conclusion,
        url: check.url,
      })),
      checks: storedVerdicts.map((verdict) => ({
        sourceId: verdict.sourceId,
        status: verdict.status,
        confidence: verdict.confidence,
        riskContribution: verdict.riskContribution,
        summary: verdict.summary,
        findings: verdict.findings,
        layer: verdict.layer,
        durationMs: verdict.durationMs,
      })),
      decision: {
        outcome: decision.outcome,
        riskScore: decision.riskScore,
        reasons: decision.reasons,
        brief,
      },
      timeline: [
        { at: completedRun.createdAt, event: "Run created." },
        { at: runningRun.updatedAt, event: "Layer 1 gate green; running Layer 2 agents." },
        { at: completedAt, event: `Decision: ${decision.outcome}.` },
      ],
    };
  };
