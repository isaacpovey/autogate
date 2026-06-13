/* ============================================================
   Autogate — app shell: rail, topbar, routing, live (SSE) sim
   ============================================================ */
const { useState, useRef, useEffect } = React;

/* ---- the spine logomark: three layers = product identity ---- */
function Logomark({ size = 20 }) {
  const inner = '<path d="M25 0.999999C25 0.447714 25.4477 0 26 0H27C27.5523 0 28 0.447715 28 1V43C28 43.5523 27.5523 44 27 44H26C25.4477 44 25 43.5523 25 43V0.999999Z" fill="currentColor"></path><path d="M20 1C20 0.447715 20.4477 0 21 0H22C22.5523 0 23 0.447715 23 1V14C23 14.5523 22.5523 15 22 15H21C20.4477 15 20 14.5523 20 14V1Z" fill="currentColor"></path><path d="M15 1C15 0.447715 15.4477 0 16 0H17C17.5523 0 18 0.447715 18 1V14C18 14.5523 17.5523 15 17 15H16C15.4477 15 15 14.5523 15 14V1Z" fill="currentColor"></path><path d="M15 28C15 27.4477 15.4477 27 16 27H17C17.5523 27 18 27.4477 18 28V35C18 35.5523 17.5523 36 17 36H16C15.4477 36 15 35.5523 15 35V28Z" fill="currentColor"></path><path d="M20 28C20 27.4477 20.4477 27 21 27H22C22.5523 27 23 27.4477 23 28V35C23 35.5523 22.5523 36 22 36H21C20.4477 36 20 35.5523 20 35V28Z" fill="currentColor"></path><path d="M10 0.999999C10 0.447714 10.4477 0 11 0H12C12.5523 0 13 0.447715 13 1V43C13 43.5523 12.5523 44 12 44H11C10.4477 44 10 43.5523 10 43V0.999999Z" fill="currentColor"></path><rect x="30" y="16" width="3" height="28" rx="1" fill="currentColor"></rect><rect x="5" y="16" width="3" height="28" rx="1" fill="currentColor"></rect><rect x="35" y="31" width="3" height="13" rx="1" fill="currentColor"></rect><rect y="31" width="3" height="13" rx="1" fill="currentColor"></rect>';
  return (
    <svg width={(size * 38) / 44} height={size} viewBox="0 0 38 44" fill="none"
      style={{ display: "block", color: "var(--fg)", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: inner }} />
  );
}

function RailItem({ icon, label, active, collapsed, onClick, accent, badge }) {
  return (
    <button onClick={onClick} className="focusable" title={collapsed ? label : undefined} style={{
      display: "flex", alignItems: "center", gap: 11, width: "100%",
      padding: collapsed ? "0" : "0 12px", height: 36, justifyContent: collapsed ? "center" : "flex-start",
      borderRadius: 7, border: "none", background: active ? "var(--bg-active)" : "transparent",
      color: active ? "var(--fg)" : "var(--fg-2)", fontSize: 13, fontWeight: active ? 500 : 400, position: "relative" }}>
      {active && <span style={{ position: "absolute", left: collapsed ? 6 : 0, top: "50%", transform: "translateY(-50%)", width: 2.5, height: 17, borderRadius: 2, background: "var(--brand)" }} />}
      <span style={{ display: "flex", color: active ? "var(--fg)" : "var(--fg-muted)" }}>{icon}</span>
      {!collapsed && <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>{label}</span>}
      {!collapsed && badge != null && badge > 0 && <span className="tnum" style={{ fontSize: 11, color: "var(--warn)", background: "var(--warn-tint)", borderRadius: 5, padding: "0 6px", minWidth: 18, textAlign: "center" }}>{badge}</span>}
    </button>
  );
}

