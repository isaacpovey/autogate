import {
  mockAgent,
  mockMemory,
  mockSandbox,
  mockStore,
  mockVcs,
  verdictSchema,
  type CheckRun,
  type CheckSource,
  type Policy,
  type PullRequest,
  type RepoConfig,
  type RunContext,
  type StoredRun,
  type Verdict,
} from "@autogate/contracts";
import { buildBrief, decide, runPipeline, type OrchestratorPorts } from "./src/orchestrator/index";

const now = "2026-06-13T00:00:00.000Z";

const policy: Policy = {
  riskEscalateThreshold: 50,
  escalateOnDisagreement: true,
  alwaysEscalatePaths: ["src/auth/**"],
};

const repoConfig: RepoConfig = {
  id: "autogate",
  ragInclude: ["src"],
  sensitivePaths: ["src/auth"],
  requiredChecks: "all",
  agents: ["semantic", "security"],
};

const greenChecks: CheckRun[] = [
  { name: "check-types", conclusion: "success" },
  { name: "lint", conclusion: "success" },
];

const redChecks: CheckRun[] = [
  { name: "check-types", conclusion: "success" },
  { name: "lint", conclusion: "failure" },
];

const makePr = ({ number, title }: { number: number; title: string }): PullRequest => ({
  number,
  title,
  repo: "autogate",
  author: "isaac",
  url: `https://github.com/askable/autogate/pull/${number}`,
  branch: `branch-${number}`,
  baseRef: "main",
  headRef: `branch-${number}`,
  headSha: `sha-${number}`,
  description: "fixture",
});

/** A CheckSource backed by the mock AgentSdk returning a canned verdict. */
const cannedAgent = ({ verdict }: { verdict: Verdict }): CheckSource => {
  const sdk = mockAgent({ seed: { defaultResponse: verdict } });
  return {
    id: verdict.sourceId,
    layer: "ai",
    appliesTo: () => true,
    run: (ctx: RunContext) =>
      sdk.run({
        instructions: `review for ${verdict.sourceId}`,
        tools: ["read", "grep"],
        outputSchema: verdictSchema,
        context: ctx,
      }),
  };
};

let passes = 0;
let failures = 0;

const expect = ({ label, actual, expected }: { label: string; actual: string; expected: string }) => {
  if (actual === expected) {
    passes = passes + 1;
    console.log(`PASS: ${label} → ${actual}`);
  } else {
    failures = failures + 1;
    console.log(`FAIL: ${label} → expected ${expected}, got ${actual}`);
  }
};

const runScenario = async ({
  name,
  pr,
  checks,
  verdicts,
  expectedStatus,
  expectedOutcome,
}: {
  name: string;
  pr: PullRequest;
  checks: CheckRun[];
  verdicts: Verdict[];
  expectedStatus: string;
  expectedOutcome: string;
}) => {
  const prKey = `${pr.repo}#${pr.number}`;
  const run: StoredRun = {
    runId: `run-${pr.number}`,
    pr,
    status: "awaiting_checks",
    createdAt: now,
    updatedAt: now,
  };
  const store = mockStore({ seed: { runs: [run] } });
  const ports: OrchestratorPorts = {
    vcs: mockVcs({ seed: { prs: [pr], checkRuns: { [prKey]: checks } } }),
    sandbox: mockSandbox({ seed: { files: { "src/index.ts": "export const x = 1;" } } }),
    store,
    memory: mockMemory(),
    registry: verdicts.map((verdict) => cannedAgent({ verdict })),
    policy,
    resolveRepoConfig: () => repoConfig,
    now: () => now,
  };

  const detail = await runPipeline({ ports })(run.runId);
  expect({ label: `${name} status`, actual: detail.status, expected: expectedStatus });
  expect({ label: `${name} decision`, actual: detail.decision.outcome, expected: expectedOutcome });

  const persisted = await store.runs.get({ runId: run.runId });
  console.log(
    `  evidence: persisted status=${persisted?.status} riskScore=${detail.riskScore} reasons=[${detail.decision.reasons.join(" | ")}] verdicts=${detail.checks.length}`,
  );
  if (detail.decision.outcome === "escalate") {
    const escalation = await store.escalations.get({ runId: run.runId });
    console.log(
      `  evidence: brief.length=${detail.decision.brief?.length ?? 0} escalationSaved=${escalation !== undefined}`,
    );
  }
};

