export function StatTile({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "16px 18px", borderRadius: 9, background: "var(--bg-raised)", border: "1px solid var(--line)", boxShadow: "var(--lit-edge)" }}>
      <div className="label" style={{ marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="display-face tnum" style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--fg)" }}>{value}</span>
        {unit && <span className="tnum" style={{ fontSize: 15, color: "var(--fg-muted)" }}>{unit}</span>}
      </div>
      {sub && <div className="caption" style={{ marginTop: 7 }}>{sub}</div>}
    </div>
  );
}