function Rail({ view, setView, collapsed, setCollapsed, repos, repoFilter, setRepoFilter, needsCount, theme, setTheme }) {
  return (
    <div style={{ width: collapsed ? 56 : 220, flexShrink: 0, background: "var(--bg-rail)", borderRight: "1px solid var(--line)",
      display: "flex", flexDirection: "column", transition: "width 180ms cubic-bezier(.22,.61,.36,1)" }}>
      {/* brand */}
      <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: collapsed ? 0 : "0 16px", justifyContent: collapsed ? "center" : "flex-start", borderBottom: "1px solid var(--line)" }}>
        {collapsed
          ? <Logomark size={20} />
          : <LockupMark height={20} />}
      </div>

      <div style={{ flex: 1, padding: collapsed ? "10px 8px" : "10px 12px", display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
        <RailItem icon={<Icon name="releases" size={17} />} label="Open reviews" active={view === "releases"} collapsed={collapsed} onClick={() => setView("releases")} badge={needsCount} />
        <RailItem icon={<Icon name="stats" size={17} />} label="Stats" active={view === "stats"} collapsed={collapsed} onClick={() => setView("stats")} />
        <RailItem icon={<Icon name="myruns" size={17} />} label="My runs" active={view === "myruns"} collapsed={collapsed} onClick={() => setView("myruns")} />
        <RailItem icon={<Icon name="settings" size={17} />} label="Settings" active={view === "settings"} collapsed={collapsed} onClick={() => setView("settings")} />

        {!collapsed && <div className="label" style={{ margin: "18px 12px 6px", color: "var(--fg-faint)" }}>Repositories</div>}
        {collapsed && <div style={{ height: 1, background: "var(--line)", margin: "12px 6px" }} />}
        {repos.map((r) => {
          const active = repoFilter === r.name && view === "releases";
          return (
            <button key={r.name} className="focusable" title={collapsed ? r.name : undefined}
              onClick={() => { setView("releases"); setRepoFilter(active ? null : r.name); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", height: 32, padding: collapsed ? 0 : "0 12px",
                justifyContent: collapsed ? "center" : "flex-start", borderRadius: 7, border: "none",
                background: active ? "var(--bg-active)" : "transparent", color: active ? "var(--fg)" : "var(--fg-muted)", fontSize: 12.5 }}>
              <Icon name="repo" size={15} style={{ color: active ? "var(--fg-2)" : "var(--fg-faint)" }} />
              {!collapsed && <span className="mono" style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", fontSize: 12 }}>{r.name.replace("askable/", "")}</span>}
              {!collapsed && r.needs > 0 && <span className="tnum" style={{ fontSize: 10.5, color: "var(--fg-muted)" }}>{r.needs}</span>}
            </button>
          );
        })}
      </div>

      {/* footer: theme + collapse */}
      <div style={{ padding: collapsed ? "10px 8px" : "10px 12px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 2 }}>
        <RailItem icon={<Icon name={theme === "dark" ? "sun" : "moon"} size={16} />} label={theme === "dark" ? "Light mode" : "Dark mode"} collapsed={collapsed} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
        <RailItem icon={<Icon name="panel" size={16} />} label="Collapse" collapsed={collapsed} onClick={() => setCollapsed((c) => !c)} />
      </div>
    </div>
  );
}

/* ---- topbar: page-agnostic operational state ---- */
function Topbar({ incident, agreement, connected, onIncident, onNew }) {
  return (
    <div style={{ height: 46, flexShrink: 0, borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14, padding: "0 18px", background: "var(--bg)" }}>
      {incident ? (
        <button onClick={onIncident} className="focusable" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 11px", borderRadius: 6,
          background: "var(--fail-tint)", border: "1px solid var(--fail-edge)", color: "var(--fail)", fontSize: 12.5, fontWeight: 500 }}>
          <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: 7, background: "var(--fail)" }} />1 incident
        </button>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-muted)" }}>
          <span style={{ width: 7, height: 7, borderRadius: 7, background: "var(--pass)", opacity: 0.7 }} />all systems nominal
        </span>
      )}
      <span style={{ width: 1, height: 16, background: "var(--line-2)" }} />
      <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>agreement <span className="tnum" style={{ color: "var(--fg-2)", fontWeight: 500 }}>{agreement}%</span></span>

      <div style={{ flex: 1 }} />

      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: connected ? "var(--fg-faint)" : "var(--warn)" }}>
        <span className={connected ? "" : "pulse-dot"} style={{ width: 6, height: 6, borderRadius: 6, background: connected ? "var(--pass)" : "var(--warn)", opacity: connected ? 0.6 : 1 }} />
        {connected ? "live" : "reconnecting…"}
      </span>
      <button onClick={onNew} className="focusable" title="New runs are created by CI on push" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, background: "var(--brand)", border: "none", color: "var(--fg-on-red, #fff)" }}>
        <Icon name="plus" size={16} style={{ color: "#fff" }} />
      </button>
    </div>
  );
}