const main = async () => {
  await runScenario({
    name: "low-risk agree",
    pr: makePr({ number: 1, title: "Copy tweak" }),
    checks: greenChecks,
    verdicts: [
      {
        sourceId: "semantic",
        status: "pass",
        confidence: 0.95,
        riskContribution: 5,
        summary: "Copy-only change.",
        findings: [],
      },
      {
        sourceId: "security",
        status: "pass",
        confidence: 0.9,
        riskContribution: 5,
        summary: "No security impact.",
        findings: [],
      },
    ],
    expectedStatus: "completed",
    expectedOutcome: "auto_merge",
  });

  await runScenario({
    name: "disagreement",
    pr: makePr({ number: 2, title: "Refactor with mixed signals" }),
    checks: greenChecks,
    verdicts: [
      {
        sourceId: "semantic",
        status: "pass",
        confidence: 0.8,
        riskContribution: 10,
        summary: "Looks fine semantically.",
        findings: [],
      },
      {
        sourceId: "security",
        status: "needs_human",
        confidence: 0.6,
        riskContribution: 15,
        summary: "Uncertain about token handling.",
        findings: [
          {
            severity: "medium",
            title: "Token lifetime unclear",
            detail: "Cannot confirm rotation invalidates old tokens.",
            location: { file: "src/session.ts", line: 12 },
          },
        ],
      },
    ],
    expectedStatus: "completed",
    expectedOutcome: "escalate",
  });

  await runScenario({
    name: "sensitive path",
    pr: makePr({ number: 3, title: "Touch auth module" }),
    checks: greenChecks,
    verdicts: [
      {
        sourceId: "security",
        status: "pass",
        confidence: 0.85,
        riskContribution: 5,
        summary: "Change is small but in auth.",
        findings: [
          {
            severity: "low",
            title: "Auth path touched",
            detail: "Edits login flow.",
            location: { file: "src/auth/login.ts", line: 3 },
          },
        ],
      },
    ],
    expectedStatus: "completed",
    expectedOutcome: "escalate",
  });

  await runScenario({
    name: "gate not green",
    pr: makePr({ number: 4, title: "WIP with failing lint" }),
    checks: redChecks,
    verdicts: [
      {
        sourceId: "semantic",
        status: "pass",
        confidence: 0.9,
        riskContribution: 5,
        summary: "Would pass but gate is red.",
        findings: [],
      },
    ],
    expectedStatus: "awaiting_checks",
    expectedOutcome: "blocked",
  });

  // Standalone unit check: high aggregate risk escalates even when agents agree.
  const highRisk = decide({ policy })({
    gate: { allPassed: true, checks: greenChecks },
    verdicts: [
      {
        sourceId: "blast-radius",
        status: "warn",
        confidence: 0.7,
        riskContribution: 60,
        summary: "High blast radius.",
        findings: [],
      },
    ],
  });
  expect({ label: "risk-over-threshold decision", actual: highRisk.outcome, expected: "escalate" });

  const brief = buildBrief()({
    pr: makePr({ number: 5, title: "Brief render check" }),
    verdicts: [
      {
        sourceId: "security",
        status: "fail",
        confidence: 0.8,
        riskContribution: 40,
        summary: "Found an issue.",
        findings: [
          {
            severity: "high",
            title: "Hardcoded secret",
            detail: "API key committed.",
            location: { file: "src/config.ts", line: 9 },
          },
        ],
      },
    ],
  });
  const briefMentionsFinding = brief.includes("Hardcoded secret") && brief.includes("security");
  expect({
    label: "buildBrief includes finding + agent id",
    actual: String(briefMentionsFinding),
    expected: "true",
  });

  console.log(`\nSummary: ${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("Smoke failed:", error);
  process.exit(1);
});
