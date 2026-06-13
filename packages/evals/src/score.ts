import { verdictSchema, type Verdict } from '@autogate/contracts';
import type { Fixture, RiskBand } from './fixture.js';

export type Check = { label: string; pass: boolean; detail?: string };

export type FixtureResult = {
  fixture: string;
  description?: string;
  pass: boolean;
  checks: Check[];
  verdict?: Verdict;
  error?: string;
};

export const bandOf = ({ risk }: { risk: number }): RiskBand =>
  risk >= 67 ? 'high' : risk >= 34 ? 'medium' : 'low';

/**
 * Shallow scoring: prove the plumbing, not the reasoning. A verdict must be
 * schema-valid and well-formed (right source, in-range scores, non-empty
 * summary); any expectation labels the fixture declares are checked on top.
 */
export const scoreVerdict = ({
  id,
  fixture,
  verdict,
}: {
  id: string;
  fixture: Fixture;
  verdict: Verdict;
}): Check[] => {
  const parsed = verdictSchema.safeParse(verdict);
  const checks: Check[] = [
    {
      label: 'verdict is schema-valid',
      pass: parsed.success,
      detail: parsed.success ? undefined : parsed.error.message,
    },
    {
      label: 'sourceId matches agent',
      pass: verdict.sourceId === id,
      detail: verdict.sourceId,
    },
    {
      label: 'confidence in [0,1]',
      pass: verdict.confidence >= 0 && verdict.confidence <= 1,
      detail: String(verdict.confidence),
    },
    {
      label: 'risk in [0,100]',
      pass: verdict.riskContribution >= 0 && verdict.riskContribution <= 100,
      detail: String(verdict.riskContribution),
    },
    {
      label: 'summary is non-empty',
      pass: verdict.summary.trim().length > 0,
    },
  ];

  const expect = fixture.expect;
  if (expect?.status !== undefined) {
    checks.push({
      label: `status == ${expect.status}`,
      pass: verdict.status === expect.status,
      detail: verdict.status,
    });
  }
  if (expect?.riskBand !== undefined) {
    const band = bandOf({ risk: verdict.riskContribution });
    checks.push({
      label: `risk band == ${expect.riskBand}`,
      pass: band === expect.riskBand,
      detail: `${band} (${verdict.riskContribution})`,
    });
  }
  if (expect?.minFindings !== undefined) {
    checks.push({
      label: `findings >= ${expect.minFindings}`,
      pass: verdict.findings.length >= expect.minFindings,
      detail: String(verdict.findings.length),
    });
  }
  if (expect?.maxFindings !== undefined) {
    checks.push({
      label: `findings <= ${expect.maxFindings}`,
      pass: verdict.findings.length <= expect.maxFindings,
      detail: String(verdict.findings.length),
    });
  }
  return checks;
};
