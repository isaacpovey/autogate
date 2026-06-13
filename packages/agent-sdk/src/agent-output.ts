import { z } from 'zod';
import {
  severitySchema,
  verdictStatusSchema,
  type Finding,
  type Verdict,
} from '@autogate/contracts';
import { buildVerdict, riskFromFindings } from './verdict.js';

/**
 * The flat finding shape agents emit in their structured output. Flatter than
 * the contract `Finding` (file/line instead of a nested `location`) so prompts
 * and canned fixtures stay easy to author; {@link toFinding} lifts it to the
 * contract shape.
 */
export const findingInputSchema = z.object({
  severity: severitySchema,
  title: z.string(),
  detail: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  evidence: z.string().optional(),
});
export type FindingInput = z.infer<typeof findingInputSchema>;

export const toFinding = (input: FindingInput): Finding => ({
  severity: input.severity,
  title: input.title,
  detail: input.detail,
  ...(input.file !== undefined
    ? { location: { file: input.file, ...(input.line !== undefined ? { line: input.line } : {}) } }
    : {}),
  ...(input.evidence !== undefined ? { evidence: input.evidence } : {}),
});

/**
 * The shape every Layer-2 agent shares. Individual agents `.extend()` this with
 * their own fields (e.g. a blast-radius graph, an explicit risk score) but the
 * core status/confidence/summary/findings is uniform so {@link standardToVerdict}
 * can map any of them.
 */
export const agentOutputBaseSchema = z.object({
  status: verdictStatusSchema,
  confidence: z.number(),
  summary: z.string(),
  findings: z.array(findingInputSchema),
});
export type AgentOutputBase = z.infer<typeof agentOutputBaseSchema>;

/**
 * Map the shared agent output to a contract `Verdict`, deriving risk from the
 * finding severities. Agents with their own risk model pass a custom `toVerdict`
 * instead.
 */
export const standardToVerdict = ({
  id,
  result,
}: {
  id: string;
  result: AgentOutputBase;
}): Verdict => {
  const findings = result.findings.map(toFinding);
  return buildVerdict({
    sourceId: id,
    status: result.status,
    confidence: result.confidence,
    summary: result.summary,
    findings,
    riskContribution: riskFromFindings({ findings }),
  });
};
