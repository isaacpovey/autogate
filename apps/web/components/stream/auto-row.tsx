import Link from "next/link";
import type { RunSummary } from "@/lib/api-types";
import { RiskDot } from "@/components/primitives/risk";
import { Icon } from "@/components/primitives/icon";

export function AutoRow({ run, visited }: { run: RunSummary; visited?: boolean }) {
  return (
    <Link
      href={`/runs/${run.runId}`}
      className="run-row focusable"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 62px 30px",
        gap: 16,
        alignItems: "center",
        padding: "0 22px",
        height: 55,
        borderBottom: "1px solid var(--line)",
        cursor: "pointer",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 450,
              color: visited ? "var(--fg-muted)" : "var(--fg-2)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "60%",
            }}
          >
            {run.pr.title}
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)", flexShrink: 0 }}>
            {run.pr.repo} #{run.pr.number}
          </span>
        </div>
        <div className="caption" style={{ fontSize: 12, marginTop: 1 }}>within autonomy policy — no human needed</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <RiskDot score={run.riskScore} size={7} />
        <span className="tnum" style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{run.riskScore}</span>
      </div>
      <Icon name="chevronRight" size={14} style={{ color: "var(--fg-faint)" }} />
    </Link>
  );
}
