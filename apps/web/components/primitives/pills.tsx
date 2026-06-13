import { decisionStyle, statusPillKey, type Effort } from "@/lib/view-model";
import type { RunDecision, RunStatus } from "@/lib/api-types";

export function EffortPill({ effort }: { effort: Effort }) {
  return (
    <span
      title="Estimated effort to clear (derived)"
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "lowercase",
        color: "var(--effort)",
        background: "var(--effort-tint)",
        border: "1px solid color-mix(in srgb, var(--effort) 28%, transparent)",
        padding: "2px 8px",
        borderRadius: 5,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {effort}
    </span>
  );
}

export function StatusPill({
  decision,
  status,
  size = "md",
}: {
  decision: RunDecision;
  status: RunStatus;
  size?: "md" | "lg";
}) {
  const key = statusPillKey(decision, status);
  const s = decisionStyle(key);
  const live = status === "running";
  const pad = size === "lg" ? "4px 11px" : "2px 9px";
  const fz = size === "lg" ? 12.5 : 11.5;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        borderRadius: 5,
        fontSize: fz,
        fontWeight: 500,
        letterSpacing: "0.02em",
        color: s.c,
        background: s.tint,
        border: `1px solid color-mix(in srgb, ${s.c} 30%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        className={live ? "pulse-dot" : undefined}
        style={{ width: 6, height: 6, borderRadius: 6, background: s.c }}
      />
      {s.label}
    </span>
  );
}
