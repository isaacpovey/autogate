/* ============================================================
   Autogate — Run Detail / Escalation (hero reasoning view)
   Reading path: header → brief → evidence → decision → timeline
   ============================================================ */
const { useState, useRef, useEffect } = React;

const LAYER_ORDER = ["static", "ai", "monitoring"];

/* ---- expandable check row ---- */
function CheckRow({ check, conflict }) {
  const [open, setOpen] = useState(false);
  const v = check.verdict;
  const isConcern = v === "fail" || v === "warn" || v === "inconclusive";
  const loud = conflict && (v === "fail" || v === "warn");
  const dur = AG.fmtDuration(check.durationMs);
  const vt = VERDICT[v] || VERDICT.pending;
  const expandable = !!check.detail;
  return (
    <div className="settle" style={{
      borderBottom: "1px solid var(--line)",
      borderLeft: isConcern ? `2px solid ${vt.edge}` : "2px solid transparent",
      background: loud ? "color-mix(in srgb, " + vt.c + " 7%, transparent)" : "transparent",
      paddingLeft: 16,
    }}>
      <div onClick={() => expandable && setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px 16px 0", cursor: expandable ? "pointer" : "default" }}>
        <div style={{ marginTop: 1 }}><VerdictGlyph verdict={v || "pending"} size={17} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: v === "pass" ? "var(--fg-2)" : "var(--fg)", letterSpacing: "-0.01em" }}>{check.kind}</span>
            {isConcern && <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: vt.c }}>{vt.label}</span>}
            <div style={{ flex: 1 }} />
            {dur && <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>{dur}</span>}
            {expandable && <Icon name="chevronDown" size={14} style={{ color: "var(--fg-faint)", transform: open ? "rotate(180deg)" : "none", transition: "transform 140ms ease" }} />}
          </div>
          {check.finding && (
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: v === "pass" ? "var(--fg-3)" : "var(--fg-2)", maxWidth: 680 }}>{check.finding}</p>
          )}
          {open && check.detail && (
            <div className="settle" style={{ marginTop: 10, padding: "10px 12px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--line)" }}>
              <div className="label" style={{ marginBottom: 5 }}>agent detail</div>
              <p className="mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--fg-3)" }}>{check.detail}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- evidence layer group with spine gutter ---- */
