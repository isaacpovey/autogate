import { randomUUID } from "node:crypto";
import {
  mockMemory,
  verdictSchema,
  type AwaitAllChecksResult,
  type CheckRun,
  type CheckSource,
  type MergeResult,
  type Policy,
  type PullRequest,
  type RepoConfig,
  type RunContext,
  type StoredRun,
  type Verdict,
  type VcsProvider,
} from "@autogate/contracts";
import { createStore, runMigrations } from "@autogate/store-postgres";
import { podmanSandbox } from "@autogate/sandbox";
import { runPipeline, type OrchestratorPorts } from "./src/orchestrator/index";

/**
 * FULL-REAL ticket-01 verification. Wires the REAL Postgres Store and the REAL
 * Podman SandboxRunner into `runPipeline`, with a mock VCS / memory and
 * mock-agent-backed AI CheckSources, then proves the all-green low-risk path
 * end-to-end: real clone, real persistence, `auto_merge` decision.
 */

const now = "2026-06-13T00:00:00.000Z";

// A small PUBLIC repo the real Podman sandbox can clone over the network.
const PUBLIC_REPO = "https://github.com/octocat/Hello-World.git";
const PUBLIC_REF = "master";

const policy: Policy = {
  riskEscalateThreshold: 50,
  escalateOnDisagreement: true,
  alwaysEscalatePaths: ["src/auth/**"],
};

const repoConfig: RepoConfig = {
  id: "hello-world",
  ragInclude: ["."],
  sensitivePaths: [],
  requiredChecks: "all",
  agents: ["semantic", "security"],
};

const greenChecks: CheckRun[] = [
  { name: "check-types", conclusion: "success" },
  { name: "lint", conclusion: "success" },
];

const pr: PullRequest = {
  number: 1,
  title: "Tweak README copy",
  repo: PUBLIC_REPO,
  author: "octocat",
  url: "https://github.com/octocat/Hello-World/pull/1",
  branch: PUBLIC_REF,
  baseRef: PUBLIC_REF,
  headRef: PUBLIC_REF,
  headSha: "deadbeef",
  description: "Low-risk copy change for integration smoke.",
};

/**
 * Hand-rolled VCS port: an all-green gate so the pipeline proceeds to Layer 2,
 * with no-op side effects that return sensible values. `getPR` points head at a
 * real public repo so the sandbox clone is exercised.
 */
const greenVcs = (): VcsProvider => ({
  getPR: async () => pr,
  getDiff: async () => "--- a/README\n+++ b/README\n@@\n-Hello World\n+Hello World!\n",
  listCheckRuns: async (): Promise<CheckRun[]> => greenChecks,
  awaitAllChecks: async (): Promise<AwaitAllChecksResult> => ({
    allPassed: true,
    checks: greenChecks,
  }),
  postStatus: async (): Promise<void> => {},
  postBrief: async (): Promise<void> => {},
  merge: async (): Promise<MergeResult> => ({ merged: true, sha: pr.headSha }),
});

/**
 * AI CheckSource that exercises the REAL sandbox by reading + listing the cloned
 * checkout, then folds a clone sample into its (low-risk, passing) verdict via
 * the mock AgentSdk's schema-validated output.
 */
const cloneProbeAgent = ({ sourceId }: { sourceId: string }): CheckSource => ({
  id: sourceId,
  layer: "ai",
  appliesTo: () => true,
  run: async (ctx: RunContext): Promise<Verdict> => {
    const entries = await ctx.repo.list({ dir: "." });
    const readme = await ctx.repo.read({ path: "README" });
    const sample = `files=${entries.length}; readme="${readme.trim().slice(0, 40)}"`;
    return verdictSchema.parse({
      sourceId,
      status: "pass",
      confidence: 0.95,
      riskContribution: 5,
      summary: `Low-risk; verified real clone (${sample}).`,
      findings: [],
    });
  },
});

/** Second AI source: low-risk pass, no sandbox calls, to confirm fan-out. */
const semanticAgent = (): CheckSource => ({
  id: "semantic",
  layer: "ai",
  appliesTo: () => true,
  run: async (): Promise<Verdict> =>
    verdictSchema.parse({
      sourceId: "semantic",
      status: "pass",
      confidence: 0.9,
      riskContribution: 5,
      summary: "Copy-only change; no semantic concerns.",
      findings: [],
    }),
});

let passes = 0;
let failures = 0;

