import type { RunSummary } from "@/lib/api-types";

/** Layer-1 gate progress for awaiting_checks rows. */
export function GateProgress({ gate }: { gate: RunSummary["gate"] }) {
  const pct = gate.total ? (gate.passed / gate.total) * 100 : 0;
  return (
    <div className="mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--incon)" }}>
      <span className="tnum">gate {gate.passed}/{gate.total}</span>
      <span style={{ height: 3, width: 48, overflow: "hidden", borderRadius: 999, background: "var(--line-2)" }}>
        <span style={{ display: "block", height: "100%", borderRadius: 999, width: `${pct}%`, background: "var(--incon)" }} />
      </span>
    </div>
  );
}
