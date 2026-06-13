import {
  mockMemory,
  mockSandbox,
  verdictSchema,
  type AwaitAllChecksResult,
  type CheckRun,
  type CheckSource,
  type MergeResult,
  type Policy,
  type RepoConfig,
  type VcsProvider,
  type Verdict,
} from "@autogate/contracts";
import { createQueue, createRunResults, createStore, runMigrations } from "@autogate/store-postgres";
import { runPipeline, type OrchestratorPorts } from "./orchestrator/index";

/**
 * Orchestrator worker. Drains the REAL Postgres job queue and runs the L2 agent
 * pipeline for each claimed run, then loops. This is the long-lived counterpart
 * to the HTTP api (`index.ts`): the api/webhook layer seeds a `StoredRun` and
 * enqueues a `{ runId }` job; this worker claims it and drives `runPipeline` to
 * completion.
 *
 * Ports are wired pragmatically for the compose stack: REAL Store + Queue (the
 * point of this loop) with a mock VCS (all-green gate), mock sandbox, mock
 * memory, and low-risk mock-agent-backed AI CheckSources. The real Podman
 * sandbox and GitHub VCS are exercised by tickets 02/04, not from inside a
 * compose container.
 */

type JobPayload = { runId: string };

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000);

const greenChecks: CheckRun[] = [
  { name: "check-types", conclusion: "success" },
  { name: "lint", conclusion: "success" },
];

const policy: Policy = {
  riskEscalateThreshold: 50,
  escalateOnDisagreement: true,
  alwaysEscalatePaths: ["src/auth/**"],
};

const repoConfig: RepoConfig = {
  id: "worker-fixture",
  ragInclude: ["."],
  sensitivePaths: [],
  requiredChecks: "all",
  agents: ["semantic", "security"],
};

/** All-green VCS so the pipeline proceeds past the Layer 1 gate into Layer 2. */
const greenVcs = (): VcsProvider => ({
  getPR: async () => {
    throw new Error("worker greenVcs.getPR: unused; run is pre-seeded");
  },
  getDiff: async () => "",
  listCheckRuns: async (): Promise<CheckRun[]> => greenChecks,
  awaitAllChecks: async (): Promise<AwaitAllChecksResult> => ({
    allPassed: true,
    checks: greenChecks,
  }),
  postStatus: async (): Promise<void> => {},
  postBrief: async (): Promise<void> => {},
  merge: async (): Promise<MergeResult> => ({ merged: true, sha: "fixture" }),
});

/** Two low-risk passing AI sources to confirm the Layer 2 fan-out persists verdicts. */
const passingAgent = ({ sourceId }: { sourceId: string }): CheckSource => ({
  id: sourceId,
  layer: "ai",
  appliesTo: () => true,
  run: async (): Promise<Verdict> =>
    verdictSchema.parse({
      sourceId,
      status: "pass",
      confidence: 0.95,
      riskContribution: 5,
      summary: `Low-risk pass from worker fixture source ${sourceId}.`,
      findings: [],
    }),
});

const sleep = ({ ms }: { ms: number }): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const processJob =
  ({ ports, queue }: { ports: OrchestratorPorts; queue: ReturnType<typeof createQueue<JobPayload>> }) =>
  async ({ id, runId }: { id: string; runId: string }): Promise<void> => {
    console.log(`[worker] claimed job ${id} for run ${runId}`);
    const detail = await runPipeline({ ports })(runId);
    await queue.complete({ id });
    console.log(
      `[worker] completed job ${id}: run ${runId} status=${detail.status} outcome=${detail.decision.outcome} verdicts=${detail.checks.length}`,
    );
  };

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined) {
    throw new Error("worker: DATABASE_URL not set in environment.");
  }

  await runMigrations({ connectionString });

  const store = createStore({ connectionString });
  const queue = createQueue<JobPayload>({ connectionString });
  const runResults = createRunResults({ connectionString });

  const ports: OrchestratorPorts = {
    vcs: greenVcs(),
    sandbox: mockSandbox({ seed: { files: { "README.md": "# fixture\n" } } }),
    store,
    memory: mockMemory(),
    registry: [passingAgent({ sourceId: "security" }), passingAgent({ sourceId: "semantic" })],
    policy,
    resolveRepoConfig: () => repoConfig,
    now: () => new Date().toISOString(),
    runResults,
  };

  const runJob = processJob({ ports, queue });

  console.log(`[worker] online; polling queue every ${POLL_INTERVAL_MS}ms`);

  const loop = async (): Promise<void> => {
    const job = await queue.claim();
    if (job === undefined) {
      await sleep({ ms: POLL_INTERVAL_MS });
      return loop();
    }
    await runJob({ id: job.id, runId: job.payload.runId }).catch((error) => {
      console.error(`[worker] job ${job.id} failed:`, error);
    });
    return loop();
  };

  await loop();
};

main().catch((error) => {
  console.error("[worker] fatal:", error);
  process.exit(1);
});