function LayerGroup({ layer, checks, run, conflict }) {
  const rows = checks.filter((c) => c.layer === layer);
  const stance = layerStance(run.checks, layer);
  const isMon = layer === "monitoring";
  const preMerge = isMon && !run.monitoring;
  const counts = { pass: 0, warn: 0, fail: 0, inconclusive: 0 };
  rows.forEach((r) => { if (r.verdict) counts[r.verdict]++; });
  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      {/* spine gutter */}
      <div style={{ position: "absolute", left: 5, top: 30, bottom: 8, width: 2, borderRadius: 2,
        background: SPINE_COLOR[layer], opacity: stance === "pass" ? 0.4 : stance === "pending" ? 0.25 : 0.7 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 8px 16px" }}>
        <span className="label" style={{ color: SPINE_COLOR[layer], fontSize: 11, opacity: 0.95 }}>{AG.layerLabel[layer]}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {["fail", "warn", "inconclusive", "pass"].map((k) => counts[k] ? (
            <span key={k} className="tnum" style={{ fontSize: 11, color: VERDICT[k].c, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: VERDICT[k].c }} />{counts[k]} {k}</span>) : null)}
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      {preMerge ? (
        <div style={{ marginLeft: 16, padding: "14px 18px", borderRadius: 7, background: "var(--bg)", border: "1px dashed var(--line-2)", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Icon name="clock" size={16} style={{ color: "var(--fg-muted)", marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 450 }}>Runs after this change merges</div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5, maxWidth: 560 }}>
              Canary, error tracking, and rollback safety begin once it's live. No findings yet.</p>
          </div>
        </div>
      ) : isMon && run.monitoring ? (
        <MonitoringRow run={run} />
      ) : (
        rows.map((c, i) => <CheckRow key={c.kind + "-" + (c.verdict || "pending")} check={c} conflict={conflict} />)
      )}
    </div>
  );
}

function MonitoringRow({ run }) {
  const m = run.monitoring;
  const degrading = run.incident && !m.rolledBack;
  const done = m.rolledBack;
  const v = degrading || done ? "fail" : "pass";
  return (
    <div style={{ marginLeft: 16, borderLeft: `2px solid ${degrading || done ? "var(--fail-edge)" : "var(--pass-edge)"}`, paddingLeft: 16 }}>
      <div style={{ padding: "16px 18px 16px 0", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ marginTop: 1 }}><VerdictGlyph verdict={v} size={17} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>canary-monitoring</span>
            {(degrading || done) && <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fail)" }}>{done ? "rolled back" : "fail"}</span>}
          </div>
          <p style={{ margin: "6px 0 10px", fontSize: 13, lineHeight: 1.55, color: "var(--fg-2)", maxWidth: 680 }}>
            {done ? "Rolled back after errors crossed the threshold. The pre-merge checks above are green history."
              : degrading ? "Error rate is climbing on the live canary — the pre-merge checks passed; this only appeared under real load."
              : "Healthy in production. Error rate is flat since rollout."}</p>
          <div style={{ display: "flex", gap: 26 }}>
            {[["canary", m.canaryPercent + "%"], ["new errors", degrading ? "+" + m.newErrors : m.newErrors], ["window", m.window]].map(([k, val]) => (
              <div key={k}><div className="label" style={{ marginBottom: 3 }}>{k}</div>
                <div className="tnum" style={{ fontSize: 15, fontWeight: 500, color: (k === "new errors" && degrading) ? "var(--fail)" : "var(--fg)" }}>{val}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- orchestrator brief ---- */
function OrchestratorBrief({ run }) {
  const d = run.decisionInfo;
  return (
    <div style={{ borderRadius: 9, padding: "18px 20px", background: "var(--info-tint)",
      border: "1px solid var(--info-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
        <span style={{ width: 6, height: 6, borderRadius: 6, background: "var(--info)" }} />
        <span className="label" style={{ color: "var(--info)" }}>Orchestrator brief</span>
      </div>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg)", maxWidth: 720 }}>{d.brief}</p>
      <div style={{ marginTop: 15, display: "flex", flexDirection: "column", gap: 9 }}>
        {d.reasons.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ marginTop: 6, width: 5, height: 5, borderRadius: 1.5, background: "var(--info)", flexShrink: 0, transform: "rotate(45deg)" }} />
            <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fg-2)" }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- decision / action block ---- */
function ActionBlock({ run, onAct, autoRollback }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(null); // {action}
  const decision = run.decision;
  const inProgress = run._rollbackInProgress;

  // terminal / confirmed states
  if (run._rollbackInProgress) return <RollbackProgress run={run} />;
  if (decision === "rolled_back") return <ConfirmedSummary run={run} kind="rolled_back" />;
  if (decision === "merged" && run.overridden) return <ConfirmedSummary run={run} kind="overridden" />;
  if (decision === "merged" && run.incident) {
    // degrading in production → rollback decision
    return (<>
      <RollbackBlock run={run} onConfirm={(rsn) => setConfirm({ action: "rollback", reason: rsn })} forced={autoRollback} initialOpen={autoRollback} />
      {confirm && <ConfirmModal run={run} action={confirm.action} reason={confirm.reason} onCancel={() => setConfirm(null)} onConfirm={() => { onAct(run.runId, confirm); setConfirm(null); }} />}
    </>);
  }
  if (decision === "merged") return <ConfirmedSummary run={run} kind="merged" />;
  if (decision === "auto_merge") return <AutoMergedFooter run={run} onAct={onAct} />;

  // active decision: escalate or blocked → approve/block, reason-gated
  const blocked = decision === "blocked";
  const canSubmit = reason.trim().length >= 4;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="display-face" style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)" }}>Your decision</span>
        <span className="caption">a reason is required</span>
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="focusable"
        placeholder={blocked ? "Why are you overriding the block, or keeping it? This is recorded on the run." : "What did you weigh, and why is this the right call? This is recorded on the run."}
        rows={3} style={{
          width: "100%", resize: "vertical", background: "var(--bg)", color: "var(--fg)", fontFamily: "inherit",
          fontSize: 13.5, lineHeight: 1.5, padding: "12px 14px", borderRadius: 7, border: "1px solid var(--line-2)", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 11, alignItems: "center", flexWrap: "wrap" }}>
        <button disabled={!canSubmit} onClick={() => setConfirm({ action: "approve_merge", reason })} style={actBtn("pass", !canSubmit)}>
          <VerdictGlyph verdict="pass" size={15} /> {blocked ? "Override — approve & merge" : "Approve & merge"}</button>
        {!blocked && <button disabled={!canSubmit} onClick={() => setConfirm({ action: "block", reason })} style={actBtn("fail", !canSubmit)}>
          <Icon name="x" size={15} /> Block this change</button>}
        {blocked && <button disabled={!canSubmit} onClick={() => setConfirm({ action: "block", reason })} style={actBtn("fail", !canSubmit)}>
          <Icon name="shield" size={15} /> Keep blocked</button>}
        {!canSubmit && <span className="caption" style={{ color: "var(--fg-faint)" }}>Enter a reason to enable</span>}
      </div>
      {confirm && <ConfirmModal run={run} action={confirm.action} reason={confirm.reason}
        onCancel={() => setConfirm(null)} onConfirm={() => { onAct(run.runId, confirm); setConfirm(null); }} />}
    </div>
  );
}

function actBtn(family, disabled) {
  const c = `var(--${family === "pass" ? "pass" : family})`;
  return { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 7,
    background: "transparent", color: disabled ? "var(--fg-faint)" : c, fontSize: 13.5, fontWeight: 500,
    border: `1px solid ${disabled ? "var(--line-2)" : `color-mix(in srgb, ${c} 50%, transparent)`}`,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 };
}

function RollbackBlock({ run, onConfirm, initialOpen }) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= 4;
  return (
    <div style={{ borderRadius: 9, padding: "18px 20px", background: "var(--fail-tint)", border: "1px solid var(--fail-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Icon name="incident" size={16} style={{ color: "var(--fail)" }} />
        <span className="display-face" style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)" }}>This change is degrading in production</span>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55, maxWidth: 640 }}>
        Reverts the change for all users immediately and stops the canary.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="focusable"
        placeholder="What's failing, and why roll back now?" style={{
          width: "100%", resize: "vertical", background: "var(--bg)", color: "var(--fg)", fontFamily: "inherit",
          fontSize: 13.5, lineHeight: 1.5, padding: "11px 13px", borderRadius: 7, border: "1px solid var(--fail-edge)", marginBottom: 13 }} />
      <button disabled={!canSubmit} onClick={() => onConfirm(reason)} style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 7,
        background: canSubmit ? "var(--fail)" : "transparent", color: canSubmit ? "var(--bg)" : "var(--fg-faint)",
        fontSize: 13.5, fontWeight: 500, border: canSubmit ? "1px solid var(--fail)" : "1px solid var(--line-2)",
        cursor: canSubmit ? "pointer" : "not-allowed" }}>
        <Icon name="rotate" size={15} /> Roll back from production</button>
    </div>
  );
}

function RollbackProgress({ run }) {
  return (
    <div style={{ borderRadius: 9, padding: "18px 20px", background: "var(--fail-tint)", border: "1px solid var(--fail-edge)", display: "flex", alignItems: "center", gap: 13 }}>
      <Icon name="rotate" size={18} style={{ color: "var(--fail)", animation: "spin 1s linear infinite" }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg)" }}>Rolling back…</div>
        <div className="caption">Reverting the change for all users and stopping the canary. Actions are locked until this completes.</div>
      </div>
    </div>
  );
}

function AutoMergedFooter({ run, onAct }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(null);
  return (
    <div style={{ borderRadius: 9, padding: "16px 18px", background: "var(--bg-raised)", border: "1px solid var(--line)", boxShadow: "var(--lit-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <VerdictGlyph verdict="pass" size={16} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 450 }}>Auto-merged with no human — within autonomy policy</div>
          <div className="caption" style={{ marginTop: 1 }}>If you disagree with this decision, you can roll it back.</div>
        </div>
        {!open && <button onClick={() => setOpen(true)} style={btnGhost}>I disagree — roll back</button>}
      </div>
      {open && (
        <div className="settle" style={{ marginTop: 14 }}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="focusable"
            placeholder="Why should this auto-merged change be rolled back?" style={{
              width: "100%", resize: "vertical", background: "var(--bg)", color: "var(--fg)", fontFamily: "inherit",
              fontSize: 13.5, lineHeight: 1.5, padding: "11px 13px", borderRadius: 7, border: "1px solid var(--line-2)", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={reason.trim().length < 4} onClick={() => setConfirm({ action: "rollback", reason })} style={actBtn("fail", reason.trim().length < 4)}><Icon name="rotate" size={14} /> Roll back</button>
            <button onClick={() => { setOpen(false); setReason(""); }} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}
      {confirm && <ConfirmModal run={run} action={confirm.action} reason={confirm.reason} onCancel={() => setConfirm(null)} onConfirm={() => { onAct(run.runId, confirm); setConfirm(null); }} />}
    </div>
  );
}

/* ---- confirmed-state summary (post-action, permanent record) ---- */
function ConfirmedSummary({ run, kind }) {
  const ov = run.overridden || run._lastAction;
  const map = {
    merged: { c: "var(--pass)", glyph: "pass", title: "Merged to main", note: "Canary rollout started at 25%." },
    overridden: { c: "var(--pass)", glyph: "pass", title: "Approved & merged by override", note: "Canary rollout started at 25%." },
    blocked: { c: "var(--fail)", glyph: null, title: "Blocked from merging", note: "The author has been notified." },
    rolled_back: { c: "var(--fail)", glyph: null, title: "Rolled back from production", note: "The change was reverted for all users." },
  }[kind];
  return (
    <div style={{ borderRadius: 9, padding: "18px 20px", background: "var(--bg-raised)", border: `1px solid color-mix(in srgb, ${map.c} 35%, transparent)`, boxShadow: "var(--lit-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: ov ? 14 : 4 }}>
        {map.glyph ? <VerdictGlyph verdict={map.glyph} size={18} /> : <span style={{ width: 16, height: 16, borderRadius: 4, background: map.c, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name={kind === "rolled_back" ? "rotate" : "x"} size={12} style={{ color: "var(--bg)" }} /></span>}
        <span className="display-face" style={{ fontSize: 16, fontWeight: 500, color: "var(--fg)" }}>{map.title}</span>
        <div style={{ flex: 1 }} />
        <span className="caption">{map.note}</span>
      </div>
      {ov && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 13, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <Avatar name={ov.actor || AG.ME} size={26} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{ov.actor || AG.ME}</span>
              <span className="caption mono">{ov.at || "just now"}</span>
            </div>
            <div className="label" style={{ margin: "9px 0 5px" }}>recorded reason</div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-2)", maxWidth: 680 }}>{ov.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- confirmation modal (restates consequence in plain language) ---- */
function ConfirmModal({ run, action, reason, onCancel, onConfirm }) {
  const cfg = {
    approve_merge: { title: "Approve & merge", c: "var(--pass)",
      body: <>Merge <b>{run.pr.title}</b> to <code className="mono" style={{ color: "var(--fg)" }}>main</code> and begin canary rollout at 25%? The change will start reaching real users.</>,
      cta: "Approve & merge" },
    block: { title: "Block this change", c: "var(--fail)",
      body: <>Block <b>{run.pr.title}</b> from merging? It will not reach production, and the author ({run.pr.author}) will be notified.</>,
      cta: "Block change" },
    rollback: { title: "Roll back from production", c: "var(--fail)",
      body: <>Roll back <b>{run.pr.title}</b> from production? This reverts the change for all users immediately and stops the canary.</>,
      cta: "Roll back now" },
  }[action];
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(10,8,6,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", animation: "overlay-in 140ms ease" }}>
      <div onClick={(e) => e.stopPropagation()} className="popin" style={{ width: 460, maxWidth: "92vw", borderRadius: 11,
        background: "var(--bg-raised)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-pop), var(--lit-edge-strong)", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: cfg.c }} />
          <span className="display-face" style={{ fontSize: 16, fontWeight: 500 }}>{cfg.title}</span>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "var(--fg-2)" }}>{cfg.body}</p>
        <div style={{ padding: "11px 13px", borderRadius: 7, background: "var(--bg)", border: "1px solid var(--line)", marginBottom: 18 }}>
          <div className="label" style={{ marginBottom: 5 }}>recorded reason</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--fg-2)" }}>{reason}</p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} className="focusable" style={{ padding: "9px 16px", borderRadius: 7, background: "transparent", color: "var(--fg-2)", fontSize: 13.5, border: "1px solid var(--line-2)" }}>Cancel</button>
          <button onClick={onConfirm} className="focusable" autoFocus={false} style={{ padding: "9px 18px", borderRadius: 7,
            background: cfg.c, color: "var(--bg)", fontSize: 13.5, fontWeight: 500, border: `1px solid ${cfg.c}` }}>{cfg.cta}</button>
        </div>
      </div>
    </div>
  );
}

/* ---- timeline ---- */
function Timeline({ run }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 14 }}>Timeline</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {run.timeline.map((t, i) => {
          const emph = t.emphasis;
          const last = i === run.timeline.length - 1;
          const col = emph === "fail" ? "var(--fail)" : emph === "override" ? "var(--brand)" : emph === "decision" ? "var(--info)" : "var(--fg-faint)";
          return (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                <span style={{ width: emph ? 9 : 7, height: emph ? 9 : 7, borderRadius: 9, marginTop: 4,
                  background: emph ? col : "transparent", border: emph ? "none" : `1.5px solid ${col}`, flexShrink: 0 }} />
                {!last && <span style={{ flex: 1, width: 1.5, background: "var(--line-2)", margin: "3px 0" }} />}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16, display: "flex", gap: 14, alignItems: "baseline", minWidth: 0 }}>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-muted)", flexShrink: 0, width: 92 }}>{t.at}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5, color: emph ? "var(--fg)" : "var(--fg-2)", fontWeight: emph ? 500 : 400 }}>{t.event}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- live "assessing" panel for running runs ---- */
function AssessingPanel({ run }) {
  const resolved = run.checks.filter((c) => c.verdict).length;
  const total = run.checks.length;
  return (
    <div style={{ borderRadius: 9, padding: "16px 18px", background: "var(--info-tint)", border: "1px solid var(--info-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: 8, background: "var(--info)" }} />
        <span className="display-face" style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)" }}>Still assessing</span>
        <div style={{ flex: 1 }} />
        <span className="tnum caption">{resolved} / {total} checks resolved</span>
      </div>
    </div>
  );
}

/* ============================================================ */
function RunDetail({ run, onBack, onAct, autoRollback }) {
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [run.runId]);
  const dis = run.checks ? AG.disagreement(run.checks) : { conflict: false };
  const isRunning = run.status === "running";
  const inconCount = run.inconclusive || (run.checks ? run.checks.filter((c) => c.verdict === "inconclusive").length : 0);
  const tally = { ...run.checkSummary };
  return (
    <div ref={scrollRef} className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 40px 80px" }}>
        {/* back */}
        <button onClick={onBack} className="focusable" style={{ display: "inline-flex", alignItems: "center", gap: 7,
          background: "none", border: "none", color: "var(--fg-muted)", fontSize: 13, padding: "4px 0", marginBottom: 18 }}>
          <Icon name="arrowLeft" size={15} /> open reviews
        </button>

        {/* decision + stakes header */}
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", marginBottom: 22 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 12 }}><StatusPill decision={run.decision} status={run.status} size="lg" /></div>
            <h1 className="display-face" style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.18, letterSpacing: "-0.02em", margin: "0 0 10px", color: "var(--fg)", textWrap: "pretty" }}>{run.pr.title}</h1>
            <div className="mono" style={{ fontSize: 12.5, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{run.pr.repo}</span><span style={{ opacity: 0.5 }}>·</span>
              <span>#{run.pr.number}</span><span style={{ opacity: 0.5 }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Avatar name={run.pr.author} size={16} />{run.pr.author}</span><span style={{ opacity: 0.5 }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="branch" size={12} />{run.pr.branch}</span>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}><RiskNumeral score={run.riskScore} /></div>
        </div>

        {/* resolved tally */}
        <div style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <TallyTiles summary={tally} inconclusive={inconCount} size="lg" />
        </div>

        {/* brief OR assessing */}
        <div style={{ marginBottom: 26 }}>
          {isRunning ? <AssessingPanel run={run} /> : <OrchestratorBrief run={run} />}
        </div>

        {/* evidence */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span className="label" style={{ color: "var(--fg-2)" }}>Evidence</span>
            <div style={{ flex: 1 }} />
            {dis.conflict && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "3px 10px", borderRadius: 5,
                background: "var(--warn-tint)", border: "1px solid var(--warn-edge)", fontSize: 11.5, fontWeight: 500, color: "var(--warn)" }}>
                <Icon name="zap" size={13} /> layers disagree</span>
            )}
          </div>
          <div style={{ position: "relative" }}>
            {LAYER_ORDER.map((L) => <LayerGroup key={L} layer={L} checks={run.checks} run={run} conflict={dis.conflict} />)}
          </div>
        </div>

        {/* decision / action */}
        {!isRunning && (
          <div style={{ marginBottom: 30 }}>
            <ActionBlock run={run} onAct={onAct} autoRollback={autoRollback} />
          </div>
        )}

        {/* timeline */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <Timeline run={run} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RunDetail });
