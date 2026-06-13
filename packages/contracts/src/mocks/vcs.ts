import type { PullRequest } from '../schemas/domain.js';
import type { AwaitAllChecksResult, CheckRun, VcsProvider } from '../ports/index.js';
import { createCell } from './cell.js';

export type VcsSeed = {
  prs?: PullRequest[];
  diffs?: Record<string, string>;
  checkRuns?: Record<string, CheckRun[]>;
};

const prKey = ({ repo, number }: { repo: string; number: number }): string => `${repo}#${number}`;

const isPassingConclusion = ({ conclusion }: { conclusion: string }): boolean =>
  conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped';

const evaluateChecks = ({
  checks,
  required,
}: {
  checks: CheckRun[];
  required: 'all' | string[];
}): AwaitAllChecksResult => {
  const relevant =
    required === 'all'
      ? checks
      : checks.filter((check) => required.includes(check.name));
  const allPassed = relevant.every((check) => isPassingConclusion({ conclusion: check.conclusion }));
  return { allPassed, checks: relevant };
};

export const mockVcs = ({ seed }: { seed?: VcsSeed } = {}): VcsProvider => {
  const prs = createCell<PullRequest[]>()({ initial: seed?.prs ?? [] });
  const briefs = createCell<Record<string, string>>()({ initial: {} });
  const merged = createCell<Record<string, string>>()({ initial: {} });
  const diffs = seed?.diffs ?? {};
  const checkRuns = seed?.checkRuns ?? {};

  const getPR: VcsProvider['getPR'] = async ({ repo, number }) => {
    const found = prs.get().find((pr) => pr.repo === repo && pr.number === number);
    if (found === undefined) {
      throw new Error(`mockVcs: no PR seeded for ${prKey({ repo, number })}`);
    }
    return found;
  };

  return {
    getPR,
    getDiff: async ({ pr }) => diffs[prKey(pr)] ?? '',
    listCheckRuns: async ({ pr }) => checkRuns[prKey(pr)] ?? [],
    awaitAllChecks: async ({ pr, required }) =>
      evaluateChecks({ checks: checkRuns[prKey(pr)] ?? [], required }),
    postStatus: async () => {},
    postBrief: async ({ pr, brief }) => {
      briefs.set({ ...briefs.get(), [prKey(pr)]: brief });
    },
    merge: async ({ pr }) => {
      merged.set({ ...merged.get(), [prKey(pr)]: pr.headSha });
      return { merged: true, sha: pr.headSha };
    },
  };
};
