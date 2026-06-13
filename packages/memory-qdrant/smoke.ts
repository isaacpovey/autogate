import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PullRequest, RepoConfig, Verdict } from '@autogate/contracts';
import { createOpenAIEmbedder } from './src/embedder.js';
import { createMemoryClient } from './src/memory.js';
import { ingestRepo, recordDecision } from './src/ingest.js';

const QDRANT_URL = process.env.QDRANT_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const fail = (msg: string): void => {
  console.log(`FAIL: ${msg}`);
};

const buildFixture = async (): Promise<{ rootDir: string; cleanup: () => Promise<void> }> => {
  const rootDir = await mkdtemp(join(tmpdir(), 'autogate-memory-'));
  await mkdir(join(rootDir, 'src'), { recursive: true });
  await writeFile(
    join(rootDir, 'src', 'auth.ts'),
    [
      'export const verifyApiToken = ({ token }: { token: string }): boolean => {',
      '  // Validates the bearer token against the rotating signing secret.',
      '  return token.startsWith("agt_") && token.length === 40;',
      '};',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(rootDir, 'src', 'billing.ts'),
    [
      'export const computeInvoiceTotal = ({ cents }: { cents: number[] }): number =>',
      '  cents.reduce((sum, line) => sum + line, 0);',
    ].join('\n'),
    'utf8',
  );
  await writeFile(join(rootDir, 'README.md'), 'Should be skipped: not in ragInclude.', 'utf8');
  return {
    rootDir,
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
};

const main = async (): Promise<void> => {
  if (QDRANT_URL === undefined || OPENAI_API_KEY === undefined) {
    console.log(
      `DEFERRED: missing ${QDRANT_URL === undefined ? 'QDRANT_URL' : 'OPENAI_API_KEY'} — cannot reach real services.`,
    );
    process.exit(0);
  }

  const embedder = createOpenAIEmbedder({ apiKey: OPENAI_API_KEY });
  const memory = createMemoryClient({ url: QDRANT_URL, embedder });

  let passed = 0;
  let failed = 0;
  const ok = (msg: string): void => {
    passed = passed + 1;
    console.log(`PASS: ${msg}`);
  };
  const no = (msg: string): void => {
    failed = failed + 1;
    fail(msg);
  };

  // 0. Embedder produces 1536-dim vectors.
  const [probe] = await embedder.embed({ texts: ['dimension probe'] });
  if (probe !== undefined && probe.length === 1536) {
    ok(`embedder returned a ${probe.length}-dim vector (text-embedding-3-small)`);
  } else {
    no(`embedder returned ${probe?.length ?? 'no'} dims, expected 1536`);
  }

  // 1. ensureCollections creates the three collections.
  await memory.ensureCollections();
  ok('ensureCollections() created/verified code_knowledge, decisions, patterns');

  // 2. ingestRepo on a fixture repo populates code_knowledge.
  const fixture = await buildFixture();
  const repoConfig: RepoConfig = {
    id: 'smoke-fixture',
    ragInclude: ['src'],
    sensitivePaths: [],
    agents: [],
  };
  try {
    const { files, chunks } = await ingestRepo({ memory, rootDir: fixture.rootDir })({ repoConfig });
    if (files === 2 && chunks >= 2) {
      ok(`ingestRepo walked ragInclude=[src] -> ${files} files, ${chunks} chunks (README.md skipped)`);
    } else {
      no(`ingestRepo expected 2 files (README skipped), got ${files} files / ${chunks} chunks`);
    }

    // 3. A known query returns the expected file in top-k.
    const codeHits = await memory.query({
      collection: 'code_knowledge',
      text: 'verify bearer api token signing secret',
      limit: 5,
    });
    const topPaths = codeHits.map((hit) => hit.metadata.path);
    const authRank = topPaths.indexOf('src/auth.ts');
    if (authRank === 0) {
      ok(`code_knowledge top-k returned src/auth.ts at rank ${authRank} (paths: ${topPaths.join(', ')})`);
    } else if (authRank >= 0) {
      ok(`code_knowledge returned src/auth.ts at rank ${authRank} within top-k (paths: ${topPaths.join(', ')})`);
    } else {
      no(`code_knowledge top-k did not contain src/auth.ts (paths: ${topPaths.join(', ')})`);
    }
  } finally {
    await fixture.cleanup();
  }

  // 4. recordDecision -> query(decisions) round-trip retrieves the precedent.
  const uniqueSuffix = Date.now();
  const pr: PullRequest = {
    number: uniqueSuffix % 100000,
    title: `Harden quokka telemetry exporter ${uniqueSuffix}`,
    repo: 'autogate/smoke',
    author: 'isaac',
    url: 'https://github.com/autogate/smoke/pull/1',
    branch: 'feature/quokka',
    baseRef: 'main',
    headRef: 'feature/quokka',
    headSha: `sha-${uniqueSuffix}`,
    description: `Refactor the quokka telemetry exporter ${uniqueSuffix} to batch spans.`,
  };
  const verdicts: Verdict[] = [
    {
      sourceId: 'semantic',
      status: 'pass',
      confidence: 0.91,
      riskContribution: 8,
      summary: 'Behaviour preserved.',
      findings: [],
    },
  ];
  const written = await recordDecision({ memory })({
    pr,
    verdicts,
    override: { action: 'approve_merge', reason: 'Reviewed and approved.' },
  });

  const decisionHits = await memory.query({
    collection: 'decisions',
    text: `quokka telemetry exporter ${uniqueSuffix} batch spans`,
    limit: 3,
  });
  const found = decisionHits.find((hit) => hit.id === written.id);
  if (found !== undefined) {
    ok(
      `decisions round-trip: recordDecision wrote id=${written.id}; query retrieved it (decision=${found.metadata.decision}, verdicts="${found.metadata.verdicts}")`,
    );
  } else {
    no(
      `decisions round-trip failed: wrote id=${written.id} but query returned ids [${decisionHits.map((h) => h.id).join(', ')}]`,
    );
  }

  console.log(`\nSmoke summary: ${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((error) => {
  console.log(`FAIL: smoke threw — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
