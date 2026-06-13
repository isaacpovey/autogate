import type { RunDetail } from "@/lib/api-types";
import { deriveIncident } from "@/lib/view-model";
import { VerdictGlyph } from "@/components/primitives/verdict-glyph";

export function MonitoringRow({ run }: { run: RunDetail }) {
  const m = run.monitoring;
  if (!m) return null;
  const degrading = deriveIncident(run);
  const done = m.rolledBack;
  const v = degrading || done ? "fail" : "pass";
  return (
    <div style={{ marginLeft: 16, borderLeft: `2px solid ${degrading || done ? "var(--fail-edge)" : "var(--pass-edge)"}`, paddingLeft: 16 }}>
      <div style={{ padding: "16px 18px 16px 0", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ marginTop: 1 }}>
          <VerdictGlyph verdict={v} size={17} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>canary-monitoring</span>
            {(degrading || done) && (
              <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fail)" }}>{done ? "rolled back" : "fail"}</span>
            )}
          </div>
          <p style={{ margin: "6px 0 10px", fontSize: 13, lineHeight: 1.55, color: "var(--fg-2)", maxWidth: 680 }}>
            {done
              ? "Rolled back after errors crossed the threshold. The pre-merge checks above are green history."
              : degrading
                ? "Error rate is climbing on the live canary — the pre-merge checks passed; this only appeared under real load."
                : "Healthy in production. Error rate is flat since rollout."}
          </p>
          <div style={{ display: "flex", gap: 26 }}>
            {([["canary", m.canaryPercent + "%"], ["new errors", degrading ? "+" + m.newErrors : m.newErrors], ["window", m.window]] as const).map(([k, val]) => (
              <div key={k}>
                <div className="label" style={{ marginBottom: 3 }}>{k}</div>
                <div className="tnum" style={{ fontSize: 15, fontWeight: 500, color: k === "new errors" && degrading ? "var(--fail)" : "var(--fg)" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
