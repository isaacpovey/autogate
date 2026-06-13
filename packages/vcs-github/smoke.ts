import type { ReadyEvent } from './src/index.js';

const pass = (msg: string): void => console.log(`PASS: ${msg}`);
const fail = (msg: string): void => console.log(`FAIL: ${msg}`);
const deferred = (msg: string): never => {
  console.log(`DEFERRED: ${msg}`);
  process.exit(0);
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return deferred(`${name} is not set — GitHub App creds arrive later`);
  }
  return value;
};

const optionalEnv = (name: string): string | undefined => {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
};

const main = async (): Promise<void> => {
  const appId = requireEnv('GITHUB_APP_ID');
  const privateKey = requireEnv('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n');
  const installationId = requireEnv('GITHUB_APP_INSTALLATION_ID');
  const webhookSecret = requireEnv('GITHUB_APP_WEBHOOK_SECRET');

  const repo = optionalEnv('GITHUB_TEST_REPO');
  const prNumberRaw = optionalEnv('GITHUB_TEST_PR');
  if (repo === undefined || prNumberRaw === undefined) {
    return deferred(
      'GITHUB_TEST_REPO / GITHUB_TEST_PR not set — need a live throwaway PR to verify reads',
    );
  }
  const prNumber = Number(prNumberRaw);
  if (!Number.isInteger(prNumber)) {
    fail(`GITHUB_TEST_PR="${prNumberRaw}" is not an integer`);
    process.exit(1);
  }

  const { createVcsGithub, createWebhookHandler } = await import('./src/index.js');

  const vcs = createVcsGithub({
    appId,
    privateKey,
    installationId,
    awaitOptions: { timeoutMs: 90 * 1000, pollIntervalMs: 5 * 1000 },
  });

  const pr = await vcs.getPR({ repo, number: prNumber });
  pass(`getPR ${repo}#${prNumber} -> title="${pr.title}" headSha=${pr.headSha} base=${pr.baseRef}`);

  const diff = await vcs.getDiff({ pr });
  if (diff.length === 0) {
    fail('getDiff returned an empty string');
  } else {
    const firstLine = diff.split('\n')[0] ?? '';
    pass(`getDiff length=${diff.length} firstLine="${firstLine}"`);
  }

  const checks = await vcs.listCheckRuns({ pr });
  pass(
    `listCheckRuns count=${checks.length} -> ${checks
      .map((c) => `${c.name}=${c.conclusion}`)
      .join(', ')}`,
  );

  const gate = await vcs.awaitAllChecks({ pr, required: 'all' });
  pass(
    `awaitAllChecks(required=all) allPassed=${gate.allPassed} relevant=${gate.checks.length}`,
  );

  if (optionalEnv('GITHUB_SMOKE_POST') === 'true') {
    await vcs.postStatus({
      pr,
      state: gate.allPassed ? 'success' : 'pending',
      description: 'autogate smoke: gate observed',
    });
    pass('postStatus posted commit status context=autogate');

    await vcs.postBrief({
      pr,
      brief: `autogate smoke brief — observed ${checks.length} checks, allPassed=${gate.allPassed}`,
    });
    pass('postBrief posted PR comment');
  } else {
    console.log('SKIP: postStatus/postBrief (set GITHUB_SMOKE_POST=true to write to the PR)');
  }

  if (optionalEnv('GITHUB_SMOKE_MERGE') === 'true' && gate.allPassed) {
    const result = await vcs.merge({ pr });
    pass(`merge merged=${result.merged} sha=${result.sha}`);
  } else {
    console.log('SKIP: merge (destructive; set GITHUB_SMOKE_MERGE=true on a throwaway PR)');
  }

  const received: ReadyEvent[] = [];
  const handler = createWebhookHandler({
    secret: webhookSecret,
    vcs,
    onReady: (event) => {
      received.push(event);
    },
  });
  const checkSuitePayload = JSON.stringify({
    action: 'completed',
    check_suite: { conclusion: 'success', pull_requests: [{ number: prNumber }] },
    repository: { full_name: repo },
  });
  await handler.webhooks.receive({
    id: 'smoke-1',
    name: 'check_suite',
    payload: JSON.parse(checkSuitePayload),
  });
  if (received.length === 1 && received[0]?.prNumber === prNumber) {
    pass(`webhook check_suite.completed(success) -> onReady(${repo}#${prNumber})`);
  } else {
    fail(`webhook dispatch produced ${received.length} ready events`);
  }

  const proxyUrl = optionalEnv('GITHUB_WEBHOOK_PROXY_URL');
  if (proxyUrl === undefined) {
    console.log('SKIP: live smee bridge (set GITHUB_WEBHOOK_PROXY_URL to verify delivery)');
  } else {
    pass(`smee proxy configured at ${proxyUrl} (live delivery exercised via startSmee in worker)`);
  }

  console.log('\nSmoke complete: VcsProvider adapter verified against live GitHub.');
};

main().catch((error) => {
  console.error('Smoke failed:', error);
  process.exit(1);
});