/* ---- toast ---- */
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, []);
  return (
    <div className="popin" style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 200,
      background: "var(--bg-raised-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "10px 16px",
      boxShadow: "var(--shadow-pop)", fontSize: 13, color: "var(--fg)" }}>{msg}</div>
  );
}

/* ============================================================ */
function App() {
  const clone = () => JSON.parse(JSON.stringify(AG.RUNS));
  const [runs, setRuns] = useState(clone);
  const [view, setView] = useState(() => localStorage.getItem("ag-view") || "releases");
  const [selected, setSelected] = useState(() => localStorage.getItem("ag-run") || null);
  const [repoFilter, setRepoFilter] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [visited, setVisited] = useState(() => new Set());
  const [updatedSet, setUpdatedSet] = useState(() => new Set());
  const [theme, setThemeState] = useState(() => localStorage.getItem("ag-theme") || "dark");
  const [connected, setConnected] = useState(true);
  const [autoRollback, setAutoRollback] = useState(false);
  const [toast, setToast] = useState(null);

  // theme
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("ag-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("ag-view", view); }, [view]);
  useEffect(() => { if (selected) localStorage.setItem("ag-run", selected); else localStorage.removeItem("ag-run"); }, [selected]);

  const incidentRun = runs.find((r) => r.incident && r.monitoring && !r.monitoring.rolledBack);
  const needsCount = runs.filter((r) => (r.decision === "escalate" || r.decision === "blocked") && r.status === "completed").length;

  const markUpdated = (id) => {
    setUpdatedSet((s) => new Set(s).add(id));
    setTimeout(() => setUpdatedSet((s) => { const n = new Set(s); n.delete(id); return n; }), 1100);
  };

  const openRun = (id, opts = {}) => {
    setSelected(id);
    setView("releases");
    setVisited((s) => new Set(s).add(id));
    setAutoRollback(!!opts.rollback);
    if (opts.rollback || incidentRun?.runId === id) setAutoRollback(true); else if (!opts.rollback) setAutoRollback(false);
  };
  const back = () => { setSelected(null); setAutoRollback(false); };

  // consequential actions mutate the run
  const act = (runId, { action, reason }) => {
    if (action === "rollback") {
      setRuns((rs) => rs.map((r) => r.runId === runId ? { ...r, _rollbackInProgress: true } : r));
      setTimeout(() => {
        setRuns((rs) => rs.map((r) => {
          if (r.runId !== runId) return r;
          return { ...r, _rollbackInProgress: false, decision: "rolled_back", incident: false,
            monitoring: { ...(r.monitoring || { canaryPercent: 25, newErrors: 0 }), rolledBack: true, window: "rolled back" },
            _lastAction: { actor: AG.ME, at: "just now", reason },
            timeline: [...r.timeline, { at: "just now", event: `rolled back by ${AG.ME} — reason recorded`, emphasis: "override" }] };
        }));
        setToast("Rolled back from production · reverted for all users");
        markUpdated(runId);
      }, 1700);
      return;
    }
    setRuns((rs) => rs.map((r) => {
      if (r.runId !== runId) return r;
      if (action === "approve_merge") {
        return { ...r, decision: "merged", _lastAction: { actor: AG.ME, at: "just now", reason },
          monitoring: r.monitoring || { canaryPercent: 25, newErrors: 0, window: "just now", rolledBack: false },
          timeline: [...r.timeline, { at: "just now", event: `approved & merged by ${AG.ME} — reason recorded`, emphasis: "override" }, { at: "just now", event: "merged to main — canary rollout started at 25%" }] };
      }
      if (action === "block") {
        return { ...r, decision: "blocked", _lastAction: { actor: AG.ME, at: "just now", reason },
          timeline: [...r.timeline, { at: "just now", event: `blocked by ${AG.ME} — reason recorded · author notified`, emphasis: "override" }] };
      }
      return r;
    }));
    setToast(action === "approve_merge" ? "Approved & merged · canary at 25%" : "Change blocked · author notified");
    markUpdated(runId);
  };

  // ---- live SSE simulation: the running run resolves its checks ----
  useEffect(() => {
    const iv = setInterval(() => {
      let landedId = null;
      setRuns((rs) => {
        const i = rs.findIndex((r) => r.status === "running" && r._resolveOrder && r._resolveOrder.length);
        if (i < 0) return rs;
        const run = rs[i];
        const next = run._resolveOrder[0];
        const checks = run.checks.map((c, ci) => ci === next.i ? { ...c, verdict: next.verdict, durationMs: next.durationMs, finding: next.finding, detail: next.detail } : c);
        const rest = run._resolveOrder.slice(1);
        const cs = { pass: 0, warn: 0, fail: 0, pending: 0 };
        checks.forEach((c) => { if (c.verdict) { if (cs[c.verdict] != null) cs[c.verdict]++; } else cs.pending++; });
        const verb = next.verdict === "warn" ? "warned" : next.verdict === "pass" ? "passed" : next.verdict;
        let upd = { ...run, checks, _resolveOrder: rest, checkSummary: cs, _lastLanded: next.i,
          timeline: [...run.timeline, { at: "just now", event: `${checks[next.i].kind} ${verb}` }] };
        if (rest.length === 0) {
          upd.status = "completed";
          upd.decision = "escalate";
          upd._resolveOrder = null;
          upd.decisionInfo = { outcome: "escalate", riskScore: run.riskScore,
            brief: "Static is clean and the semantic review passed, but the performance agent warns that a 15-minute cache TTL means a revoked permission could linger up to 15 minutes before the cache clears. Low risk and isolated — a quick call on whether that staleness window is acceptable for permission reads.",
            reasons: ["performance review warns — a revoked permission may persist up to the 15-min cache TTL", "no other layer raised a concern; risk is low and the change is isolated"] };
          upd.timeline = [...upd.timeline, { at: "just now", event: "orchestrator escalated to human — unresolved warning", emphasis: "decision" }];
        }
        landedId = run.runId;
        const copy = rs.slice(); copy[i] = upd; return copy;
      });
      if (landedId) markUpdated(landedId);
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  // one-time reconnect blip to show the disconnected state
  useEffect(() => {
    const t1 = setTimeout(() => setConnected(false), 7000);
    const t2 = setTimeout(() => setConnected(true), 9200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const store = { runs, visited, updatedSet, repoFilter, setRepoFilter };

  const detailRun = selected ? runs.find((r) => r.runId === selected) : null;

  let main;
  if (detailRun) main = <RunDetail run={detailRun} onBack={back} onAct={act} autoRollback={autoRollback} />;
  else if (view === "releases") main = <ReleaseStream store={store} onOpen={openRun} />;
  else if (view === "stats") main = <TrustView onOpen={openRun} />;
  else if (view === "myruns") main = <MyRuns store={store} onOpen={openRun} />;
  else if (view === "settings") main = <Settings />;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Rail view={view} setView={(v) => { setView(v); setSelected(null); }} collapsed={collapsed} setCollapsed={setCollapsed}
        repos={AG.repos} repoFilter={repoFilter} setRepoFilter={setRepoFilter} needsCount={needsCount} theme={theme} setTheme={setThemeState} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
        <Topbar incident={incidentRun} agreement={AG.metrics.summary.agreementNow} connected={connected}
          onIncident={() => incidentRun && openRun(incidentRun.runId, { rollback: true })} onNew={() => setToast("Runs are created automatically by CI when code is pushed.")} />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{main}</div>
      </div>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
