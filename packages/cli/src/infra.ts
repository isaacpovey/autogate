import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { repoConfigSchema, type PullRequest, type StoredRun } from '@autogate/contracts';
import { createQueue, createRunResults, createStore, runMigrations } from '@autogate/store-postgres';
import { createMemoryClient, ingestRepo } from '@autogate/memory-qdrant';
import { loadE2eFixtures } from '@autogate/evals';
import { resolveEmbedder } from './embedder.js';
import { seedStore } from './seed.js';

const DEFAULT_DATABASE_URL = 'postgres://autogate:autogate@localhost:5432/autogate';
const DEFAULT_QDRANT_URL = 'http://localhost:6333';

/** Tables `runMigrations` ensures — surfaced for a readable migrate summary. */
const MIGRATED_TABLES = ['runs', 'verdicts', 'escalations', 'overrides', 'jobs'];

const databaseUrl = (): string => process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
const qdrantUrl = (): string => process.env.QDRANT_URL ?? DEFAULT_QDRANT_URL;

const emit = ({
  json,
  line,
  data,
}: {
  json: boolean;
  line: string;
  data: Record<string, unknown>;
}): void => {
  console.log(json ? JSON.stringify(data) : line);
};

/** `db migrate` — apply the Postgres schema via the store adapter (idempotent). */
export const dbMigrate = async ({ json }: { json: boolean }): Promise<void> => {
  await runMigrations({ connectionString: databaseUrl() });
  emit({
    json,
    line: `db migrate: ok (${MIGRATED_TABLES.join(', ')})`,
    data: { command: 'db migrate', ok: true, tables: MIGRATED_TABLES },
  });
};

/** `db seed` — write the demo dataset through the Store port. Assumes migrations have run. */
export const dbSeed = async ({ json }: { json: boolean }): Promise<void> => {
  const connectionString = databaseUrl();
  const store = createStore({ connectionString });
  const runResults = createRunResults({ connectionString });
  const counts = await seedStore({ store, runResults });
  emit({
    json,
    line: `db seed: ok (${counts.runs} runs, ${counts.verdicts} verdicts, ${counts.escalations} escalation, ${counts.results} results)`,
    data: { command: 'db seed', ok: true, ...counts },
  });
};

/** `ingest <repoConfig>` — ingest a repo into Qdrant via the memory adapter; report counts. */
export const ingest = async ({
  configPath,
  root,
  json,
}: {
  configPath: string;
  root?: string;
  json: boolean;
}): Promise<void> => {
  const repoConfig = repoConfigSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')));
  const rootDir = root ?? process.cwd();
  const { embedder, mode } = resolveEmbedder({ openaiApiKey: process.env.OPENAI_API_KEY });
  const memory = createMemoryClient({ url: qdrantUrl(), embedder });
  await memory.ensureCollections();
  const { files, chunks } = await ingestRepo({ memory, rootDir })({ repoConfig });
  emit({
    json,
    line: `ingest ${repoConfig.id}: ok (${files} documents, ${chunks} chunks → code_knowledge) [embedder: ${mode}]`,
    data: {
      command: 'ingest',
      ok: true,
      repo: repoConfig.id,
      documents: files,
      chunks,
      collection: 'code_knowledge',
      embedder: mode,
    },
  });
};

/** `run enqueue --repo <id> --pr <n>` — seed a run + enqueue a job via the queue; print the run id. */
export const runEnqueue = async ({
  repo,
  prNumber,
  json,
}: {
  repo: string;
  prNumber: number;
  json: boolean;
}): Promise<void> => {
  const connectionString = databaseUrl();
  const store = createStore({ connectionString });
  const queue = createQueue<{ runId: string }>({ connectionString });

  const runId = `run-${randomUUID()}`;
  const now = new Date().toISOString();
  const pr: PullRequest = {
    number: prNumber,
    title: `Run for ${repo}#${prNumber}`,
    repo,
    author: 'cli',
    url: `https://github.com/${repo}/pull/${prNumber}`,
    branch: `pr-${prNumber}`,
    baseRef: 'main',
    headRef: `pr-${prNumber}`,
    headSha: `enqueue-${prNumber}`,
    description: 'Enqueued via `autogate run enqueue`.',
  };
  const run: StoredRun = { runId, pr, status: 'awaiting_checks', createdAt: now, updatedAt: now };
  await store.runs.save({ run });

  const jobId = `job-${runId}`;
  await queue.enqueue({ id: jobId, payload: { runId } });

  emit({
    json,
    line: `run enqueue: ok (runId=${runId} job=${jobId} repo=${repo} pr=${prNumber})`,
    data: { command: 'run enqueue', ok: true, runId, jobId, repo, pr: prNumber },
  });
};

/**
 * `run scenarios` — seed + enqueue one run per bundled e2e scenario fixture,
 * each carrying the fixture's real PR (title/description/branch) so the
 * dashboard shows the actual synthetic scenario. The job payload names the
 * fixture so the worker replays exactly that scenario.
 */
export const runScenarios = async ({ json }: { json: boolean }): Promise<void> => {
  const connectionString = databaseUrl();
  const store = createStore({ connectionString });
  const queue = createQueue<{ runId: string; fixture: string }>({ connectionString });

  const fixtures = loadE2eFixtures().filter(
    (fixture) => Object.keys(fixture.agents).length > 0,
  );
  const now = new Date().toISOString();

  const seeded = await Promise.all(
    fixtures.map(async (fixture) => {
      const runId = `run-${randomUUID()}`;
      const pr: PullRequest = fixture.pr;
      const run: StoredRun = {
        runId,
        pr,
        status: 'awaiting_checks',
        createdAt: now,
        updatedAt: now,
      };
      await store.runs.save({ run });
      const jobId = `job-${runId}`;
      await queue.enqueue({ id: jobId, payload: { runId, fixture: fixture.name } });
      return { fixture: fixture.name, runId, pr: pr.number, title: pr.title };
    }),
  );

  emit({
    json,
    line: `run scenarios: ok (${seeded.length} enqueued: ${seeded.map((s) => s.fixture).join(', ')})`,
    data: { command: 'run scenarios', ok: true, scenarios: seeded },
  });
};
