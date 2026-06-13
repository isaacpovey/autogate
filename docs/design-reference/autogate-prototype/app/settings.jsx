/* ============================================================
   Autogate — Settings (the gate's decision model) + My runs
   ============================================================ */
const { useState } = React;

/* ---- small controls ---- */
function Slider({ value, min, max, step = 1, unit, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)}
        className="ag-range" style={{ flex: 1, "--pct": pct + "%" }} />
      <span className="tnum" style={{ fontSize: 14, fontWeight: 500, color: "var(--fg)", minWidth: 54, textAlign: "right" }}>{value}{unit}</span>
    </div>
  );
}
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} className="focusable" role="switch" aria-checked={on} style={{
      width: 38, height: 22, borderRadius: 99, padding: 2, border: "1px solid var(--line-2)",
      background: on ? "var(--pass-tint)" : "var(--bg)", display: "flex", justifyContent: on ? "flex-end" : "flex-start", transition: "all 160ms ease" }}>
      <span style={{ width: 16, height: 16, borderRadius: 99, background: on ? "var(--pass)" : "var(--fg-faint)", transition: "all 160ms ease" }} />
    </button>
  );
}
function SettingRow({ label, desc, children, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 0", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 450 }}>{label}</div>
        {desc && <div className="caption" style={{ marginTop: 3, maxWidth: 460, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220, justifyContent: "flex-end" }}>{children}</div>
    </div>
  );
}
function SettingsSection({ n, title, sub, children }) {
  return (
    <div style={{ marginBottom: 14, borderRadius: 10, background: "var(--bg-raised)", border: "1px solid var(--line)", boxShadow: "var(--lit-edge)", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, alignItems: "baseline" }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--fg-faint)" }}>{n}</span>
        <div>
          <h3 className="display-face" style={{ fontSize: 15, fontWeight: 500, margin: 0, color: "var(--fg)" }}>{title}</h3>
          {sub && <p className="caption" style={{ margin: "3px 0 0", maxWidth: 540 }}>{sub}</p>}
        </div>
      </div>
      <div style={{ padding: "2px 20px 8px" }}>{children}</div>
    </div>
  );
}

function CritChip({ label, on, onToggle, removable, onRemove }) {
  return (
    <span onClick={onToggle} className="focusable" tabIndex={0} style={{
      display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 6, cursor: "pointer",
      fontSize: 12.5, fontWeight: 450, userSelect: "none",
      color: on ? "var(--fail)" : "var(--fg-muted)",
      background: on ? "var(--fail-tint)" : "var(--bg)",
      border: on ? "1px solid var(--fail-edge)" : "1px solid var(--line-2)" }}>
      {on && <Icon name="shield" size={13} />}{label}
      {removable && <span onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ display: "flex", color: "var(--fg-muted)", marginLeft: 2 }}><Icon name="x" size={12} /></span>}
    </span>
  );
}

