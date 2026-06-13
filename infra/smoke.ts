import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoConfigSchema, type RepoConfig } from '@autogate/contracts';
import { askableConfig } from './repo-configs/askable.js';
import { autogateConfig } from './repo-configs/autogate.js';

const here = dirname(fileURLToPath(import.meta.url));

type Check = { label: string; ok: boolean; evidence: string };

const validateConfig = ({ name, config }: { name: string; config: RepoConfig }): Check => {
  const result = repoConfigSchema.safeParse(config);
  if (!result.success) {
    return { label: `repo-config ${name}`, ok: false, evidence: result.error.message };
  }
  const { id, ragInclude, sensitivePaths, requiredChecks, agents } = result.data;
  return {
    label: `repo-config ${name}`,
    ok: true,
    evidence:
      `id=${id} ragInclude=${ragInclude.length} sensitivePaths=${sensitivePaths.length} ` +
      `requiredChecks=${JSON.stringify(requiredChecks)} agents=[${agents.join(',')}]`,
  };
};

const checkComposeParses = (): Check => {
  const composePath = join(here, 'docker-compose.yml');
  try {
    const out = execFileSync('docker-compose', ['-f', composePath, 'config', '--services'], {
      encoding: 'utf8',
    });
    const services = out.split('\n').map((s) => s.trim()).filter((s) => s.length > 0).sort();
    const expected = ['api', 'postgres', 'qdrant', 'web', 'worker'];
    const hasAll = expected.every((svc) => services.includes(svc));
    return {
      label: 'docker-compose config',
      ok: hasAll,
      evidence: `services=[${services.join(',')}] expected=[${expected.join(',')}]`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { label: 'docker-compose config', ok: false, evidence: message };
  }
};

const checkSetupSyntax = (): Check => {
  const setupPath = join(here, 'setup.sh');
  try {
    execFileSync('bash', ['-n', setupPath], { encoding: 'utf8' });
    return { label: 'setup.sh bash -n', ok: true, evidence: 'syntax valid' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { label: 'setup.sh bash -n', ok: false, evidence: message };
  }
};

const checkEnvExample = (): Check => {
  const ok = existsSync(join(here, '.env.example'));
  return { label: '.env.example present', ok, evidence: ok ? 'found' : 'missing' };
};

const main = (): void => {
  const dockerAvailable = (() => {
    try {
      execFileSync('docker-compose', ['version'], { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  })();

  const configChecks: Check[] = [
    validateConfig({ name: 'askable', config: askableConfig }),
    validateConfig({ name: 'autogate', config: autogateConfig }),
  ];

  const composeCheck: Check[] = dockerAvailable
    ? [checkComposeParses()]
    : [{ label: 'docker-compose config', ok: true, evidence: 'DEFERRED: docker-compose not on PATH' }];

  const checks: Check[] = [...configChecks, ...composeCheck, checkSetupSyntax(), checkEnvExample()];

  checks.forEach(({ label, ok, evidence }) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${label} — ${evidence}`);
  });

  const allOk = checks.every((c) => c.ok);
  console.log(`\n${allOk ? 'PASS' : 'FAIL'}: infra smoke — ${checks.filter((c) => c.ok).length}/${checks.length} checks ok.`);
  process.exit(allOk ? 0 : 1);
};

main();
