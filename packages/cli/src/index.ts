import { agentIds } from '@autogate/agents';
import {
  formatAgentReport,
  formatSuite,
  formatVerdict,
  resolveRun,
  runAgentEval,
  runAgentOnFixture,
  runAllAgentEvals,
} from '@autogate/evals';

type Flags = { fixture?: string; json: boolean; verbose: boolean };

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
    } else if (token === '--fixture') {
      index += 1;
      flags.fixture = tokens[index];
    } else if (token.startsWith('--fixture=')) {
      flags.fixture = token.slice('--fixture='.length);
    } else {
      positionals.push(token);
    }
  }
  return { positionals, flags };
};

const usage = [
  'autogate — Layer-2 agent CLI (mock AgentSdk, zero infra)',
  '',
  'Usage:',
  '  agent run <id> [--fixture <pr>] [--json]   run one agent on a fixture, print its Verdict',
  '  agent eval <id>                            score that agent against its fixtures',
  '  eval [--verbose]                           run the per-agent eval suite across all agents',
  '',
  `Agents: ${agentIds.join(', ')}`,
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

const cmdEvalSuite = async ({ flags }: { flags: Flags }): Promise<void> => {
  const reports = await runAllAgentEvals();
  console.log(formatSuite({ reports, verbose: flags.verbose }));
  const allPass = reports.every((report) => report.total > 0 && report.passed === report.total);
  if (!allPass) {
    process.exit(1);
  }
};

const main = async (): Promise<void> => {
  const [group, ...rest] = process.argv.slice(2);

  if (group === 'eval') {
    const { flags } = parseFlags({ tokens: rest });
    await cmdEvalSuite({ flags });
    return;
  }

  if (group === 'agent') {
    const [sub, ...tail] = rest;
    const { positionals, flags } = parseFlags({ tokens: tail });
    const [id] = positionals;
    if (id === undefined) {
      return fail(`missing agent id`);
    }
    if (sub === 'run') {
      await cmdAgentRun({ id, flags });
      return;
    }
    if (sub === 'eval') {
      await cmdAgentEval({ id });
      return;
    }
    fail(`unknown agent subcommand "${sub ?? ''}"`);
  }

  fail(`unknown command "${group ?? ''}"`);
};

main().catch((error: unknown) => {
  console.error('autogate failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