function Settings() {
  const [riskCeiling, setRiskCeiling] = useState(30);
  const [warnTol, setWarnTol] = useState(1);
  const [canary, setCanary] = useState(25);
  const [autoRollback, setAutoRollback] = useState(true);
  const [errThreshold, setErrThreshold] = useState(50);
  const [crit, setCrit] = useState({ auth: true, billing: true, "data deletion": true, infra: true });
  const [custom, setCustom] = useState(["token issuance"]);
  const [newPat, setNewPat] = useState("");
  const [forces, setForces] = useState({ disagreement: true, lowConfidence: true, blastRadius: true, inconclusive: true });
  const [blast, setBlast] = useState(40);
  const [mode, setMode] = useState("assisted");

  const modes = [
    { v: "shadow", t: "Shadow", d: "The system decides but never acts. Every decision is logged for comparison; humans still merge everything manually." },
    { v: "assisted", t: "Assisted", d: "Low-risk changes auto-merge within policy. Anything uncertain, sensitive, or in disagreement is escalated to a human." },
    { v: "autonomous", t: "Autonomous", d: "The system merges everything within policy, including some sensitive paths. Humans audit after the fact and handle incidents." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 22px", height: 52, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <h1 className="display-face" style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Settings</h1>
        <span className="caption">how the gate decides on every run</span>
      </div>
      <div className="scroll" style={{ flex: 1 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 40px 80px" }}>

          <SettingsSection n="01" title="What auto-merges" sub="what can merge with no human">
            <SettingRow label="Risk ceiling" desc={`At or below ${riskCeiling}/100 may auto-merge.`}>
              <Slider value={riskCeiling} min={0} max={100} unit="/100" onChange={setRiskCeiling} />
            </SettingRow>
            <SettingRow label="Warning tolerance" desc="AI warnings allowed before escalating." last>
              <Slider value={warnTol} min={0} max={3} unit={warnTol === 1 ? " warn" : " warns"} onChange={setWarnTol} />
            </SettingRow>
          </SettingsSection>

          <SettingsSection n="02" title="What's always critical" sub="never auto-merge, whatever the risk">
            <div style={{ padding: "16px 0", display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center" }}>
              {Object.keys(crit).map((k) => <CritChip key={k} label={k} on={crit[k]} onToggle={() => setCrit((s) => ({ ...s, [k]: !s[k] }))} />)}
              {custom.map((c) => <CritChip key={c} label={c} on removable onToggle={() => {}} onRemove={() => setCustom((s) => s.filter((x) => x !== c))} />)}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg)", border: "1px dashed var(--line-2)", borderRadius: 6, padding: "3px 5px 3px 10px" }}>
                <input value={newPat} onChange={(e) => setNewPat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newPat.trim()) { setCustom((s) => [...s, newPat.trim()]); setNewPat(""); } }}
                  placeholder="add pattern…" style={{ background: "none", border: "none", color: "var(--fg)", fontSize: 12.5, width: 90, fontFamily: "inherit", outline: "none" }} />
                <button onClick={() => { if (newPat.trim()) { setCustom((s) => [...s, newPat.trim()]); setNewPat(""); } }} style={{ display: "flex", background: "none", border: "none", color: "var(--fg-muted)", padding: 2 }}><Icon name="plus" size={13} /></button>
              </span>
            </div>
          </SettingsSection>

          <SettingsSection n="03" title="What forces a human in" sub="always escalate, even within policy">
            <SettingRow label="Cross-layer disagreement">
              <Toggle on={forces.disagreement} onChange={(v) => setForces((s) => ({ ...s, disagreement: v }))} />
            </SettingRow>
            <SettingRow label="Inconclusive checks">
              <Toggle on={forces.inconclusive} onChange={(v) => setForces((s) => ({ ...s, inconclusive: v }))} />
            </SettingRow>
            <SettingRow label="Blast-radius limit" desc={`More than ${blast} files touched.`}>
              <Slider value={blast} min={5} max={100} step={5} unit=" files" onChange={setBlast} />
            </SettingRow>
            <SettingRow label="Low-confidence assessment" last>
              <Toggle on={forces.lowConfidence} onChange={(v) => setForces((s) => ({ ...s, lowConfidence: v }))} />
            </SettingRow>
          </SettingsSection>

          <SettingsSection n="04" title="Production safety" sub="how changes roll out and roll back">
            <SettingRow label="Initial canary" desc="Traffic share before advancing.">
              <Slider value={canary} min={5} max={100} step={5} unit="%" onChange={setCanary} />
            </SettingRow>
            <SettingRow label="Auto-rollback">
              <Toggle on={autoRollback} onChange={setAutoRollback} />
            </SettingRow>
            <SettingRow label="Error threshold" desc="New errors that trigger auto-rollback." last>
              <Slider value={errThreshold} min={10} max={200} step={10} unit=" err" onChange={setErrThreshold} />
            </SettingRow>
          </SettingsSection>

          <SettingsSection n="05" title="Autonomy mode" sub="how much the system acts on its own">
            <div style={{ display: "flex", gap: 12, padding: "16px 0" }}>
              {modes.map((mo) => {
                const active = mode === mo.v;
                return (
                  <button key={mo.v} onClick={() => setMode(mo.v)} className="focusable" style={{
                    flex: 1, textAlign: "left", padding: "14px 15px", borderRadius: 9, cursor: "pointer",
                    background: active ? "var(--brand-tint)" : "var(--bg)",
                    border: active ? "1px solid color-mix(in srgb, var(--brand) 50%, transparent)" : "1px solid var(--line-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 9, border: active ? "none" : "1.5px solid var(--fg-faint)", background: active ? "var(--brand)" : "transparent" }} />
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--fg)" }}>{mo.t}</span>
                      {mo.v === "assisted" && <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-muted)", marginLeft: "auto" }}>current</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>{mo.d}</p>
                  </button>
                );
              })}
            </div>
          </SettingsSection>

        </div>
      </div>
    </div>
  );
}

/* ---- My runs ---- */
function MyRuns({ store, onOpen }) {
  const mine = store.runs.filter((r) => r.pr.author === AG.ME);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 22px", height: 52, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <h1 className="display-face" style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>My runs</h1>
        <span className="caption">{AG.ME}</span>
      </div>
      <div className="scroll" style={{ flex: 1, paddingBottom: 40 }}>
        <div style={{ marginTop: 8 }}>
          <GroupHeader glyph={<Icon name="myruns" size={14} style={{ color: "var(--fg-muted)" }} />}
            label="Authored by me" count={mine.length} />
          {mine.length > 0 ? (<><StreamColHeader />
            {mine.map((r) => <RunRow key={r.runId} run={r} onOpen={onOpen} visited={store.visited.has(r.runId)} justUpdated={false} />)}</>)
            : <div style={{ padding: "30px 22px", textAlign: "center" }} className="caption">No runs from your changes right now.</div>}
        </div>
        {/* escalated-to-me: honestly not available */}
        <div style={{ marginTop: 22 }}>
          <GroupHeader glyph={<Icon name="incident" size={14} style={{ color: "var(--fg-faint)" }} />}
            label="Escalated to me" sub="" />
          <div style={{ margin: "0 22px", padding: "18px 20px", borderRadius: 9, background: "var(--bg-raised)", border: "1px dashed var(--line-2)", boxShadow: "var(--lit-edge)" }}>
            <div style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 450 }}>Not available</div>
            <p className="caption" style={{ margin: "5px 0 0", maxWidth: 540, lineHeight: 1.5 }}>
              Autogate escalates to the whole team, not a named person — there's no per-run assignee to filter on.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Settings, MyRuns });
