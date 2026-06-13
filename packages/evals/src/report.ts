import type { Verdict } from '@autogate/contracts';
import type { FixtureResult } from './score.js';
import type { AgentEvalReport } from './runner.js';

const mark = ({ pass }: { pass: boolean }): string => (pass ? '✓' : '✗');
const pct = ({ rate }: { rate: number }): string => `${Math.round(rate * 100)}%`;

export const formatVerdict = ({ verdict }: { verdict: Verdict }): string =>
  JSON.stringify(verdict, null, 2);

const formatFixtureResult = ({
  result,
  verbose,
}: {
  result: FixtureResult;
  verbose: boolean;
}): string => {
  const head = `  ${mark({ pass: result.pass })} ${result.fixture}`;
  if (!verbose) {
    return head;
  }
  const lines = result.checks.map(
    (check) =>
      `      ${mark({ pass: check.pass })} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`,
  );
  return [head, ...lines].join('\n');
};

/** Per-agent report for `agent eval <id>`. Verbose by default — it's the inner loop. */
export const formatAgentReport = ({
  report,
  verbose = true,
}: {
  report: AgentEvalReport;
  verbose?: boolean;
}): string => {
  const allPass = report.passed === report.total && report.total > 0;
  const header = `${mark({ pass: allPass })} ${report.id} — ${report.passed}/${report.total} fixtures passed (${pct({ rate: report.passRate })})`;
  const body = report.results.map((result) => formatFixtureResult({ result, verbose }));
  return [header, ...body].join('\n');
};

/** Aggregate suite report for `pnpm eval` across all agents. */
export const formatSuite = ({
  reports,
  verbose = false,
}: {
  reports: AgentEvalReport[];
  verbose?: boolean;
}): string => {
  const totalFixtures = reports.reduce((sum, report) => sum + report.total, 0);
  const totalPassed = reports.reduce((sum, report) => sum + report.passed, 0);
  const allPass = totalPassed === totalFixtures && totalFixtures > 0;
  const width = reports.reduce((max, report) => Math.max(max, report.id.length), 0);

  const rows = reports.map((report) => {
    const ok = report.passed === report.total && report.total > 0;
    const line = `${mark({ pass: ok })} ${report.id.padEnd(width)}  ${report.passed}/${report.total}  (${pct({ rate: report.passRate })})`;
    if (!verbose) {
      return line;
    }
    const detail = report.results.map((result) => `    ${formatFixtureResult({ result, verbose: true })}`);
    return [line, ...detail].join('\n');
  });

  return [
    'Autogate — per-agent eval suite (mock AgentSdk, zero infra)',
    '===========================================================',
    ...rows,
    '-----------------------------------------------------------',
    `${mark({ pass: allPass })} TOTAL: ${totalPassed}/${totalFixtures} fixtures passed across ${reports.length} agents (${pct({ rate: totalFixtures === 0 ? 0 : totalPassed / totalFixtures })})`,
  ].join('\n');
};
