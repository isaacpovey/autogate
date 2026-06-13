import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type {
  MemoryClient,
  MemoryRecord,
  OverrideRequest,
  PullRequest,
  RepoConfig,
  Verdict,
} from '@autogate/contracts';

const CHUNK_LINES = 80;
const MAX_FILE_BYTES = 256 * 1024;

const isIncluded = ({
  relativePath,
  ragInclude,
}: {
  relativePath: string;
  ragInclude: string[];
}): boolean => {
  const normalized = relativePath.split(sep).join('/');
  return ragInclude.some((pattern) => {
    const base = pattern.replace(/\/\*\*?$/, '').replace(/\/$/, '');
    return normalized === base || normalized.startsWith(`${base}/`);
  });
};

const isPrefixOfInclude = ({
  relativePath,
  ragInclude,
}: {
  relativePath: string;
  ragInclude: string[];
}): boolean => {
  const normalized = relativePath.split(sep).join('/');
  return ragInclude.some((pattern) => {
    const base = pattern.replace(/\/\*\*?$/, '').replace(/\/$/, '');
    return base === normalized || base.startsWith(`${normalized}/`) || normalized.startsWith(`${base}/`);
  });
};

const walk = async ({
  rootDir,
  dir,
  ragInclude,
}: {
  rootDir: string;
  dir: string;
  ragInclude: string[];
}): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await entries.reduce<Promise<string[]>>(async (prev, entry) => {
    const acc = await prev;
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      return acc;
    }
    const full = join(dir, entry.name);
    const relativePath = relative(rootDir, full);
    if (entry.isDirectory()) {
      if (!isPrefixOfInclude({ relativePath, ragInclude })) {
        return acc;
      }
      const nested = await walk({ rootDir, dir: full, ragInclude });
      return [...acc, ...nested];
    }
    if (!isIncluded({ relativePath, ragInclude })) {
      return acc;
    }
    return [...acc, full];
  }, Promise.resolve([]));
  return files;
};

const chunkContent = ({ content }: { content: string }): string[] => {
  const lines = content.split('\n');
  const chunkCount = Math.max(1, Math.ceil(lines.length / CHUNK_LINES));
  return Array.from({ length: chunkCount }, (_value, index) =>
    lines.slice(index * CHUNK_LINES, (index + 1) * CHUNK_LINES).join('\n'),
  ).filter((chunk) => chunk.trim().length > 0);
};

const recordsForFile = async ({
  rootDir,
  repoId,
  file,
}: {
  rootDir: string;
  repoId: string;
  file: string;
}): Promise<MemoryRecord[]> => {
  const info = await stat(file);
  if (info.size > MAX_FILE_BYTES) {
    return [];
  }
  const content = await readFile(file, 'utf8');
  const relativePath = relative(rootDir, file).split(sep).join('/');
  return chunkContent({ content }).map((chunk, index) => ({
    id: `${repoId}:${relativePath}#${index}`,
    text: `// ${relativePath}\n${chunk}`,
    metadata: { repo: repoId, path: relativePath, chunk: index, kind: 'code' },
  }));
};

export const ingestRepo =
  ({ memory, rootDir }: { memory: MemoryClient; rootDir: string }) =>
  async ({ repoConfig }: { repoConfig: RepoConfig }): Promise<{ files: number; chunks: number }> => {
    const files = await walk({ rootDir, dir: rootDir, ragInclude: repoConfig.ragInclude });
    const records = await files.reduce<Promise<MemoryRecord[]>>(async (prev, file) => {
      const acc = await prev;
      const fileRecords = await recordsForFile({ rootDir, repoId: repoConfig.id, file });
      return [...acc, ...fileRecords];
    }, Promise.resolve([]));
    if (records.length > 0) {
      await memory.upsert({ collection: 'code_knowledge', records });
    }
    return { files: files.length, chunks: records.length };
  };

const summariseVerdicts = ({ verdicts }: { verdicts: Verdict[] }): string =>
  verdicts.map((verdict) => `${verdict.sourceId}=${verdict.status}`).join(', ');

export const recordDecision =
  ({ memory }: { memory: MemoryClient }) =>
  async ({
    pr,
    verdicts,
    override,
  }: {
    pr: PullRequest;
    verdicts: Verdict[];
    override?: OverrideRequest;
  }): Promise<MemoryRecord> => {
    const verdictSummary = summariseVerdicts({ verdicts });
    const decision = override?.action ?? 'auto';
    const reason = override?.reason ?? 'no human override';
    const record: MemoryRecord = {
      id: `${pr.repo}#${pr.number}`,
      text: [
        `PR #${pr.number} (${pr.repo}): ${pr.title}`,
        pr.description,
        `Verdicts: ${verdictSummary}`,
        `Decision: ${decision} — ${reason}`,
      ].join('\n'),
      metadata: {
        repo: pr.repo,
        number: pr.number,
        author: pr.author,
        headSha: pr.headSha,
        decision,
        reason,
        verdicts: verdictSummary,
      },
    };
    await memory.upsert({ collection: 'decisions', records: [record] });
    return record;
  };
