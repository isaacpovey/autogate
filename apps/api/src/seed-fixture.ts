import { randomUUID } from "node:crypto";
import type { PullRequest, StoredRun } from "@autogate/contracts";
import { createQueue, createStore, runMigrations } from "@autogate/store-postgres";

/**
 * Fixture seeder for the compose stack. Seeds one `StoredRun` (status
 * `awaiting_checks`, as `runPipeline` expects) and enqueues a matching
 * `{ runId }` job, then prints the run id. The worker claims the job, runs the
 * pipeline, and drives the run to `completed`.
 *
 * Run against the stack's exposed Postgres (DATABASE_URL pointing at
 * localhost:5432) or as a one-shot inside the compose network.
 */

type JobPayload = { runId: string };

const now = new Date().toISOString();

const pr: PullRequest = {
  number: 1,
  title: "Fixture run for ticket 06 integration",
  repo: "autogate/fixture",
  author: "fixture-bot",
  url: "https://example.invalid/autogate/fixture/pull/1",
  branch: "fixture/main",
  baseRef: "main",
  headRef: "fixture/main",
  headSha: "fixturesha",
  description: "End-to-end queue->pipeline->DB fixture.",
};

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined) {
    throw new Error("seed-fixture: DATABASE_URL not set in environment.");
  }

  await runMigrations({ connectionString });

  const store = createStore({ connectionString });
  const queue = createQueue<JobPayload>({ connectionString });

  const runId = `fixture-${randomUUID()}`;
  const seededRun: StoredRun = {
    runId,
    pr,
    status: "awaiting_checks",
    createdAt: now,
    updatedAt: now,
  };

  await store.runs.save({ run: seededRun });
  await queue.enqueue({ id: `job-${runId}`, payload: { runId } });

  console.log(`SEEDED_RUN_ID=${runId}`);
  process.exit(0);
};

main().catch((error) => {
  console.error("[seed-fixture] fatal:", error);
  process.exit(1);
});
