import { agentIds } from '@autogate/agents';
import {
  formatAgentReport,
  formatE2eReport,
  formatSuite,
  formatVerdict,
  loadE2eFixtures,
  resolveRun,
  runAgentEval,
  runAgentOnFixture,
  runAllAgentEvals,
  runE2eSuite,
} from '@autogate/evals';
import { dbMigrate, dbSeed, ingest, runEnqueue } from './infra.js';

type Flags = {
  fixture?: string;
  repo?: string;
  pr?: string;
  root?: string;
  json: boolean;
  verbose: boolean;
};

const VALUE_FLAGS = ['fixture', 'repo', 'pr', 'root'] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];
const isValueFlag = (name: string): name is ValueFlag => (VALUE_FLAGS as readonly string[]).includes(name);

const parseFlags = ({ tokens }: { tokens: string[] }): { positionals: string[]; flags: Flags } => {
  const positionals: string[] = [];
  const flags: Flags = { json: false, verbose: false };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token === '--json') {
      flags.json = true;
    } else if (token === '--verbose' || token === '-v') {
      flags.verbose = true;
    } else if (token.startsWith('--') && token.includes('=')) {
      const name = token.slice(2, token.indexOf('='));
      if (isValueFlag(name)) {
        flags[name] = token.slice(token.indexOf('=') + 1);
      }
    } else if (token.startsWith('--') && isValueFlag(token.slice(2))) {
      const name = token.slice(2) as ValueFlag;
      index += 1;
      flags[name] = tokens[index];
    } else {
      positionals.push(token);
    }
  }
  return { positionals, flags };
};

const usage = [
  'autogate — Layer-2 agent CLI + Autogate infra commands',
  '',
  'Agent / eval (mock AgentSdk, zero infra):',
  '  agent run <id> [--fixture <pr>] [--json]   run one agent on a fixture, print its Verdict',
  '  agent eval <id>                            score that agent against its fixtures',
  '  eval [--verbose]                           run BOTH eval tiers (per-agent + end-to-end)',
  '',
  'Infra (real Stream A adapters — Postgres + Qdrant):',
  '  db migrate [--json]                        apply the Postgres schema',
  '  db seed [--json]                           write the demo dataset',
  '  ingest <repoConfig> [--root <dir>] [--json]  ingest a repo into Qdrant; report counts',
  '  run enqueue --repo <id> --pr <n> [--json]  seed + enqueue a run; print the new run id',
  '',
  `Agents: ${agentIds.join(', ')}`,
  '',
  'Env: DATABASE_URL (default postgres://autogate:autogate@localhost:5432/autogate),',
  '     QDRANT_URL (default http://localhost:6333), OPENAI_API_KEY (optional).',
].join('\n');

const fail = (message: string): never => {
  console.error(`autogate: ${message}\n`);
  console.error(usage);
  process.exit(1);
};

const cmdAgentRun = async ({ id, flags }: { id: string; flags: Flags }): Promise<void> => {
  const { entry, fixture } = resolveRun({ id, fixtureName: flags.fixture });
  const verdict = await runAgentOnFixture({ entry, fixture });
  if (flags.json) {
    console.log(JSON.stringify(verdict));
    return;
  }
  console.log(`agent:   ${entry.id}`);
  console.log(`fixture: ${fixture.name} — PR #${fixture.pr.number} "${fixture.pr.title}"`);
  console.log('verdict:');
  console.log(formatVerdict({ verdict }));
};

const cmdAgentEval = async ({ id }: { id: string }): Promise<void> => {
  const report = await runAgentEval({ id });
  console.log(formatAgentReport({ report }));
  if (report.total === 0 || report.passed !== report.total) {
    process.exit(1);
  }
};

/** `eval` — run both tiers: per-agent verification then the end-to-end orchestrator replay. */
const cmdEvalSuite = async ({ flags }: { flags: Flags }): Promise<void> => {
  const agentReports = await runAllAgentEvals();
  console.log(formatSuite({ reports: agentReports, verbose: flags.verbose }));

  const e2eReport = await runE2eSuite({ fixtures: loadE2eFixtures() });
  console.log('');
  console.log(formatE2eReport({ report: e2eReport }));

  const agentsPass = agentReports.every((report) => report.total > 0 && report.passed === report.total);
  const e2ePass = e2eReport.total > 0 && e2eReport.decisionMatches === e2eReport.total;
  if (!agentsPass || !e2ePass) {
    process.exit(1);
  }
};

const cmdAgent = async ({ rest }: { rest: string[] }): Promise<void> => {
  const [sub, ...tail] = rest;
  const { positionals, flags } = parseFlags({ tokens: tail });
  const [id] = positionals;
  if (id === undefined) {
    return fail('missing agent id');
  }
  if (sub === 'run') {
    return cmdAgentRun({ id, flags });
  }
  if (sub === 'eval') {
    return cmdAgentEval({ id });
  }
  fail(`unknown agent subcommand "${sub ?? ''}"`);
};

const cmdDb = async ({ rest }: { rest: string[] }): Promise<void> => {
  const { positionals, flags } = parseFlags({ tokens: rest });
  const [sub] = positionals;
  if (sub === 'migrate') {
    await dbMigrate({ json: flags.json });
  } else if (sub === 'seed') {
    await dbSeed({ json: flags.json });
  } else {
    return fail(`unknown db subcommand "${sub ?? ''}"`);
  }
  process.exit(0);
};

const cmdIngest = async ({ rest }: { rest: string[] }): Promise<void> => {
  const { positionals, flags } = parseFlags({ tokens: rest });
  const [configPath] = positionals;
  if (configPath === undefined) {
    return fail('ingest requires a <repoConfig> path');
  }
  await ingest({ configPath, root: flags.root, json: flags.json });
  process.exit(0);
};

const cmdRun = async ({ rest }: { rest: string[] }): Promise<void> => {
  const [sub, ...tail] = rest;
  const { flags } = parseFlags({ tokens: tail });
  if (sub !== 'enqueue') {
    return fail(`unknown run subcommand "${sub ?? ''}"`);
  }
  if (flags.repo === undefined || flags.pr === undefined) {
    return fail('run enqueue requires --repo <id> and --pr <n>');
  }
  const prNumber = Number(flags.pr);
  if (!Number.isInteger(prNumber)) {
    return fail(`--pr must be an integer (got "${flags.pr}")`);
  }
  await runEnqueue({ repo: flags.repo, prNumber, json: flags.json });
  process.exit(0);
};

const main = async (): Promise<void> => {
  const [group, ...rest] = process.argv.slice(2);

  if (group === 'eval') {
    const { flags } = parseFlags({ tokens: rest });
    return cmdEvalSuite({ flags });
  }
  if (group === 'agent') {
    return cmdAgent({ rest });
  }
  if (group === 'db') {
    return cmdDb({ rest });
  }
  if (group === 'ingest') {
    return cmdIngest({ rest });
  }
  if (group === 'run') {
    return cmdRun({ rest });
  }
  fail(`unknown command "${group ?? ''}"`);
};

main().catch((error: unknown) => {
  console.error('autogate failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
