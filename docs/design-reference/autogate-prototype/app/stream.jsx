/* ============================================================
   Autogate — Release Stream (home / primary operational view)
   ============================================================ */
const { useState, useRef, useEffect, useMemo } = React;

/* ---- a single RunSummary row: card-less, hairline-separated, ~42px ---- */
function RunRow({ run, onOpen, visited, justUpdated, showEffort = true }) {
  const eff = AG.effortBand(run);
  const inconCount = run.inconclusive || (run.checks ? run.checks.filter((c) => c.verdict === "inconclusive").length : 0);
  return (
    <div
      className={"run-row focusable" + (justUpdated ? " hl" : "")}
      tabIndex={0} role="button"
      onClick={() => onOpen(run.runId)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(run.runId); } }}
      style={{
        display: "grid",
        gridTemplateColumns: "76px minmax(0,1fr) 96px 78px 30px",
        alignItems: "center", gap: 16, padding: "0 22px", height: 60,
        borderBottom: "1px solid var(--line)", cursor: "pointer",
      }}
    >
      <div>{showEffort ? <EffortPill effort={eff} /> : <span />}</div>
      <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 9 }}>
        <span style={{ fontSize: 13.5, fontWeight: 450, color: visited ? "var(--fg-muted)" : "var(--fg)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{run.pr.title}</span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
          {run.pr.repo} #{run.pr.number}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start" }}>
        <RiskDot score={run.riskScore} />
        <span className="tnum" style={{ fontSize: 13, color: "var(--fg-2)", width: 22 }}>{run.riskScore}</span>
        {inconCount > 0 && <VerdictGlyph verdict="inconclusive" size={13} />}
      </div>
      <TallyInline summary={run.checkSummary} />
      <Avatar name={run.pr.author} />
    </div>
  );
}

/* ---- column header naming the row anatomy ---- */
function StreamColHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "76px minmax(0,1fr) 96px 78px 30px", gap: 16,
      padding: "0 22px", height: 30, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
      <span className="label">effort</span>
      <span className="label">change</span>
      <span className="label">risk</span>
      <span className="label">checks</span>
      <span />
    </div>
  );
}

/* ---- group header ---- */
function GroupHeader({ glyph, label, count, sub, right, onToggle, collapsed }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 22px", height: 46,
      cursor: onToggle ? "pointer" : "default", userSelect: "none" }}>
      {onToggle && <Icon name="chevronRight" size={15} style={{ color: "var(--fg-muted)", transition: "transform 140ms ease",
        transform: collapsed ? "none" : "rotate(90deg)" }} />}
      {glyph}
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.01em" }}>{label}</span>
      {count != null && <span className="tnum" style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{count}</span>}
      {sub && <span className="caption" style={{ marginLeft: 2 }}>{sub}</span>}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}

/* ---- Tier 0 incident bar ---- */
function IncidentBar({ run, onInspect }) {
  if (!run) return null;
  return (
    <div className="settle" style={{ margin: "0 0 0 0", padding: "16px 22px", display: "flex", alignItems: "center", gap: 14,
      background: "linear-gradient(0deg, var(--fail-tint), var(--fail-tint))",
      borderTop: "1px solid color-mix(in srgb, var(--fail) 35%, transparent)",
      borderBottom: "1px solid color-mix(in srgb, var(--fail) 35%, transparent)" }}>
      <span className="pulse-dot" style={{ width: 9, height: 9, borderRadius: 9, background: "var(--fail)", flexShrink: 0,
        boxShadow: "0 0 0 4px var(--fail-tint)" }} />
      <Icon name="incident" size={17} style={{ color: "var(--fail)" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 500 }}>Errors rising in production</span>
        <span style={{ fontSize: 13.5, color: "var(--fg-muted)" }}> — {run.pr.title}</span>
      </div>
      <button className="focusable" onClick={() => onInspect(run.runId)} style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 6,
        background: "transparent", color: "var(--fail)", fontSize: 13, fontWeight: 500,
        border: "1px solid color-mix(in srgb, var(--fail) 50%, transparent)" }}>
        Inspect <Icon name="arrowRight" size={14} />
      </button>
    </div>
  );
}

