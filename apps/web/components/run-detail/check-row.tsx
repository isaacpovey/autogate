import { useState } from "react";
import type { CheckResult } from "@/lib/api-types";
import { fmtDuration, verdictStyle } from "@/lib/view-model";
import { VerdictGlyph } from "@/components/primitives/verdict-glyph";
import { Icon } from "@/components/primitives/icon";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--fail)",
  high: "var(--fail)",
  medium: "var(--warn)",
  low: "var(--incon)",
  info: "var(--fg-muted)",
};

export function CheckRow({ check, conflict }: { check: CheckResult; conflict?: boolean }) {
  const [open, setOpen] = useState(false);
  const v = check.status;
  const isConcern = v === "fail" || v === "warn" || v === "needs_human";
  const loud = !!conflict && (v === "fail" || v === "warn");
  const dur = fmtDuration(check.durationMs);
  const vt = verdictStyle(v);
  const expandable = check.findings.length > 0;
  return (
    <div
      className="settle"
      style={{
        borderBottom: "1px solid var(--line)",
        borderLeft: isConcern ? `2px solid ${vt.edge}` : "2px solid transparent",
        background: loud ? `color-mix(in srgb, ${vt.c} 7%, transparent)` : "transparent",
        paddingLeft: 16,
      }}
    >
      <div
        onClick={() => expandable && setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px 16px 0", cursor: expandable ? "pointer" : "default" }}
      >
        <div style={{ marginTop: 1 }}>
          <VerdictGlyph verdict={v} size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: v === "pass" ? "var(--fg-2)" : "var(--fg)", letterSpacing: "-0.01em" }}>{check.sourceId}</span>
            {isConcern && <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: vt.c }}>{vt.label}</span>}
            <div style={{ flex: 1 }} />
            {dur && <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>{dur}</span>}
            {expandable && <Icon name="chevronDown" size={14} style={{ color: "var(--fg-faint)", transform: open ? "rotate(180deg)" : "none", transition: "transform 140ms ease" }} />}
          </div>
          {check.summary && (
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: v === "pass" ? "var(--fg-3)" : "var(--fg-2)", maxWidth: 680 }}>{check.summary}</p>
          )}
          {open && (
            <div className="settle" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {check.findings.map((f, i) => (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: SEVERITY_COLOR[f.severity] ?? "var(--fg-muted)" }}>{f.severity}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{f.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-3)" }}>{f.detail}</p>
                  {f.location && (
                    <div className="mono" style={{ marginTop: 6, fontSize: 11.5, color: "var(--fg-muted)" }}>
                      {f.location.file}{f.location.line != null ? `:${f.location.line}` : ""}
                    </div>
                  )}
                  {f.evidence && (
                    <p className="mono" style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.6, color: "var(--fg-3)", whiteSpace: "pre-wrap" }}>{f.evidence}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
