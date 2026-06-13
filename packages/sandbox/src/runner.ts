import { randomBytes } from 'node:crypto';
import type {
  RepoAccess,
  RepoFileEntry,
  RepoGrepMatch,
  SandboxCheckout,
  SandboxRunner,
} from '@autogate/contracts';
import { nodeExec, type Exec, type ExecResult } from './exec.js';
import { parseGrep, parseLsLong } from './parse.js';
import { toContainerPath } from './paths.js';

const image = 'alpine/git';
const workDir = '/work';

const shortId = (): string => randomBytes(4).toString('hex');

const containerName = ({ id }: { id: string }): string => `autogate-sbx-${id}`;

const ensureOk = ({ result, action }: { result: ExecResult; action: string }): ExecResult => {
  if (result.code !== 0) {
    throw new Error(`sandbox: ${action} failed (exit ${result.code}): ${result.stderr.trim()}`);
  }
  return result;
};

const podmanExec =
  ({ exec, container }: { exec: Exec; container: string }) =>
  ({ command }: { command: string[] }): Promise<ExecResult> =>
    exec({ file: 'podman', args: ['exec', container, ...command] });

const buildAccess = ({
  exec,
  container,
}: {
  exec: Exec;
  container: string;
}): RepoAccess => {
  const inside = podmanExec({ exec, container });
  return {
    read: async ({ path }): Promise<string> => {
      const target = toContainerPath({ path });
      const result = await inside({ command: ['cat', target] });
      return ensureOk({ result, action: `read ${path}` }).stdout;
    },
    list: async ({ dir }): Promise<RepoFileEntry[]> => {
      const target = toContainerPath({ path: dir });
      const result = await inside({ command: ['ls', '-la', target] });
      return parseLsLong({ stdout: ensureOk({ result, action: `list ${dir}` }).stdout, dir });
    },
    grep: async ({ pattern, include }): Promise<RepoGrepMatch[]> => {
      const result = await inside({ command: ['grep', '-rn', '--', pattern, workDir] });
      // grep exits 1 when there are no matches; only > 1 is a real error.
      if (result.code > 1) {
        throw new Error(`sandbox: grep failed (exit ${result.code}): ${result.stderr.trim()}`);
      }
      return parseGrep({ stdout: result.stdout, include });
    },
  };
};

const checkoutRef = async ({
  exec,
  container,
  ref,
}: {
  exec: Exec;
  container: string;
  ref: string;
}): Promise<void> => {
  const direct = await exec({
    file: 'podman',
    args: ['exec', container, 'git', '-C', workDir, 'checkout', ref],
  });
  if (direct.code === 0) {
    return;
  }
  ensureOk({
    result: await exec({
      file: 'podman',
      args: ['exec', container, 'git', '-C', workDir, 'fetch', 'origin', ref],
    }),
    action: `fetch ${ref}`,
  });
  ensureOk({
    result: await exec({
      file: 'podman',
      args: ['exec', container, 'git', '-C', workDir, 'checkout', 'FETCH_HEAD'],
    }),
    action: `checkout FETCH_HEAD for ${ref}`,
  });
};

export const podmanSandbox = ({ exec = nodeExec }: { exec?: Exec } = {}): SandboxRunner => {
  const containerByAccess = new WeakMap<RepoAccess, string>();
  return {
    clone: async ({ repo, ref }): Promise<SandboxCheckout> => {
      const container = containerName({ id: shortId() });
      ensureOk({
        result: await exec({
          file: 'podman',
          args: ['run', '-d', '--name', container, '--entrypoint', 'sleep', image, 'infinity'],
        }),
        action: `start container ${container}`,
      });
      ensureOk({
        result: await exec({
          file: 'podman',
          args: ['exec', container, 'git', 'clone', '--filter=blob:none', repo, workDir],
        }),
        action: `clone ${repo}`,
      });
      await checkoutRef({ exec, container, ref });
      const access = buildAccess({ exec, container });
      containerByAccess.set(access, container);
      return { ref, access };
    },
    teardown: async ({ checkout }): Promise<void> => {
      const container = containerByAccess.get(checkout.access);
      if (container === undefined) {
        return;
      }
      ensureOk({
        result: await exec({ file: 'podman', args: ['rm', '-f', container] }),
        action: `teardown ${container}`,
      });
      containerByAccess.delete(checkout.access);
    },
  };
};
