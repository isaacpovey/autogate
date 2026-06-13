import type { E2eReport, ScoredOutcome, TrustLoopResult } from './e2e-runner.js';

const mark = ({ pass }: { pass: boolean }): string => (pass ? '✓' : '✗');
const pct = ({ rate }: { rate: number }): string => `${Math.round(rate * 100)}%`;

const formatOutcomeRow = ({ outcome, width }: { outcome: ScoredOutcome; width: number }): string => {
  const decision = `${outcome.decision.outcome} (expected ${outcome.expect.decision})`;
  return `  ${mark({ pass: outcome.decisionMatch })} ${outcome.label.padEnd(width)}  decision ${decision.padEnd(34)} risk ${outcome.riskScore}`;
};

const formatTrustLoop = ({ result }: { result: TrustLoopResult }): string => {
  const lines = [
    `  ${result.fixture}${result.description ? ` — ${result.description}` : ''}`,
    `      without precedent → ${result.without.decision.outcome} (risk ${result.without.riskScore})  ⟵ no prior decision in memory`,
    `      with precedent    → ${result.with.decision.outcome} (risk ${result.with.riskScore})  ⟵ retrieved precedent ${result.precedentId}`,
    `      ${mark({ pass: result.flipped })} precedent retrieval changed the verdict: ${result.without.decision.outcome} → ${result.with.decision.outcome}`,
  ];
  return lines.join('\n');
};

/** Human-readable end-to-end tier report: per-fixture Decision vs ground truth + escalation P/R. */
export const formatE2eReport = ({ report }: { report: E2eReport }): string => {
  const width = report.standard.reduce((max, outcome) => Math.max(max, outcome.label.length), 0);
  const { metrics } = report;
  const allDecisionsMatch = report.decisionMatches === report.total && report.total > 0;

  const standardRows = report.standard.map((outcome) => formatOutcomeRow({ outcome, width }));
  const trustSection =
    report.trustLoops.length === 0
      ? []
      : ['', 'Trust loop (precedent retrieval changes a verdict):', ...report.trustLoops.map((result) => formatTrustLoop({ result }))];

  return [
    'Autogate — end-to-end eval tier (orchestrator + all mocks, gate forced green)',
    '=============================================================================',
    'Per-fixture Decision vs ground truth:',
    ...standardRows,
    ...trustSection,
    '-----------------------------------------------------------------------------',
    `Escalation precision/recall (${report.total} labeled outcomes):`,
    `  TP=${metrics.truePositive} FP=${metrics.falsePositive} FN=${metrics.falseNegative} TN=${metrics.trueNegative}` +
      `  →  precision ${pct({ rate: metrics.precision })}  recall ${pct({ rate: metrics.recall })}`,
    `${mark({ pass: allDecisionsMatch })} Decision matched ground truth on ${report.decisionMatches}/${report.total} outcomes`,
  ].join('\n');
};
