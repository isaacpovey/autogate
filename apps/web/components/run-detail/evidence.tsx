import type { RunDetail, CheckLayer } from "@/lib/api-types";
import {
  SPINE_COLOR,
  LAYER_LABEL,
  layerStance,
  gateStance,
  conclusionStance,
  disagreement,
  verdictStyle,
  type Stance,
} from "@/lib/view-model";
import { VerdictGlyph } from "@/components/primitives/verdict-glyph";
import { Icon } from "@/components/primitives/icon";
import { CheckRow } from "./check-row";
import { MonitoringRow } from "./monitoring-row";

function gutterOpacity(stance: Stance): number {
  return stance === "pass" ? 0.4 : stance === "pending" ? 0.25 : 0.7;
}

function CountChips({ counts }: { counts: Partial<Record<string, number>> }) {
  const order = ["fail", "warn", "needs_human", "pass", "pending"];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {order.map((k) =>
        counts[k] ? (
          <span key={k} className="tnum" style={{ fontSize: 11, color: verdictStyle(k).c, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: 5, background: verdictStyle(k).c }} />
            {counts[k]} {verdictStyle(k).label}
          </span>
        ) : null,
      )}
    </div>
  );
}

function LayerShell({
  layer,
  stance,
  counts,
  children,
}: {
  layer: CheckLayer;
  stance: Stance;
  counts: Partial<Record<string, number>>;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      <div style={{ position: "absolute", left: 5, top: 30, bottom: 8, width: 2, borderRadius: 2, background: SPINE_COLOR[layer], opacity: gutterOpacity(stance) }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 8px 16px" }}>
        <span className="label" style={{ color: SPINE_COLOR[layer], fontSize: 11, opacity: 0.95 }}>{LAYER_LABEL[layer]}</span>
        <CountChips counts={counts} />
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      {children}
    </div>
  );
}

function GateChecksGroup({ run }: { run: RunDetail }) {
  const counts: Record<string, number> = {};
  run.gateChecks.forEach((g) => {
    const s = conclusionStance(g.conclusion);
    counts[s] = (counts[s] ?? 0) + 1;
  });
  return (
    <LayerShell layer="gate" stance={gateStance(run)} counts={counts}>
      {run.gateChecks.length === 0 ? (
        <div style={{ marginLeft: 16, padding: "12px 0", color: "var(--fg-muted)", fontSize: 13 }} className="caption">No Layer-1 checks reported yet.</div>
      ) : (
        run.gateChecks.map((g, i) => {
          const s = conclusionStance(g.conclusion);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px 12px 16px", borderBottom: "1px solid var(--line)", borderLeft: "2px solid transparent" }}>
              <VerdictGlyph verdict={s} size={16} />
              <span className="mono" style={{ fontSize: 13, color: s === "pass" ? "var(--fg-2)" : "var(--fg)" }}>{g.name}</span>
              <span className="mono caption" style={{ marginLeft: 2 }}>{g.conclusion}</span>
              <div style={{ flex: 1 }} />
              {g.url && (
                <a href={g.url} target="_blank" rel="noreferrer" className="focusable" style={{ display: "flex", color: "var(--fg-faint)" }} title="Open on GitHub">
                  <Icon name="external" size={13} />
                </a>
              )}
            </div>
          );
        })
      )}
    </LayerShell>
  );
}

function AiGroup({ run, conflict }: { run: RunDetail; conflict: boolean }) {
  const rows = run.checks.filter((c) => c.layer === "ai");
  const counts: Record<string, number> = {};
  rows.forEach((c) => {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  });
  return (
    <LayerShell layer="ai" stance={layerStance(run.checks, "ai")} counts={counts}>
      {rows.length === 0 ? (
        <div style={{ marginLeft: 16, padding: "12px 0" }} className="caption">No agent reviews yet.</div>
      ) : (
        rows.map((c, i) => <CheckRow key={c.sourceId + i} check={c} conflict={conflict} />)
      )}
    </LayerShell>
  );
}

function MonitoringGroup({ run }: { run: RunDetail }) {
  const monitorChecks = run.checks.filter((c) => c.layer === "monitor");
  const hasMon = !!run.monitoring;
  const stance: Stance = hasMon ? (run.monitoring!.rolledBack ? "fail" : "pass") : "pending";
  return (
    <LayerShell layer="monitor" stance={stance} counts={{}}>
      {hasMon ? (
        <>
          <MonitoringRow run={run} />
          {monitorChecks.map((c, i) => (
            <CheckRow key={c.sourceId + i} check={c} />
          ))}
        </>
      ) : run.status === "completed" ? (
        <div style={{ marginLeft: 16, padding: "14px 18px", borderRadius: 7, background: "var(--bg)", border: "1px dashed var(--line-2)", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Icon name="clock" size={16} style={{ color: "var(--fg-muted)", marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 450 }}>Runs after this change merges</div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5, maxWidth: 560 }}>Canary, error tracking, and rollback safety begin once it&apos;s live. No findings yet.</p>
          </div>
        </div>
      ) : (
        <div style={{ marginLeft: 16, padding: "12px 0" }} className="caption">Begins after merge.</div>
      )}
    </LayerShell>
  );
}

export function Evidence({ run }: { run: RunDetail }) {
  const { conflict } = disagreement(run);
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span className="label" style={{ color: "var(--fg-2)" }}>Evidence</span>
        <div style={{ flex: 1 }} />
        {conflict && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "3px 10px", borderRadius: 5, background: "var(--warn-tint)", border: "1px solid var(--warn-edge)", fontSize: 11.5, fontWeight: 500, color: "var(--warn)" }}>
            <Icon name="zap" size={13} /> layers disagree
          </span>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <GateChecksGroup run={run} />
        <AiGroup run={run} conflict={conflict} />
        <MonitoringGroup run={run} />
      </div>
    </div>
  );
}
