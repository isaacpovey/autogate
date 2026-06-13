import Link from "next/link";
import type { RunDetail } from "@/lib/api-types";
import { deriveIncident } from "@/lib/view-model";
import { Icon } from "@/components/primitives/icon";
import { StatusPill } from "@/components/primitives/pills";

const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 6,
  background: "transparent", color: "var(--fg-2)", fontSize: 12.5, fontWeight: 450, border: "1px solid var(--line-2)",
};
const btnDanger: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 6,
  background: "transparent", color: "var(--fail)", fontSize: 12.5, fontWeight: 500, border: "1px solid color-mix(in srgb, var(--fail) 50%, transparent)",
};

export function ProdCard({ run, expanded, onToggle }: { run: RunDetail; expanded: boolean; onToggle: () => void }) {
  const m = run.monitoring;
  const degrading = deriveIncident(run);
  const done = !!m?.rolledBack;
  const accent = degrading || done ? "var(--fail)" : "var(--pass)";
  return (
    <div
      style={{
        margin: "8px 22px",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--bg-raised)",
        boxShadow: "var(--lit-edge)",
        border: degrading ? "1px solid color-mix(in srgb, var(--fail) 40%, transparent)" : "1px solid var(--line)",
      }}
    >
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px", cursor: "pointer" }}>
        {degrading ? (
          <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: 8, background: "var(--fail)", boxShadow: "0 0 0 4px var(--fail-tint)" }} />
        ) : (
          <span style={{ width: 8, height: 8, borderRadius: 8, background: accent, opacity: done ? 0.5 : 0.8 }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span style={{ fontSize: 13.5, fontWeight: 450, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {run.pr.title}
            </span>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
              {run.pr.repo} #{run.pr.number}
            </span>
          </div>
          <div className="caption" style={{ marginTop: 3 }}>
            {done ? (
              <span style={{ color: "var(--fail)" }}>rolled back — reverted at {m?.canaryPercent}% canary</span>
            ) : degrading && m ? (
              <span style={{ color: "var(--fail)" }}>degrading · <span className="tnum">+{m.newErrors}</span> errors · {m.window}</span>
            ) : m ? (
              <span>healthy · canary <span className="tnum">{m.canaryPercent}%</span> · <span className="tnum">{m.newErrors}</span> new errors · {m.window}</span>
            ) : (
              <span>in production</span>
            )}
          </div>
        </div>
        <StatusPill decision={run.decision.outcome} status={run.status} />
        <Icon name="chevronRight" size={15} style={{ color: "var(--fg-muted)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 140ms ease" }} />
      </div>
      {expanded && (
        <div className="settle" style={{ padding: "0 16px 16px 37px", borderTop: "1px solid var(--line)" }}>
          {m && (
            <div style={{ display: "flex", gap: 28, padding: "14px 0" }}>
              {([["canary", m.canaryPercent + "%"], ["new errors", degrading ? "+" + m.newErrors : m.newErrors], ["window", m.window], ["merge risk", run.riskScore]] as const).map(([k, v]) => (
                <div key={k}>
                  <div className="label" style={{ marginBottom: 4 }}>{k}</div>
                  <div className="tnum" style={{ fontSize: 18, fontWeight: 500, color: k === "new errors" && degrading ? "var(--fail)" : "var(--fg)" }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {run.decision.brief && (
            <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5, margin: "0 0 12px", maxWidth: 620 }}>{run.decision.brief}</p>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Link href={`/runs/${run.runId}`} className="focusable" style={btnGhost}>Open run detail</Link>
            {degrading && (
              <Link href={`/runs/${run.runId}`} className="focusable" style={btnDanger}>
                <Icon name="rotate" size={14} /> Review &amp; roll back
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
