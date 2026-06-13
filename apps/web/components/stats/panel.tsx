export function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <h2 className="display-face" style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em", margin: 0, color: "var(--fg)" }}>{title}</h2>
        {sub && <span className="caption">{sub}</span>}
      </div>
      <div style={{ padding: "20px 22px", borderRadius: 10, background: "var(--bg-raised)", border: "1px solid var(--line)", boxShadow: "var(--lit-edge)" }}>{children}</div>
    </div>
  );
}
