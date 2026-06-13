import type { RunDetail } from "@/lib/api-types";

export function OrchestratorBrief({ run }: { run: RunDetail }) {
  const d = run.decision;
  return (
    <div style={{ borderRadius: 9, padding: "18px 20px", background: "var(--info-tint)", border: "1px solid var(--info-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
        <span style={{ width: 6, height: 6, borderRadius: 6, background: "var(--info)" }} />
        <span className="label" style={{ color: "var(--info)" }}>Orchestrator brief</span>
      </div>
      {d.brief && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg)", maxWidth: 720 }}>{d.brief}</p>}
      <div style={{ marginTop: d.brief ? 15 : 0, display: "flex", flexDirection: "column", gap: 9 }}>
        {d.reasons.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ marginTop: 6, width: 5, height: 5, borderRadius: 1.5, background: "var(--info)", flexShrink: 0, transform: "rotate(45deg)" }} />
            <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fg-2)" }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssessingPanel({ run }: { run: RunDetail }) {
  const resolved = run.checks.length;
  const total = run.gate.total + run.checks.length;
  return (
    <div style={{ borderRadius: 9, padding: "16px 18px", background: "var(--info-tint)", border: "1px solid var(--info-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: 8, background: "var(--info)" }} />
        <span className="display-face" style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)" }}>Still assessing</span>
        <div style={{ flex: 1 }} />
        <span className="tnum caption">{resolved} / {total} checks resolved</span>
      </div>
    </div>
  );
}
