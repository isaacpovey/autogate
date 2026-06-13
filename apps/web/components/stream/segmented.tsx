export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; l: string }[];
}) {
  return (
    <div style={{ display: "inline-flex", padding: 2, gap: 2, borderRadius: 7, background: "var(--bg-rail)", border: "1px solid var(--line)" }}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className="focusable"
          style={{
            padding: "4px 11px",
            borderRadius: 5,
            border: "none",
            fontSize: 12,
            fontWeight: 450,
            background: value === o.v ? "var(--bg-raised-2)" : "transparent",
            color: value === o.v ? "var(--fg)" : "var(--fg-muted)",
            boxShadow: value === o.v ? "var(--lit-edge)" : "none",
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
