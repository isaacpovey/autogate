import { createServer, type Server } from 'node:http';
import { Webhooks, createNodeMiddleware } from '@octokit/webhooks';
import type { VcsProvider } from '@autogate/contracts';
import { evaluateChecks } from './checks.js';

export type ReadyEvent = {
  repo: string;
  prNumber: number;
};

export type WebhookHandlerDeps = {
  secret: string;
  onReady: (event: ReadyEvent) => Promise<void> | void;
  vcs?: VcsProvider;
};

export type WebhookHandler = {
  webhooks: Webhooks;
  path: string;
};

const webhookPath = '/api/github/webhooks';

const firstPrNumber = ({
  pullRequests,
}: {
  pullRequests: ReadonlyArray<{ number: number }>;
}): number | undefined => pullRequests[0]?.number;

export const createWebhookHandler = ({
  secret,
  onReady,
  vcs,
}: WebhookHandlerDeps): WebhookHandler => {
  const webhooks = new Webhooks({ secret });

  webhooks.on('check_suite.completed', async ({ payload }) => {
    if (payload.check_suite.conclusion !== 'success') {
      return;
    }
    const prNumber = firstPrNumber({ pullRequests: payload.check_suite.pull_requests });
    if (prNumber === undefined) {
      return;
    }
    await onReady({ repo: payload.repository.full_name, prNumber });
  });

  webhooks.on('pull_request.opened', async ({ payload }) => {
    const repo = payload.repository.full_name;
    const prNumber = payload.pull_request.number;

    if (vcs === undefined) {
      return;
    }

    const pr = await vcs.getPR({ repo, number: prNumber });
    const checks = await vcs.listCheckRuns({ pr });
    if (checks.length === 0) {
      return;
    }
    const { allPassed } = evaluateChecks({ checks, required: 'all' });
    if (allPassed) {
      await onReady({ repo, prNumber });
    }
  });

  return { webhooks, path: webhookPath };
};

export type SmeeConfig = {
  proxyUrl: string;
  handler: WebhookHandler;
  port?: number;
};

export type SmeeConnection = {
  close: () => Promise<void>;
};

/**
 * Bridges a public smee.io channel to the local webhook handler. smee forwards each
 * GitHub delivery over HTTP to a local node server running the @octokit/webhooks
 * middleware, which verifies the signature and dispatches to the registered listeners.
 * smee-client is imported lazily so the adapter stays usable where it is not installed.
 */
export const startSmee = async ({
  proxyUrl,
  handler,
  port = 3030,
}: SmeeConfig): Promise<SmeeConnection> => {
  const { default: SmeeClient } = await import('smee-client');

  const middleware = createNodeMiddleware(handler.webhooks, { path: handler.path });
  const server: Server = createServer(middleware);

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  const smee = new SmeeClient({
    source: proxyUrl,
    target: `http://localhost:${port}${handler.path}`,
    logger: console,
  });
  const events = await smee.start();

  return {
    close: async () => {
      events.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
};
