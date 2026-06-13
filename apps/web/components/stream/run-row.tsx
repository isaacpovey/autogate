import Link from "next/link";
import type { RunSummary } from "@/lib/api-types";
import { effortBand } from "@/lib/view-model";
import { EffortPill } from "@/components/primitives/pills";
import { RiskDot } from "@/components/primitives/risk";
import { TallyInline } from "@/components/primitives/tally";
import { Avatar } from "@/components/primitives/avatar";
import { GateProgress } from "./gate-progress";

const GRID = "76px minmax(0,1fr) 96px 78px 30px";

export function StreamColHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        gap: 16,
        padding: "0 22px",
        height: 30,
        alignItems: "center",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span className="label">effort</span>
      <span className="label">change</span>
      <span className="label">risk</span>
      <span className="label">checks</span>
      <span />
    </div>
  );
}

export function RunRow({
  run,
  visited,
  justUpdated,
}: {
  run: RunSummary;
  visited?: boolean;
  justUpdated?: boolean;
}) {
  const awaiting = run.status === "awaiting_checks";
  return (
    <Link
      href={`/runs/${run.runId}`}
      className={"run-row focusable" + (justUpdated ? " hl" : "")}
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        alignItems: "center",
        gap: 16,
        padding: "0 22px",
        height: 60,
        borderBottom: "1px solid var(--line)",
        cursor: "pointer",
      }}
    >
      <div>{run.status === "completed" ? <EffortPill effort={effortBand(run)} /> : <span />}</div>
      <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 9 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 450,
            color: visited ? "var(--fg-muted)" : "var(--fg)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {run.pr.title}
        </span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
          {run.pr.repo} #{run.pr.number}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RiskDot score={run.riskScore} />
        <span className="tnum" style={{ fontSize: 13, color: "var(--fg-2)", width: 22 }}>{run.riskScore}</span>
      </div>
      {awaiting ? <GateProgress gate={run.gate} /> : <TallyInline summary={run.checkSummary} />}
      <Avatar name={run.pr.author} />
    </Link>
  );
}
