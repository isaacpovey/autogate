import { verdictStyle } from "@/lib/view-model";
import { VerdictGlyph } from "./verdict-glyph";

type Summary = { pass: number; warn: number; fail: number; pending: number };

/** Big tile row used in run detail; adds a "needs human" tile. */
export function TallyTiles({
  summary,
  needsHuman = 0,
  size = "lg",
}: {
  summary: Summary;
  needsHuman?: number;
  size?: "md" | "lg";
}) {
  const big = size === "lg";
  const items = [
    { k: "pass" as const, n: summary.pass || 0 },
    { k: "warn" as const, n: summary.warn || 0 },
    { k: "fail" as const, n: summary.fail || 0 },
    { k: "needs_human" as const, n: needsHuman || 0 },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {items.map((it) => {
        const v = verdictStyle(it.k);
        const zero = it.n === 0;
        return (
          <div
            key={it.k}
            style={{
              display: "flex",
              flexDirection: big ? "column" : "row",
              alignItems: big ? "flex-start" : "center",
              gap: big ? 6 : 7,
              padding: big ? "12px 14px" : "0",
              minWidth: big ? 86 : "auto",
              borderRadius: 6,
              opacity: zero ? 0.34 : 1,
              background: big ? "var(--bg-raised)" : "transparent",
              boxShadow: big ? "var(--lit-edge)" : "none",
              border: big ? "1px solid var(--line)" : "none",
            }}
          >
            <VerdictGlyph verdict={it.k} size={big ? 16 : 14} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span className="tnum" style={{ fontSize: big ? 22 : 13, fontWeight: 500, color: zero ? "var(--fg-muted)" : v.c, lineHeight: 1 }}>
                {it.n}
              </span>
              {big && <span className="label" style={{ color: zero ? "var(--fg-faint)" : "var(--fg-muted)" }}>{v.label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact stream-row tally: p/w/f counts in mono. */
export function TallyInline({ summary }: { summary: Summary }) {
  const cells = [
    { n: summary.pass || 0, c: "var(--pass)" },
    { n: summary.warn || 0, c: "var(--warn)" },
    { n: summary.fail || 0, c: "var(--fail)" },
  ];
  return (
    <div className="mono" style={{ display: "flex", gap: 9, fontSize: 12.5, alignItems: "center" }}>
      {cells.map((c, i) => (
        <span key={i} style={{ color: c.n ? c.c : "var(--fg-faint)", display: "inline-flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: 5, background: "currentColor", opacity: c.n ? 0.9 : 0.4 }} />
          {c.n}
        </span>
      ))}
    </div>
  );
}
