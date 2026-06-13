import type { Finding, PullRequest, Verdict } from "@autogate/contracts";

const severityRank: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const locate = ({ finding }: { finding: Finding }): string =>
  finding.location === undefined
    ? ""
    : ` (${finding.location.file}${
        finding.location.line === undefined ? "" : `:${finding.location.line}`
      })`;

const renderFinding = ({ finding }: { finding: Finding }): string =>
  `  - [${finding.severity}] ${finding.title}${locate({ finding })}: ${finding.detail}`;

const renderVerdict = ({ verdict }: { verdict: Verdict }): string => {
  const header = `### ${verdict.sourceId} — ${verdict.status} (risk ${verdict.riskContribution}, confidence ${verdict.confidence})`;
  const findings = [...verdict.findings]
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .map((finding) => renderFinding({ finding }));
  return [header, verdict.summary, ...findings].join("\n");
};

/**
 * `buildBrief` — the human-facing "what to look at and why" summary attached to
 * an escalation. Surfaces the riskiest agents first and lists their findings
 * ordered by severity so a reviewer reads the most serious concern first.
 */
export const buildBrief =
  () =>
  ({ pr, verdicts }: { pr: PullRequest; verdicts: Verdict[] }): string => {
    const ordered = [...verdicts].sort((a, b) => b.riskContribution - a.riskContribution);
    const heading = `## Escalation: ${pr.repo}#${pr.number} — ${pr.title}`;
    const meta = `Author: ${pr.author} · Branch: ${pr.branch} · ${pr.url}`;
    const intro =
      verdicts.length === 0
        ? "No agent verdicts were produced for this run."
        : "Review the following agent verdicts, highest risk first:";
    const body = ordered.map((verdict) => renderVerdict({ verdict }));
    return [heading, meta, "", intro, "", ...body].join("\n");
  };
