import {
  mockMemory,
  mockSandbox,
  type AwaitAllChecksResult,
  type CheckRun,
  type MergeResult,
  type Policy,
  type RepoConfig,
  type VcsProvider,
} from "@autogate/contracts";
import { createQueue, createRunResults, createStore, runMigrations } from "@autogate/store-postgres";
import { getAgent } from "@autogate/agents";
import { createClaudeAgentSdk } from "@autogate/agent-claude";
import { DEFAULT_POLICY, loadE2eFixtures, type E2eFixture } from "@autogate/evals";
import { runPipeline, type OrchestratorPorts } from "./orchestrator/index";

/**
 * Orchestrator worker. Drains the REAL Postgres job queue and, for each claimed
 * run, replays a bundled end-to-end scenario fixture through `runPipeline` with
 * the REAL Claude Agent SDK driving the Layer-2 agents. The fixture supplies the
 * code the agents read (seeded into a mock sandbox) and the set of agents to
 * fan out; Claude actually investigates that checkout and returns verdicts.
 *
 * Real Store + Queue (the point of this loop) and a green mock VCS gate so the
 * pipeline proceeds into Layer 2. The Podman sandbox and live GitHub VCS remain
 * out of scope inside a compose container; scenario fixtures stand in for the
 * checked-out PR code.
 */

type JobPayload = { runId: string };

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000);

const greenChecks: CheckRun[] = [
  { name: "check-types", conclusion: "success" },
  { name: "lint", conclusion: "success" },
];

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

const repoConfigFor = ({ fixture }: { fixture: E2eFixture }): RepoConfig => ({
  id: fixture.pr.repo,
  ragInclude: Object.keys(fixture.files ?? {}),
  sensitivePaths: fixture.sensitivePaths ?? [],
  requiredChecks: fixture.requiredChecks ?? "all",
  agents: Object.keys(fixture.agents),
});

/** Deterministically map a PR number onto one of the agent-bearing fixtures. */
const fixtureForPr = ({
  fixtures,
  prNumber,
}: {
  fixtures: E2eFixture[];
  prNumber: number;
}): E2eFixture => {
  const index = (((prNumber - 1) % fixtures.length) + fixtures.length) % fixtures.length;
  const fixture = fixtures[index];
  if (fixture === undefined) {
    throw new Error("worker: fixture index out of range");
  }
  return fixture;
};

const sleep = ({ ms }: { ms: number }): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const processJob =
  ({
    sdk,
    fixtures,
    store,
    runResults,
    queue,
  }: {
    sdk: ReturnType<typeof createClaudeAgentSdk>;
    fixtures: E2eFixture[];
    store: ReturnType<typeof createStore>;
    runResults: ReturnType<typeof createRunResults>;
    queue: ReturnType<typeof createQueue<JobPayload>>;
  }) =>
  async ({ id, runId }: { id: string; runId: string }): Promise<void> => {
    const existing = await store.runs.get({ runId });
    if (existing === undefined) {
      throw new Error(`worker: no run stored for ${runId}`);
    }
    const fixture = fixtureForPr({ fixtures, prNumber: existing.pr.number });
    console.log(
      `[worker] claimed job ${id} for run ${runId} — replaying fixture "${fixture.name}" with REAL Claude (agents: ${Object.keys(fixture.agents).join(", ")})`,
    );

    const ports: OrchestratorPorts = {
      vcs: greenVcs(),
      sandbox: mockSandbox({ seed: { files: fixture.files ?? {} } }),
      store,
      memory: mockMemory({ seed: fixture.memory ?? {} }),
      registry: Object.keys(fixture.agents).map((agentId) =>
        getAgent({ id: agentId }).build({ sdk }),
      ),
      policy: fixture.policy ?? (DEFAULT_POLICY as Policy),
      resolveRepoConfig: () => repoConfigFor({ fixture }),
      now: () => new Date().toISOString(),
      runResults,
    };

    const detail = await runPipeline({ ports })(runId);
    await queue.complete({ id });
    console.log(
      `[worker] completed job ${id}: run ${runId} status=${detail.status} outcome=${detail.decision.outcome} risk=${detail.riskScore} verdicts=${detail.checks.length}`,
    );
  };

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined) {
    throw new Error("worker: DATABASE_URL not set in environment.");
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("worker: ANTHROPIC_API_KEY not set — required to run the real Claude pipeline.");
  }
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

  await runMigrations({ connectionString });

  const sdk = createClaudeAgentSdk({ apiKey, model });
  const store = createStore({ connectionString });
  const queue = createQueue<JobPayload>({ connectionString });
  const runResults = createRunResults({ connectionString });

  const allFixtures = loadE2eFixtures();
  const fixtures = allFixtures.filter((fixture) => Object.keys(fixture.agents).length > 0);
  if (fixtures.length === 0) {
    throw new Error("worker: no agent-bearing e2e fixtures found to replay.");
  }

  const runJob = processJob({ sdk, fixtures, store, runResults, queue });

  console.log(
    `[worker] online (model ${model}); ${fixtures.length} scenario fixtures; polling queue every ${POLL_INTERVAL_MS}ms`,
  );

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
