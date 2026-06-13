import { useState } from "react";
import type { RunDetail } from "@/lib/api-types";
import { deriveIncident, recordedReasonFrom } from "@/lib/view-model";
import { VerdictGlyph } from "@/components/primitives/verdict-glyph";
import { Icon } from "@/components/primitives/icon";
import { ConfirmModal, type ConfirmAction } from "./confirm-modal";

export type ActPayload = { action: ConfirmAction; reason: string };

function actBtn(family: "pass" | "fail", disabled: boolean): React.CSSProperties {
  const c = family === "pass" ? "var(--pass)" : "var(--fail)";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    borderRadius: 7,
    background: "transparent",
    color: disabled ? "var(--fg-faint)" : c,
    fontSize: 13.5,
    fontWeight: 500,
    border: `1px solid ${disabled ? "var(--line-2)" : `color-mix(in srgb, ${c} 50%, transparent)`}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  resize: "vertical",
  background: "var(--bg)",
  color: "var(--fg)",
  fontFamily: "inherit",
  fontSize: 13.5,
  lineHeight: 1.5,
  padding: "12px 14px",
  borderRadius: 7,
  border: "1px solid var(--line-2)",
  marginBottom: 14,
};

export function ActionBlock({ run, onAct, pending }: { run: RunDetail; onAct: (p: ActPayload) => void; pending: boolean }) {
  const outcome = run.decision.outcome;
  const recorded = recordedReasonFrom(run);

  if (outcome === "rolled_back") return <ConfirmedSummary run={run} kind="rolled_back" />;
  if (outcome === "merged") {
    if (deriveIncident(run)) return <RollbackBlock run={run} onAct={onAct} pending={pending} />;
    if (recorded) return <ConfirmedSummary run={run} kind="overridden" />;
    return <ConfirmedSummary run={run} kind="merged" />;
  }
  if (outcome === "blocked" && recorded) return <ConfirmedSummary run={run} kind="blocked" />;
  if (outcome === "auto_merge") return <AutoMergedFooter run={run} onAct={onAct} pending={pending} />;
  if (outcome === "escalate" || outcome === "blocked") return <DecisionForm run={run} onAct={onAct} pending={pending} />;
  return null;
}

function DecisionForm({ run, onAct, pending }: { run: RunDetail; onAct: (p: ActPayload) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<ActPayload | null>(null);
  const blocked = run.decision.outcome === "blocked";
  const canSubmit = reason.trim().length >= 4;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="display-face" style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)" }}>Your decision</span>
        <span className="caption">a reason is required</span>
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="focusable"
        placeholder={blocked ? "Why are you overriding the block, or keeping it? This is recorded on the run." : "What did you weigh, and why is this the right call? This is recorded on the run."}
        rows={3}
        style={textareaStyle}
      />
      <div style={{ display: "flex", gap: 11, alignItems: "center", flexWrap: "wrap" }}>
        <button disabled={!canSubmit} onClick={() => setConfirm({ action: "approve_merge", reason })} style={actBtn("pass", !canSubmit)}>
          <VerdictGlyph verdict="pass" size={15} /> {blocked ? "Override — approve & merge" : "Approve & merge"}
        </button>
        <button disabled={!canSubmit} onClick={() => setConfirm({ action: "block", reason })} style={actBtn("fail", !canSubmit)}>
          <Icon name={blocked ? "shield" : "x"} size={15} /> {blocked ? "Keep blocked" : "Block this change"}
        </button>
        {!canSubmit && <span className="caption" style={{ color: "var(--fg-faint)" }}>Enter a reason to enable</span>}
      </div>
      <ConfirmModal
        open={!!confirm}
        action={confirm?.action ?? "approve_merge"}
        reason={confirm?.reason ?? ""}
        pr={run.pr}
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) onAct(confirm);
          setConfirm(null);
        }}
      />
    </div>
  );
}

function AutoMergedFooter({ run, onAct, pending }: { run: RunDetail; onAct: (p: ActPayload) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<ActPayload | null>(null);
  const canSubmit = reason.trim().length >= 4;
  return (
    <div style={{ borderRadius: 9, padding: "16px 18px", background: "var(--bg-raised)", border: "1px solid var(--line)", boxShadow: "var(--lit-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <VerdictGlyph verdict="pass" size={16} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 450 }}>Auto-merged with no human — within autonomy policy</div>
          <div className="caption" style={{ marginTop: 1 }}>If you disagree with this decision, you can roll it back.</div>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 6, background: "transparent", color: "var(--fg-2)", fontSize: 12.5, border: "1px solid var(--line-2)" }}>
            I disagree — roll back
          </button>
        )}
      </div>
      {open && (
        <div className="settle" style={{ marginTop: 14 }}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="focusable" placeholder="Why should this auto-merged change be rolled back?" style={textareaStyle} />
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={!canSubmit} onClick={() => setConfirm({ action: "rollback", reason })} style={actBtn("fail", !canSubmit)}>
              <Icon name="rotate" size={14} /> Roll back
            </button>
            <button onClick={() => { setOpen(false); setReason(""); }} style={{ padding: "9px 16px", borderRadius: 7, background: "transparent", color: "var(--fg-2)", fontSize: 13.5, border: "1px solid var(--line-2)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!confirm}
        action="rollback"
        reason={confirm?.reason ?? ""}
        pr={run.pr}
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm) onAct(confirm); setConfirm(null); }}
      />
    </div>
  );
}

function RollbackBlock({ run, onAct, pending }: { run: RunDetail; onAct: (p: ActPayload) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<ActPayload | null>(null);
  const canSubmit = reason.trim().length >= 4;
  return (
    <div style={{ borderRadius: 9, padding: "18px 20px", background: "var(--fail-tint)", border: "1px solid var(--fail-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Icon name="incident" size={16} style={{ color: "var(--fail)" }} />
        <span className="display-face" style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)" }}>This change is degrading in production</span>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55, maxWidth: 640 }}>Reverts the change for all users immediately and stops the canary.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="focusable" placeholder="What's failing, and why roll back now?" style={{ ...textareaStyle, border: "1px solid var(--fail-edge)", marginBottom: 13 }} />
      <button
        disabled={!canSubmit}
        onClick={() => setConfirm({ action: "rollback", reason })}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 7,
          background: canSubmit ? "var(--fail)" : "transparent", color: canSubmit ? "var(--bg)" : "var(--fg-faint)",
          fontSize: 13.5, fontWeight: 500, border: canSubmit ? "1px solid var(--fail)" : "1px solid var(--line-2)", cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        <Icon name="rotate" size={15} /> Roll back from production
      </button>
      <ConfirmModal
        open={!!confirm}
        action="rollback"
        reason={confirm?.reason ?? ""}
        pr={run.pr}
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm) onAct(confirm); setConfirm(null); }}
      />
    </div>
  );
}

function ConfirmedSummary({ run, kind }: { run: RunDetail; kind: "merged" | "overridden" | "blocked" | "rolled_back" }) {
  const recorded = recordedReasonFrom(run);
  const map = {
    merged: { c: "var(--pass)", glyph: true, title: "Merged to main", note: "Canary rollout started at 25%." },
    overridden: { c: "var(--pass)", glyph: true, title: "Approved & merged by override", note: "Canary rollout started at 25%." },
    blocked: { c: "var(--fail)", glyph: false, title: "Blocked from merging", note: "The author has been notified." },
    rolled_back: { c: "var(--fail)", glyph: false, title: "Rolled back from production", note: "The change was reverted for all users." },
  }[kind];
  return (
    <div style={{ borderRadius: 9, padding: "18px 20px", background: "var(--bg-raised)", border: `1px solid color-mix(in srgb, ${map.c} 35%, transparent)`, boxShadow: "var(--lit-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: recorded ? 14 : 4 }}>
        {map.glyph ? (
          <VerdictGlyph verdict="pass" size={18} />
        ) : (
          <span style={{ width: 16, height: 16, borderRadius: 4, background: map.c, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={kind === "rolled_back" ? "rotate" : "x"} size={12} style={{ color: "var(--bg)" }} />
          </span>
        )}
        <span className="display-face" style={{ fontSize: 16, fontWeight: 500, color: "var(--fg)" }}>{map.title}</span>
        <div style={{ flex: 1 }} />
        <span className="caption">{map.note}</span>
      </div>
      {recorded && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 13 }}>
          <div className="label" style={{ margin: "0 0 6px" }}>recorded reason</div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-2)", maxWidth: 680 }}>{recorded.reason}</p>
        </div>
      )}
    </div>
  );
}
