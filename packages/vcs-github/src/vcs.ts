import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import type {
  AwaitAllChecksResult,
  CheckRun,
  PullRequest,
  VcsProvider,
} from '@autogate/contracts';
import { parseRepo } from './repo.js';
import { combineCheckRuns, evaluateChecks, requiredAreComplete } from './checks.js';
import { delay } from './delay.js';

export type GithubAppConfig = {
  appId: string | number;
  privateKey: string;
  installationId: string | number;
};

export type AwaitOptions = {
  timeoutMs: number;
  pollIntervalMs: number;
};

const defaultAwaitOptions: AwaitOptions = {
  timeoutMs: 15 * 60 * 1000,
  pollIntervalMs: 10 * 1000,
};

const statusStateToConclusion = ({ state }: { state: string }): string =>
  state === 'pending' ? 'pending' : state === 'success' ? 'success' : 'failure';

const checkRunToConclusion = ({
  status,
  conclusion,
}: {
  status: string;
  conclusion: string | null;
}): string => (status === 'completed' ? conclusion ?? 'failure' : status);

const fetchCheckRuns =
  ({ octokit }: { octokit: Octokit }) =>
  async ({ pr }: { pr: PullRequest }): Promise<CheckRun[]> => {
    const { owner, repo } = parseRepo({ repo: pr.repo });
    const runs = await octokit.paginate(octokit.checks.listForRef, {
      owner,
      repo,
      ref: pr.headSha,
      per_page: 100,
    });
    const statuses = await octokit.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref: pr.headSha,
    });

    const checkRuns: CheckRun[] = runs.map((run) => ({
      name: run.name,
      conclusion: checkRunToConclusion({ status: run.status, conclusion: run.conclusion }),
      url: run.html_url ?? undefined,
    }));

    const statusChecks: CheckRun[] = statuses.data.statuses.map((status) => ({
      name: status.context,
      conclusion: statusStateToConclusion({ state: status.state }),
      url: status.target_url ?? undefined,
    }));

    return combineCheckRuns({ checkRuns, statuses: statusChecks });
  };

export const createVcsGithub = ({
  appId,
  privateKey,
  installationId,
  awaitOptions = defaultAwaitOptions,
}: GithubAppConfig & { awaitOptions?: AwaitOptions }): VcsProvider => {
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  });

  const listCheckRuns = fetchCheckRuns({ octokit });

  const getPR: VcsProvider['getPR'] = async ({ repo, number }) => {
    const parsed = parseRepo({ repo });
    const { data } = await octokit.pulls.get({
      owner: parsed.owner,
      repo: parsed.repo,
      pull_number: number,
    });
    return {
      number: data.number,
      title: data.title,
      repo,
      author: data.user?.login ?? 'unknown',
      url: data.html_url,
      branch: data.head.ref,
      baseRef: data.base.ref,
      headRef: data.head.ref,
      headSha: data.head.sha,
      description: data.body ?? '',
    };
  };

  const getDiff: VcsProvider['getDiff'] = async ({ pr }) => {
    const { owner, repo } = parseRepo({ repo: pr.repo });
    const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: pr.number,
      mediaType: { format: 'diff' },
    });
    return String(response.data);
  };

  const awaitAllChecks: VcsProvider['awaitAllChecks'] = async ({ pr, required }) => {
    const deadline = Date.now() + awaitOptions.timeoutMs;

    const poll = async (): Promise<AwaitAllChecksResult> => {
      const checks = await listCheckRuns({ pr });
      if (requiredAreComplete({ checks, required })) {
        return evaluateChecks({ checks, required });
      }
      if (Date.now() >= deadline) {
        return { allPassed: false, checks: evaluateChecks({ checks, required }).checks };
      }
      await delay({ ms: awaitOptions.pollIntervalMs });
      return poll();
    };

    return poll();
  };

  const postStatus: VcsProvider['postStatus'] = async ({ pr, state, description }) => {
    const { owner, repo } = parseRepo({ repo: pr.repo });
    await octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: pr.headSha,
      state,
      description,
      context: 'autogate',
    });
  };

  const postBrief: VcsProvider['postBrief'] = async ({ pr, brief }) => {
    const { owner, repo } = parseRepo({ repo: pr.repo });
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pr.number,
      body: brief,
    });
  };

  const merge: VcsProvider['merge'] = async ({ pr }) => {
    const { owner, repo } = parseRepo({ repo: pr.repo });
    const { data } = await octokit.pulls.merge({
      owner,
      repo,
      pull_number: pr.number,
      sha: pr.headSha,
    });
    return { merged: data.merged, sha: data.sha };
  };

  return {
    getPR,
    getDiff,
    listCheckRuns,
    awaitAllChecks,
    postStatus,
    postBrief,
    merge,
  };
};
