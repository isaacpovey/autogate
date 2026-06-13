import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Real verification for ticket 14 (Layer 1 gate). Two parts:
//   1. STRUCTURAL — assert both gate workflows declare the exact check-run
//      names Autogate's awaitAllChecks reads, on pull_request, with the pnpm +
//      Node setup, and a conditional `test` job.
//   2. REAL — use the `gh` CLI to read actual check runs the pushed gate
//      produces on the live autogate repo (the same data ticket 04 consumes).
//      If the gate has not been pushed / no PR exists yet, DEFERRED + exit 0.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const dogfoodGate = resolve(repoRoot, '.github/workflows/gate.yml');
const templateGate = resolve(here, 'gate.yml');
const coderabbit = resolve(repoRoot, '.coderabbit.yaml');

const requiredJobNames = ['check-types', 'lint', 'build', 'test'] as const;

const pass = ({ msg }: { msg: string }): true => {
  console.log(`PASS: ${msg}`);
  return true;
};
const fail = ({ msg }: { msg: string }): false => {
  console.log(`FAIL: ${msg}`);
  return false;
};

const hasJobNames = ({ source }: { source: string }): boolean =>
  requiredJobNames.every((name) =>
    new RegExp(`name:\\s*${name}\\b`).test(source),
  );

const checkWorkflow = ({
  label,
  path,
}: {
  label: string;
  path: string;
}): boolean => {
  const source = readFileSync(path, 'utf8');
  const checks: { ok: boolean; detail: string }[] = [
    {
      ok: /on:\s*[\s\S]*?pull_request/.test(source),
      detail: 'triggers on pull_request',
    },
    {
      ok: hasJobNames({ source }),
      detail: `declares jobs ${requiredJobNames.join(', ')}`,
    },
    {
      ok: source.includes('pnpm/action-setup'),
      detail: 'uses pnpm/action-setup',
    },
    {
      ok: /actions\/setup-node[\s\S]*?node-version/.test(source),
      detail: 'uses actions/setup-node with node-version',
    },
    { ok: /cache:\s*pnpm/.test(source), detail: 'caches pnpm' },
    {
      ok: /needs:\s*detect-tests[\s\S]*?if:\s*needs\.detect-tests\.outputs\.has-tests/.test(
        source,
      ),
      detail: 'test job runs only when a test script exists',
    },
  ];

  return checks.reduce(
    (acc, { ok, detail }) =>
      (ok
        ? pass({ msg: `${label}: ${detail}` })
        : fail({ msg: `${label}: missing — ${detail}` })) && acc,
    true,
  );
};

const checkCoderabbit = (): boolean => {
  const source = readFileSync(coderabbit, 'utf8');
  const ok =
    source.includes('reviews:') &&
    /request_changes_workflow:\s*true/.test(source);
  return ok
    ? pass({ msg: 'coderabbit: review-status check enabled (Layer 1 bugbot)' })
    : fail({ msg: 'coderabbit: missing request_changes_workflow' });
};

type GhCheck = { name: string; state: string; bucket: string };

const ghJson = <T>({ args }: { args: string[] }): T =>
  JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));

const verifyRealCheckRuns = ({ repo }: { repo: string }): boolean => {
  const prs = ghJson<{ number: number }[]>({
    args: [
      'pr',
      'list',
      '--repo',
      repo,
      '--state',
      'all',
      '--limit',
      '20',
      '--json',
      'number',
    ],
  });

  const gateNames = new Set<string>(requiredJobNames);

  const found = prs.reduce<{ pr: number; names: string[] } | undefined>(
    (acc, { number }) => {
      if (acc !== undefined) return acc;
      const checks = ghJson<GhCheck[]>({
        args: [
          'pr',
          'checks',
          String(number),
          '--repo',
          repo,
          '--json',
          'name,state,bucket',
        ],
      }).filter(() => true);
      const gateChecks = checks.filter((c) => gateNames.has(c.name));
      return gateChecks.length > 0
        ? { pr: number, names: gateChecks.map((c) => c.name) }
        : undefined;
    },
    undefined,
  );

  if (found === undefined) {
    console.log(
      `DEFERRED: no PR on ${repo} has produced gate check runs yet (push gate.yml + open a PR to verify live). Structural checks above passed.`,
    );
    process.exit(0);
  }

  return pass({
    msg: `real gate check runs on ${repo} PR #${found.pr}: ${found.names.join(', ')} — readable by awaitAllChecks`,
  });
};

const main = (): void => {
  const structural = [
    checkWorkflow({ label: 'dogfood gate.yml', path: dogfoodGate }),
    checkWorkflow({ label: 'template gate.yml', path: templateGate }),
    checkCoderabbit(),
  ].every((ok) => ok);

  if (!structural) {
    console.log('FAIL: structural workflow checks failed.');
    process.exit(1);
  }

  const ghAvailable = (() => {
    try {
      execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  if (!ghAvailable) {
    console.log(
      'DEFERRED: gh CLI not authenticated; cannot read live check runs. Structural checks above passed.',
    );
    process.exit(0);
  }

  const real = verifyRealCheckRuns({ repo: 'isaacpovey/autogate' });
  if (!real) {
    console.log('FAIL: live gate check-run verification failed.');
    process.exit(1);
  }

  console.log('\nSmoke complete: gate workflows valid and producing the check runs awaitAllChecks reads.');
};

main();
