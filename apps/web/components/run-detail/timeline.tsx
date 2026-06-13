import type { RunDetail } from "@/lib/api-types";
import { fmtTimeLabel, timelineEmphasis } from "@/lib/view-model";

export function Timeline({ run }: { run: RunDetail }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 14 }}>Timeline</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {run.timeline.map((t, i) => {
          const emph = timelineEmphasis(t.event);
          const last = i === run.timeline.length - 1;
          const col =
            emph === "fail" ? "var(--fail)" : emph === "override" ? "var(--brand)" : emph === "decision" ? "var(--info)" : "var(--fg-faint)";
          return (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                <span style={{ width: emph ? 9 : 7, height: emph ? 9 : 7, borderRadius: 9, marginTop: 4, background: emph ? col : "transparent", border: emph ? "none" : `1.5px solid ${col}`, flexShrink: 0 }} />
                {!last && <span style={{ flex: 1, width: 1.5, background: "var(--line-2)", margin: "3px 0" }} />}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16, display: "flex", gap: 14, alignItems: "baseline", minWidth: 0 }}>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-muted)", flexShrink: 0, width: 64 }}>{fmtTimeLabel(t.at)}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5, color: emph ? "var(--fg)" : "var(--fg-2)", fontWeight: emph ? 500 : 400 }}>{t.event}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