const check = ({ label, ok, evidence }: { label: string; ok: boolean; evidence: string }): void => {
  if (ok) {
    passes = passes + 1;
    console.log(`PASS: ${label} → ${evidence}`);
  } else {
    failures = failures + 1;
    console.log(`FAIL: ${label} → ${evidence}`);
  }
};

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined) {
    console.log("FAIL: DATABASE_URL not set in environment.");
    process.exit(1);
  }

  // Tables already exist (ticket 03), but runMigrations is idempotent (IF NOT EXISTS).
  await runMigrations({ connectionString });

  const store = createStore({ connectionString });
  const sandbox = podmanSandbox();
  const vcs = greenVcs();

  const runId = `smoke-int-${randomUUID()}`;
  const seededRun: StoredRun = {
    runId,
    pr,
    status: "awaiting_checks",
    createdAt: now,
    updatedAt: now,
  };
  await store.runs.save({ run: seededRun });

  const ports: OrchestratorPorts = {
    vcs,
    sandbox,
    store,
    memory: mockMemory(),
    registry: [cloneProbeAgent({ sourceId: "security" }), semanticAgent()],
    policy,
    resolveRepoConfig: () => repoConfig,
    now: () => now,
  };

  const detail = await runPipeline({ ports })(runId);

  const gateGreen = detail.gate.failed === 0 && detail.gate.pending === 0 && detail.gate.total > 0;
  check({
    label: "Layer 1 gate all-passed",
    ok: gateGreen,
    evidence: `total=${detail.gate.total} passed=${detail.gate.passed} failed=${detail.gate.failed}`,
  });

  check({
    label: "decision outcome is auto_merge",
    ok: detail.decision.outcome === "auto_merge",
    evidence: `outcome=${detail.decision.outcome} riskScore=${detail.riskScore}`,
  });

  check({
    label: "aggregate risk below threshold",
    ok: detail.riskScore < policy.riskEscalateThreshold,
    evidence: `riskScore=${detail.riskScore} threshold=${policy.riskEscalateThreshold}`,
  });

  const probe = detail.checks.find((c) => c.sourceId === "security");
  const sawClone = probe !== undefined && probe.summary.includes("files=") && probe.summary.includes("readme=");
  check({
    label: "real sandbox clone observed by AI source",
    ok: sawClone,
    evidence: probe === undefined ? "no security verdict" : probe.summary,
  });

  check({
    label: "both AI sources ran",
    ok: detail.checks.length === 2,
    evidence: `verdictCount=${detail.checks.length} ids=[${detail.checks.map((c) => c.sourceId).join(", ")}]`,
  });

  // --- Persistence: re-read from REAL Postgres and assert it matches. ---
  const persistedRun = await store.runs.get({ runId });
  check({
    label: "run persisted in Postgres with status completed",
    ok: persistedRun !== undefined && persistedRun.status === "completed",
    evidence: `persistedStatus=${persistedRun?.status ?? "<missing>"}`,
  });

  check({
    label: "persisted run round-trips PR repo + ref",
    ok: persistedRun?.pr.repo === PUBLIC_REPO && persistedRun?.pr.headRef === PUBLIC_REF,
    evidence: `repo=${persistedRun?.pr.repo} headRef=${persistedRun?.pr.headRef}`,
  });

  const persistedVerdicts = await store.verdicts.listForRun({ runId });
  const persistedIds = [...persistedVerdicts].map((v) => v.sourceId).sort();
  check({
    label: "verdicts persisted in Postgres",
    ok: persistedVerdicts.length === 2,
    evidence: `verdictCount=${persistedVerdicts.length} ids=[${persistedIds.join(", ")}] layer=${persistedVerdicts[0]?.layer ?? "?"}`,
  });

  const persistedProbe = persistedVerdicts.find((v) => v.sourceId === "security");
  check({
    label: "persisted verdict matches in-memory verdict",
    ok:
      persistedProbe !== undefined &&
      persistedProbe.status === "pass" &&
      persistedProbe.summary === probe?.summary,
    evidence: `persistedStatus=${persistedProbe?.status} summaryMatch=${persistedProbe?.summary === probe?.summary}`,
  });

  console.log(`\nSummary: ${passes} passed, ${failures} failed.`);
  // postgres-js holds an open pool that keeps the event loop alive; the Store
  // port exposes no close, so exit explicitly once assertions are done.
  process.exit(failures > 0 ? 1 : 0);
};

main().catch((error) => {
  console.error("Integration smoke failed:", error);
  process.exit(1);
});
