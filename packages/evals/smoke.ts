import { formatAgentReport, runAgentEval } from './src/index.js';

const main = async () => {
  const report = await runAgentEval({ id: 'semantic-review' });
  console.log(formatAgentReport({ report }));
  if (report.passed !== report.total) {
    throw new Error(`evals smoke: ${report.total - report.passed} fixture(s) failed`);
  }
  console.log('\nevals smoke complete: per-agent runner scored fixtures against the mock AgentSdk.');
};

main().catch((error) => {
  console.error('evals smoke failed:', error);
  process.exit(1);
});
