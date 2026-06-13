import { riskBand, riskColor, riskDotColor } from "@/lib/view-model";

export function RiskDot({ score, size = 8 }: { score: number; size?: number }) {
  const b = riskBand(score);
  const c = riskDotColor(score);
  return (
    <span
      title={`risk ${score} (${b})`}
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: c,
        opacity: b === "low" ? 0.7 : 1,
        display: "inline-block",
        flexShrink: 0,
        boxShadow: b === "high" ? "0 0 0 3px var(--fail-tint)" : "none",
      }}
    />
  );
}

export function RiskNumeral({ score }: { score: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1 }}>
      <div className="label" style={{ marginBottom: 6 }}>risk</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="display-face tnum" style={{ fontSize: 52, fontWeight: 500, letterSpacing: "-0.03em", color: riskColor(score) }}>
          {score}
        </span>
        <span className="tnum" style={{ fontSize: 17, color: "var(--fg-muted)", fontWeight: 400 }}>/ 100</span>
      </div>
    </div>
  );
}
