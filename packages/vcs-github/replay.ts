import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createWebhookHandler, type ReadyEvent } from './src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

const sign =
  ({ secret }: { secret: string }) =>
  ({ payload }: { payload: string }): string =>
    `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

const main = async (): Promise<void> => {
  const secret = 'autogate-replay-secret';
  const fixturePath = join(here, 'fixtures', 'check_suite.json');
  const rawPayload = await readFile(fixturePath, 'utf8');
  const parsed: { repository: { full_name: string }; check_suite: { pull_requests: Array<{ number: number }> } } =
    JSON.parse(rawPayload);
  const expectedRepo = parsed.repository.full_name;
  const expectedPr = parsed.check_suite.pull_requests[0]?.number;

  const received: ReadyEvent[] = [];
  const handler = createWebhookHandler({
    secret,
    onReady: (event) => {
      received.push(event);
    },
  });

  const signature = sign({ secret })({ payload: rawPayload });
  await handler.webhooks.verifyAndReceive({
    id: 'replay-1',
    name: 'check_suite',
    payload: rawPayload,
    signature,
  });

  const event = received[0];
  const ok =
    received.length === 1 && event?.repo === expectedRepo && event?.prNumber === expectedPr;

  if (ok) {
    console.log(
      `PASS: webhook REPLAY check_suite.completed(success) verified signature + onReady fired -> repo=${event?.repo} pr=${event?.prNumber} (events=${received.length})`,
    );
  } else {
    console.log(
      `FAIL: webhook REPLAY produced ${received.length} events; got repo=${event?.repo} pr=${event?.prNumber}, expected repo=${expectedRepo} pr=${expectedPr}`,
    );
    process.exit(1);
  }

  const tampered: ReadyEvent[] = [];
  const tamperHandler = createWebhookHandler({
    secret,
    onReady: (e) => {
      tampered.push(e);
    },
  });
  const badSignature = sign({ secret: 'wrong-secret' })({ payload: rawPayload });
  const rejected = await tamperHandler.webhooks
    .verifyAndReceive({
      id: 'replay-2',
      name: 'check_suite',
      payload: rawPayload,
      signature: badSignature,
    })
    .then(() => false)
    .catch(() => true);

  if (rejected && tampered.length === 0) {
    console.log('PASS: webhook REPLAY rejected a bad-signature delivery (onReady not fired)');
  } else {
    console.log(`FAIL: bad-signature delivery was not rejected (events=${tampered.length})`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('FAIL: replay threw', error);
  process.exit(1);
});
