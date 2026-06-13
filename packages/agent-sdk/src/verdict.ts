import {
  findingSchema,
  verdictSchema,
  type Finding,
  type Severity,
  type Verdict,
  type VerdictStatus,
} from '@autogate/contracts';

export const clamp = ({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number => Math.min(max, Math.max(min, value));

/** Confidence is a probability in [0, 1]. */
export const clampConfidence = ({ confidence }: { confidence: number }): number =>
  clamp({ value: confidence, min: 0, max: 1 });

/** A single agent's risk contribution is bounded to [0, 100]. */
export const clampRisk = ({ risk }: { risk: number }): number =>
  clamp({ value: risk, min: 0, max: 100 });

/** Validate findings against the contract; throws on a malformed finding. */
export const normalizeFindings = ({ findings }: { findings: readonly Finding[] }): Finding[] =>
  findings.map((finding) => findingSchema.parse(finding));

const SEVERITY_WEIGHT: Record<Severity, number> = {
  info: 0,
  low: 5,
  medium: 15,
  high: 30,
  critical: 50,
};

/**
 * Deterministic risk contribution derived from a finding set: sum severity
 * weights, clamped to [0, 100]. Agents that don't reason about a numeric score
 * directly (most of them) use this so risk tracks the severities they surface.
 */
export const riskFromFindings = ({ findings }: { findings: readonly Finding[] }): number =>
  clampRisk({
    risk: findings.reduce((sum, finding) => sum + SEVERITY_WEIGHT[finding.severity], 0),
  });

/**
 * Assemble a contract-valid {@link Verdict}: clamp confidence/risk into range,
 * normalize findings, and parse the whole thing through `verdictSchema` so a
 * malformed verdict throws at the boundary rather than leaking downstream.
 * This is the helper every agent's `toVerdict` builds on.
 */
export const buildVerdict = ({
  sourceId,
  status,
  confidence,
  riskContribution,
  summary,
  findings = [],
}: {
  sourceId: string;
  status: VerdictStatus;
  confidence: number;
  riskContribution: number;
  summary: string;
  findings?: readonly Finding[];
}): Verdict =>
  verdictSchema.parse({
    sourceId,
    status,
    confidence: clampConfidence({ confidence }),
    riskContribution: clampRisk({ risk: riskContribution }),
    summary,
    findings: normalizeFindings({ findings }),
  });
