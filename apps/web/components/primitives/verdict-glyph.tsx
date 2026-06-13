import { verdictStyle } from "@/lib/view-model";
import type { VerdictStatus } from "@/lib/api-types";

/** Distinct SHAPE per verdict (monochrome-safe). `needs_human` = slate dashed query. */
export function VerdictGlyph({
  verdict,
  size = 16,
}: {
  verdict: VerdictStatus | "pending";
  size?: number;
}) {
  const c = verdictStyle(verdict).c;
  const s = size;
  const base = { display: "block", flexShrink: 0 } as const;

  if (verdict === "pass")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" style={base}>
        <circle cx="8" cy="8" r="7" fill="none" stroke={c} strokeWidth="1.3" opacity="0.55" />
        <path d="M4.8 8.2l2 2 4.4-4.6" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (verdict === "warn")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" style={base}>
        <path d="M8 2.2l6 11H2z" fill="none" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 6.6v3.1" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="0.85" fill={c} />
      </svg>
    );
  if (verdict === "fail")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" style={base}>
        <circle cx="8" cy="8" r="6.6" fill={c} fillOpacity="0.92" />
        <path d="M8 4.4v4.2" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11.3" r="0.95" fill="var(--bg)" />
      </svg>
    );
  if (verdict === "needs_human")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" style={base}>
        <circle cx="8" cy="8" r="6.6" fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="2.2 2.2" />
        <path d="M6.4 6.6a1.6 1.6 0 1 1 2.4 1.5c-.6.4-.8.7-.8 1.3" fill="none" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="0.8" fill={c} />
      </svg>
    );
  // pending — quiet hollow dashed
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" style={base}>
      <circle cx="8" cy="8" r="6.4" fill="none" stroke={c} strokeWidth="1.3" strokeDasharray="1 2.4" />
    </svg>
  );
}
