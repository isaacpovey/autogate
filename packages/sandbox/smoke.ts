import { execFile } from 'node:child_process';
import type { RepoConfig } from '@autogate/contracts';
import { podmanSandbox } from './src/index.js';

const pass = (msg: string): void => console.log(`PASS: ${msg}`);
const fail = (msg: string): void => console.log(`FAIL: ${msg}`);
const deferred = (reason: string): void => console.log(`DEFERRED: ${reason}`);

type Probe = { stdout: string; code: number };

const probe = ({ file, args }: { file: string; args: string[] }): Promise<Probe> =>
  new Promise((resolve) => {
    execFile(file, args, { encoding: 'utf8' }, (error, stdout) => {
      if (error === null) {
        resolve({ stdout, code: 0 });
        return;
      }
      const code = typeof error.code === 'number' ? error.code : 1;
      resolve({ stdout, code });
    });
  });

const repo = 'https://github.com/octocat/Hello-World.git';
const ref = 'master';

const config: RepoConfig = {
  id: 'hello-world',
  ragInclude: ['README'],
  sensitivePaths: [],
  agents: ['semantic'],
};

const main = async (): Promise<void> => {
  const version = await probe({ file: 'podman', args: ['--version'] });
  if (version.code !== 0) {
    deferred('podman not available on PATH');
    return;
  }
  const info = await probe({ file: 'podman', args: ['info', '--format', '{{.Host.Arch}}'] });
  if (info.code !== 0) {
    deferred('podman machine not running');
    return;
  }
  pass(`podman reachable (${version.stdout.trim()})`);

  const sandbox = podmanSandbox();

  const checkout = await sandbox.clone({ repo, ref, config });
  if (checkout.ref === ref) {
    pass(`clone returned checkout for ref=${checkout.ref}`);
  } else {
    fail(`clone ref mismatch: got ${checkout.ref}, want ${ref}`);
  }

  const listed = await checkout.access.list({ dir: '.' });
  const hasReadme = listed.some((entry) => entry.path === 'README');
  if (hasReadme) {
    pass(`list('.') returned ${listed.length} entries including README`);
  } else {
    fail(`list('.') missing README; got [${listed.map((e) => e.path).join(', ')}]`);
  }

  const body = await checkout.access.read({ path: 'README' });
  if (body.includes('Hello World')) {
    pass(`read('README') returned ${body.length} bytes containing "Hello World"`);
  } else {
    fail(`read('README') unexpected content: ${JSON.stringify(body.slice(0, 80))}`);
  }

  const hits = await checkout.access.grep({ pattern: 'Hello' });
  if (hits.length > 0 && hits.every((h) => h.text.includes('Hello'))) {
    pass(
      `grep('Hello') returned ${hits.length} match(es); first=${hits[0]?.file}:${hits[0]?.line}`,
    );
  } else {
    fail(`grep('Hello') returned ${hits.length} match(es)`);
  }

  const scopedHits = await checkout.access.grep({ pattern: 'Hello', include: ['README'] });
  if (scopedHits.every((h) => h.file === 'README')) {
    pass(`grep include=['README'] scoped to ${scopedHits.length} match(es), all in README`);
  } else {
    fail(`grep include scoping leaked: [${scopedHits.map((h) => h.file).join(', ')}]`);
  }

  let traversalRejected = false;
  try {
    await checkout.access.read({ path: '../etc/passwd' });
  } catch {
    traversalRejected = true;
  }
  if (traversalRejected) {
    pass("read('../etc/passwd') rejected (path traversal blocked)");
  } else {
    fail("read('../etc/passwd') was NOT rejected");
  }

  await sandbox.teardown({ checkout });
  pass('teardown completed');

  const leaks = await probe({
    file: 'podman',
    args: ['ps', '-a', '--filter', 'name=autogate-sbx-', '--format', '{{.Names}}'],
  });
  const remaining = leaks.stdout.split('\n').filter((line) => line.trim() !== '');
  if (remaining.length === 0) {
    pass('no leaked autogate-sbx- containers after teardown');
  } else {
    fail(`leaked containers remain: [${remaining.join(', ')}]`);
  }

  console.log('\nSmoke complete: podman SandboxRunner exercised against a real public ref.');
};

main().catch((error) => {
  console.log(`FAIL: smoke threw: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