/* ---- In-production card (degrading = danger / healthy = quiet) ---- */
function ProdCard({ run, onOpen, expanded, onToggle, refCb, highlight, onRollback }) {
  const m = run.monitoring;
  const degrading = run.incident && !m.rolledBack;
  const done = m.rolledBack;
  const accent = degrading ? "var(--fail)" : done ? "var(--fail)" : "var(--pass)";
  return (
    <div ref={refCb} className={highlight ? "hl" : ""} style={{
      margin: "8px 22px", borderRadius: 8, overflow: "hidden",
      background: "var(--bg-raised)", boxShadow: "var(--lit-edge)",
      border: degrading ? "1px solid color-mix(in srgb, var(--fail) 40%, transparent)" : "1px solid var(--line)",
    }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px 16px", cursor: "pointer" }}>
        {degrading
          ? <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: 8, background: "var(--fail)", boxShadow: "0 0 0 4px var(--fail-tint)" }} />
          : <span style={{ width: 8, height: 8, borderRadius: 8, background: accent, opacity: done ? 0.5 : 0.8 }} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span style={{ fontSize: 13.5, fontWeight: 450, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>{run.pr.title}</span>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>{run.pr.repo} #{run.pr.number}</span>
          </div>
          <div className="caption" style={{ marginTop: 3 }}>
            {done ? <span style={{ color: "var(--fail)" }}>rolled back — reverted at {m.canaryPercent}% canary</span>
              : degrading ? <span style={{ color: "var(--fail)" }}>degrading · <span className="tnum">+{m.newErrors}</span> errors · {m.window}</span>
              : <span>healthy · canary <span className="tnum">{m.canaryPercent}%</span> · <span className="tnum">{m.newErrors}</span> new errors · {m.window}</span>}
          </div>
        </div>
        <StatusPill decision={run.decision} status={run.status} />
        <Icon name="chevronRight" size={15} style={{ color: "var(--fg-muted)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 140ms ease" }} />
      </div>
      {expanded && (
        <div className="settle" style={{ padding: "0 16px 16px 37px", borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", gap: 28, padding: "14px 0" }}>
            {[["canary", m.canaryPercent + "%"], ["new errors", degrading ? "+" + m.newErrors : m.newErrors], ["window", m.window], ["merge risk", run.riskScore]].map(([k, v]) => (
              <div key={k}>
                <div className="label" style={{ marginBottom: 4 }}>{k}</div>
                <div className="tnum" style={{ fontSize: 18, fontWeight: 500, color: (k === "new errors" && degrading) ? "var(--fail)" : "var(--fg)" }}>{v}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5, margin: "0 0 12px", maxWidth: 620 }}>{run.decisionInfo.brief}</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="focusable" onClick={() => onOpen(run.runId)} style={btnGhost}>Open run detail</button>
            {degrading && <button className="focusable" onClick={() => onRollback(run.runId)} style={btnDanger}><Icon name="rotate" size={14} /> Review &amp; roll back</button>}
          </div>
        </div>
      )}
    </div>
  );
}

const btnGhost = { display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 6,
  background: "transparent", color: "var(--fg-2)", fontSize: 12.5, fontWeight: 450, border: "1px solid var(--line-2)" };
const btnDanger = { display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 6,
  background: "transparent", color: "var(--fail)", fontSize: 12.5, fontWeight: 500, border: "1px solid color-mix(in srgb, var(--fail) 50%, transparent)" };

/* ---- auto-merged row ---- */
function AutoRow({ run, onOpen, visited }) {
  return (
    <div className="run-row focusable" tabIndex={0} role="button" onClick={() => onOpen(run.runId)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(run.runId); }}
      style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 62px 30px", gap: 16, alignItems: "center",
        padding: "0 22px", height: 55, borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontSize: 13, fontWeight: 450, color: visited ? "var(--fg-muted)" : "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>{run.pr.title}</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)", flexShrink: 0 }}>{run.pr.repo} #{run.pr.number}</span>
        </div>
        <div className="caption" style={{ fontSize: 12, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{run.autoWhy}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <RiskDot score={run.riskScore} size={7} />
        <span className="tnum" style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{run.riskScore}</span>
      </div>
      <Icon name="chevronRight" size={14} style={{ color: "var(--fg-faint)" }} />
    </div>
  );
}

function ReleaseStream({ store, onOpen }) {
  const { runs, visited, updatedSet } = store;
  const [repoFilter, setRepoFilter] = [store.repoFilter, store.setRepoFilter];
  const [statusFilter, setStatusFilter] = useState("all");
  const [autoOpen, setAutoOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [autoLimit, setAutoLimit] = useState(3);
  const [expandedProd, setExpandedProd] = useState({});
  const [highlightProd, setHighlightProd] = useState(null);
  const scrollRef = useRef(null);
  const incidentRef = useRef(null);

  const repoScoped = (r) => !repoFilter || r.pr.repo === repoFilter;

  const incidentRun = runs.find((r) => r.incident && r.monitoring && !r.monitoring.rolledBack && repoScoped(r));
  const needsYou = runs.filter((r) => (r.decision === "escalate" || r.decision === "blocked") && r.status === "completed" && repoScoped(r))
    .sort((a, b) => AG.effortOrder[AG.effortBand(a)] - AG.effortOrder[AG.effortBand(b)]);
  const running = runs.filter((r) => r.status === "running" && repoScoped(r));
  const autoMerged = runs.filter((r) => r.decision === "auto_merge" && repoScoped(r)).sort((a, b) => b.riskScore - a.riskScore);
  const inProd = runs.filter((r) => (r.decision === "merged" || r.decision === "rolled_back") && repoScoped(r))
    .sort((a, b) => (b.incident ? 1 : 0) - (a.incident ? 1 : 0) || (a.monitoring?.rolledBack ? 1 : -1));

  const statusVisible = (group) => statusFilter === "all" || statusFilter === group;

  const inspectIncident = (id) => {
    setProdOpen(true);
    setExpandedProd((s) => ({ ...s, [id]: true }));
    setHighlightProd(id);
    setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-prod="${id}"]`);
      if (el && scrollRef.current) {
        const top = el.offsetTop - scrollRef.current.offsetTop - 80;
        scrollRef.current.scrollTo({ top, behavior: "smooth" });
      }
    }, 40);
    setTimeout(() => setHighlightProd(null), 1400);
  };

  const showNeeds = statusVisible("needs");
  const showRunning = statusVisible("needs") && running.length > 0;
  // filtering to a handled group force-expands it, independent of the manual collapse state on "All"
  const prodExpanded = statusFilter === "prod" ? true : prodOpen;
  const autoExpanded = statusFilter === "auto" ? true : autoOpen;
  const showProd = statusVisible("prod");
  const showAuto = statusVisible("auto");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 22px", height: 52, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <h1 className="display-face" style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Open reviews</h1>
        <div style={{ flex: 1 }} />
        <Segmented value={statusFilter} onChange={setStatusFilter} options={[
          { v: "all", l: "All" }, { v: "needs", l: "Needs you" }, { v: "prod", l: "In production" }, { v: "auto", l: "Auto-merged" }]} />
      </div>

      {/* active filter chip */}
      {repoFilter && (
        <div style={{ padding: "8px 22px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 8px 4px 11px", borderRadius: 6,
            background: "var(--bg-raised)", border: "1px solid var(--line-2)", fontSize: 12, color: "var(--fg-2)" }}>
            <Icon name="repo" size={13} style={{ color: "var(--fg-muted)" }} />
            <span className="mono">{repoFilter}</span>
            <button onClick={() => setRepoFilter(null)} className="focusable" style={{ background: "none", border: "none", color: "var(--fg-muted)", padding: 2, display: "flex" }}><Icon name="x" size={13} /></button>
          </span>
        </div>
      )}

      <div ref={scrollRef} className="scroll" style={{ flex: 1, paddingBottom: 60 }}>
        {/* Tier 0 incident */}
        {incidentRun && <IncidentBar run={incidentRun} onInspect={inspectIncident} />}

        {/* Tier 1 — Needs you */}
        {showNeeds && (
          <div style={{ marginTop: incidentRun ? 0 : 4 }}>
            <GroupHeader
              glyph={<span style={{ width: 7, height: 7, borderRadius: 7, background: "var(--warn)" }} />}
              label="Needs you" count={needsYou.length}
              sub="quick → deep" />
            {needsYou.length === 0 ? (
              <EmptyNeedsYou filtered={!!repoFilter} />
            ) : (
              <>
                <StreamColHeader />
                {needsYou.map((r) => (
                  <RunRow key={r.runId} run={r} onOpen={onOpen} visited={visited.has(r.runId)} justUpdated={updatedSet.has(r.runId)} />
                ))}
              </>
            )}
          </div>
        )}

        {/* Running (system state, not a decision) */}
        {showRunning && (
          <div style={{ marginTop: 14 }}>
            <GroupHeader
              glyph={<span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: 7, background: "var(--info)" }} />}
              label="Running" count={running.length} />
            <StreamColHeader />
            {running.map((r) => (
              <RunRow key={r.runId} run={r} onOpen={onOpen} visited={visited.has(r.runId)} justUpdated={updatedSet.has(r.runId)} />
            ))}
          </div>
        )}

        {/* Tier 2 — Handled by the system */}
        {(showProd || showAuto) && (
          <div style={{ marginTop: 22, padding: "0 22px 8px" }}>
            <span className="label" style={{ color: "var(--fg-faint)" }}>Handled by the system</span>
          </div>
        )}

        {showProd && (
          <div>
            <GroupHeader onToggle={() => setProdOpen((o) => !o)} collapsed={!prodExpanded}
              glyph={<Icon name="activity" size={15} style={{ color: "var(--fg-muted)" }} />}
              label="In production" count={inProd.length} />
            {prodExpanded && inProd.map((r) => (
              <div key={r.runId} data-prod={r.runId}>
                <ProdCard run={r} onOpen={onOpen}
                  expanded={!!expandedProd[r.runId] || r.incident}
                  onToggle={() => setExpandedProd((s) => ({ ...s, [r.runId]: !(s[r.runId] || r.incident) }))}
                  highlight={highlightProd === r.runId}
                  onRollback={(id) => onOpen(id, { rollback: true })} />
              </div>
            ))}
          </div>
        )}

        {showAuto && (
          <div style={{ marginTop: 8 }}>
            <GroupHeader onToggle={() => setAutoOpen((o) => !o)} collapsed={!autoExpanded}
              glyph={<VerdictGlyph verdict="pass" size={14} />}
              label="Auto-merged" count={autoMerged.length} sub="riskiest first" />
            {autoExpanded && (
              <>
                {autoMerged.slice(0, autoLimit).map((r) => (
                  <AutoRow key={r.runId} run={r} onOpen={onOpen} visited={visited.has(r.runId)} />
                ))}
                {autoLimit < autoMerged.length ? (
                  <button onClick={() => setAutoLimit(autoMerged.length)} className="focusable" style={{
                    display: "block", width: "100%", textAlign: "center", padding: "11px", background: "none",
                    border: "none", borderBottom: "1px solid var(--line)", color: "var(--fg-muted)", fontSize: 12.5 }}>
                    Load {autoMerged.length - autoLimit} more
                  </button>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px", color: "var(--fg-faint)", fontSize: 11.5 }}>— end of auto-merged —</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- empty 'Needs you' = success ---- */
function EmptyNeedsYou({ filtered }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "54px 22px", gap: 12, textAlign: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--pass-tint)", border: "1px solid color-mix(in srgb, var(--pass) 30%, transparent)", boxShadow: "var(--lit-edge)" }}>
        <VerdictGlyph verdict="pass" size={22} />
      </div>
      <div style={{ fontSize: 15, color: "var(--fg)", fontWeight: 450 }}>Nothing needs you right now</div>
      <div className="caption" style={{ maxWidth: 360, lineHeight: 1.5 }}>
        {filtered ? "No runs in this repo are waiting on a human." : "The system is handling everything in flight."}
      </div>
    </div>
  );
}

/* ---- segmented control ---- */
function Segmented({ value, onChange, options }) {
  return (
    <div style={{ display: "inline-flex", padding: 2, gap: 2, borderRadius: 7, background: "var(--bg-rail)", border: "1px solid var(--line)" }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className="focusable" style={{
          padding: "4px 11px", borderRadius: 5, border: "none", fontSize: 12, fontWeight: 450,
          background: value === o.v ? "var(--bg-raised-2)" : "transparent",
          color: value === o.v ? "var(--fg)" : "var(--fg-muted)",
          boxShadow: value === o.v ? "var(--lit-edge)" : "none" }}>{o.l}</button>
      ))}
    </div>
  );
}

Object.assign(window, { ReleaseStream, Segmented, RunRow, GroupHeader, StreamColHeader, btnGhost, btnDanger });
