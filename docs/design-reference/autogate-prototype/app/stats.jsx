/* ============================================================
   Autogate — Trust View ("Stats"): calibration instrument
   ============================================================ */
const { useState, useRef } = React;

function StatTile({ label, value, unit, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "16px 18px", borderRadius: 9, background: "var(--bg-raised)",
      border: "1px solid var(--line)", boxShadow: "var(--lit-edge)" }}>
      <div className="label" style={{ marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="display-face tnum" style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--fg)" }}>{value}</span>
        {unit && <span className="tnum" style={{ fontSize: 15, color: "var(--fg-muted)" }}>{unit}</span>}
      </div>
      {sub && <div className="caption" style={{ marginTop: 7 }}>{sub}</div>}
    </div>
  );
}

/* ---- judgment-quality callout ---- */
function QualityCallout({ title, value, spark, sparkColor, explain, watch }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "18px 20px", borderRadius: 9, background: "var(--bg-raised)",
      border: watch ? "1px solid color-mix(in srgb, var(--warn) 30%, transparent)" : "1px solid var(--line)", boxShadow: "var(--lit-edge)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <span className="label" style={{ color: watch ? "var(--warn)" : "var(--fg-2)" }}>{title}</span>
        {watch && <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--warn)", background: "var(--warn-tint)", padding: "1px 7px", borderRadius: 4, border: "1px solid var(--warn-edge)" }}>watch most</span>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, marginBottom: 12 }}>
        <span className="display-face tnum" style={{ fontSize: 38, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--fg)" }}>{value}</span>
        <Sparkline data={spark} color={sparkColor} w={120} h={34} />
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-muted)", maxWidth: 360 }}>{explain}</p>
    </div>
  );
}

/* ---- line chart with hover (agreement rate) ---- */
function AgreementChart({ data }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const W = 760, H = 236, padL = 42, padR = 16, padT = 16, padB = 42;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const min = 60, max = 95;
  const x = (i) => padL + (i / (data.length - 1)) * innerW;
  const y = (v) => padT + innerH - ((v - min) / (max - min)) * innerH;
  const pts = data.map((d, i) => [x(i), y(d.rate)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `M${padL} ${padT + innerH} ` + pts.map((p) => "L" + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + ` L${padL + innerW} ${padT + innerH} Z`;
  const grid = [60, 70, 80, 90];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let idx = Math.round(((px - padL) / innerW) * (data.length - 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));
    setHover(idx);
  };
  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {/* y gridlines + value labels */}
        {grid.map((g) => (
          <g key={g}>
            <line x1={padL} y1={y(g)} x2={padL + innerW} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 10} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill="var(--fg-muted)" className="tnum">{g}</text>
          </g>
        ))}
        {/* vertical gridlines + x week ticks */}
        {data.map((d, i) => (
          <g key={"x" + i}>
            <line x1={x(i)} y1={padT} x2={x(i)} y2={padT + innerH} stroke="var(--line)" strokeWidth="1" opacity={hover === i ? 0 : 0.4} />
            <text x={x(i)} y={padT + innerH + 17} textAnchor="middle" fontSize="9.5" fill="var(--fg-faint)" className="tnum">{i + 1}</text>
          </g>
        ))}
        {/* axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
        <text x={padL - 10} y={padT - 5} textAnchor="end" fontSize="8.5" fill="var(--fg-faint)" style={{ letterSpacing: "0.08em" }}>%</text>
        <text x={padL + innerW} y={H - 5} textAnchor="end" fontSize="8.5" fill="var(--fg-faint)" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>week →</text>
        <path d={area} fill="var(--info)" fillOpacity="0.09" />
        <path d={line} fill="none" stroke="var(--info)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 3.6 : 2} fill="var(--info)" opacity={hover == null || hover === i ? 1 : 0.5} />)}
        {hover != null && (
          <g>
            <line x1={pts[hover][0]} y1={padT} x2={pts[hover][0]} y2={padT + innerH} stroke="var(--info)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="4.5" fill="var(--info)" stroke="var(--bg)" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div style={{ position: "absolute", top: 6, pointerEvents: "none",
          left: `clamp(8px, ${(pts[hover][0] / W) * 100}% - 60px, calc(100% - 128px))`,
          background: "var(--bg-raised-2)", border: "1px solid var(--line-2)", borderRadius: 7, padding: "8px 11px",
          boxShadow: "var(--shadow-pop)", whiteSpace: "nowrap" }}>
          <div className="tnum" style={{ fontSize: 15, fontWeight: 500, color: "var(--info)" }}>{data[hover].rate}% agreement</div>
          <div className="caption mono" style={{ marginTop: 2 }}>week {hover + 1} of {data.length}</div>
        </div>
      )}
    </div>
  );
}

/* ---- stacked bar chart with hover (where changes go) ---- */
function OutcomesChart({ data }) {
  const [hover, setHover] = useState(null);
  const W = 760, H = 236, padL = 34, padR = 14, padT = 14, padB = 38;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const rawMax = Math.max(...data.map((d) => d.auto + d.escalated + d.rolled));
  const max = Math.ceil(rawMax / 40) * 40;
  const yticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  const bw = (innerW / data.length) * 0.62;
  const gap = (innerW / data.length);
  const yScale = (v) => (v / max) * innerH;
  const series = [
    { k: "auto", c: "var(--incon)", op: 0.55, label: "auto-merged" },
    { k: "escalated", c: "var(--warn)", op: 0.9, label: "escalated" },
    { k: "rolled", c: "var(--fail)", op: 1, label: "rolled back" },
  ];
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
        {series.map((s) => (
          <span key={s.k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2.5, background: s.c, opacity: s.op }} />{s.label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} onMouseLeave={() => setHover(null)}>
        {/* y gridlines + count labels */}
        {yticks.map((t) => {
          const gy = padT + innerH - (t / max) * innerH;
          return (
            <g key={"y" + t}>
              <line x1={padL} y1={gy} x2={padL + innerW} y2={gy} stroke="var(--line)" strokeWidth="1" />
              <text x={padL - 9} y={gy + 3.5} textAnchor="end" fontSize="9.5" fill="var(--fg-muted)" className="tnum">{t}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = padL + i * gap + (gap - bw) / 2;
          let yTop = padT + innerH;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={cx - (gap - bw) / 2} y={padT} width={gap} height={innerH} fill={hover === i ? "var(--bg-hover)" : "transparent"} />
              {series.map((s) => {
                const h = yScale(d[s.k]);
                yTop -= h;
                return <rect key={s.k} x={cx} y={yTop} width={bw} height={Math.max(h - 1, 0)} rx="1.5" fill={s.c} fillOpacity={s.op * (hover == null || hover === i ? 1 : 0.55)} />;
              })}
            </g>
          );
        })}
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
        {data.map((d, i) => (
          <text key={"x" + i} x={padL + i * gap + gap / 2} y={padT + innerH + 16} textAnchor="middle" fontSize="9.5" fill="var(--fg-faint)" className="tnum">{i + 1}</text>
        ))}
        <text x={padL - 9} y={padT - 4} textAnchor="end" fontSize="8.5" fill="var(--fg-faint)">runs</text>
        <text x={padL + innerW} y={H - 4} textAnchor="end" fontSize="8.5" fill="var(--fg-faint)" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>week →</text>
      </svg>
      {hover != null && (
        <div style={{ position: "absolute", top: 30, pointerEvents: "none",
          left: `clamp(8px, ${((padL + hover * gap + gap / 2) / W) * 100}% - 70px, calc(100% - 150px))`,
          background: "var(--bg-raised-2)", border: "1px solid var(--line-2)", borderRadius: 7, padding: "9px 12px",
          boxShadow: "var(--shadow-pop)", whiteSpace: "nowrap", minWidth: 130 }}>
          <div className="caption mono" style={{ marginBottom: 6 }}>week {hover + 1}</div>
          {series.map((s) => (
            <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, marginTop: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c, opacity: s.op }} />
              <span style={{ color: "var(--fg-muted)", flex: 1 }}>{s.label}</span>
              <span className="tnum" style={{ color: "var(--fg)", fontWeight: 500 }}>{data[hover][s.k]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- overrides bar chart with axes ---- */
function OverridesChart({ data }) {
  const [hover, setHover] = useState(null);
  const W = 760, H = 210, padL = 30, padR = 14, padT = 20, padB = 32;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const rawMax = Math.max(...data.map((d) => d.count));
  const max = Math.max(4, Math.ceil(rawMax / 4) * 4);
  const yticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  const gap = innerW / data.length;
  const bw = 14;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} onMouseLeave={() => setHover(null)}>
        {/* y gridlines + labels */}
        {yticks.map((t) => {
          const gy = padT + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={padL} y1={gy} x2={padL + innerW} y2={gy} stroke="var(--line)" strokeWidth="1" />
              <text x={padL - 9} y={gy + 3.5} textAnchor="end" fontSize="9.5" fill="var(--fg-muted)" className="tnum">{t}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const setback = i === 7;
          const cx = padL + i * gap + gap / 2;
          const h = (d.count / max) * innerH;
          const c = setback ? "var(--warn)" : "var(--effort)";
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={padL + i * gap} y={padT} width={gap} height={innerH} fill={hover === i ? "var(--bg-hover)" : "transparent"} />
              <text x={cx} y={padT + innerH - h - 7} textAnchor="middle" fontSize="11" fontWeight="500"
                fill={setback ? "var(--warn)" : "var(--fg-muted)"} className="tnum">{d.count}</text>
              <rect x={cx - bw / 2} y={padT + innerH - h} width={bw} height={Math.max(h, 1)} rx="3"
                fill={c} fillOpacity={setback ? 0.9 : (hover === i ? 0.65 : 0.45)} />
            </g>
          );
        })}
        {/* axes */}
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
        {data.map((d, i) => (
          <text key={"x" + i} x={padL + i * gap + gap / 2} y={padT + innerH + 16} textAnchor="middle" fontSize="9.5" fill="var(--fg-faint)" className="tnum">{i + 1}</text>
        ))}
        <text x={padL - 9} y={padT - 6} textAnchor="end" fontSize="8.5" fill="var(--fg-faint)">count</text>
        <text x={padL + innerW} y={H - 4} textAnchor="end" fontSize="8.5" fill="var(--fg-faint)" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>week →</text>
      </svg>
    </div>
  );
}

function Panel({ title, sub, children, right }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <h2 className="display-face" style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em", margin: 0, color: "var(--fg)" }}>{title}</h2>
        {sub && <span className="caption">{sub}</span>}
        <div style={{ flex: 1 }} />
        {right}
      </div>
      <div style={{ padding: "20px 22px", borderRadius: 10, background: "var(--bg-raised)", border: "1px solid var(--line)", boxShadow: "var(--lit-edge)" }}>{children}</div>
    </div>
  );
}

function TrustView({ onOpen }) {
  const m = AG.metrics;
  const s = m.summary;
  const agree = m.agreementRate.map((d) => d.rate);
  const missSpark = m.outcomes.map((o) => +(o.rolled / (o.auto + o.escalated + o.rolled) * 100).toFixed(2));
  const precSpark = [76, 78, 77, 80, 79, 81, 83, 74, 79, 82, 83, 82];
  const overrides = m.overridesPerWeek.map((o) => o.count);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 22px", height: 52, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <h1 className="display-face" style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Trust</h1>
        <span className="caption">is the system's judgment good enough to trust with more autonomy?</span>
      </div>
      <div className="scroll" style={{ flex: 1 }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 40px 80px" }}>

          {/* summary strip */}
          <div style={{ display: "flex", gap: 14, marginBottom: 30 }}>
            <StatTile label="agreement rate" value={s.agreementNow} unit="%" sub={`↑ ${s.agreementSinceLaunch} pts since launch`} />
            <StatTile label="changes shipped / 30d" value={s.shipped30d.toLocaleString("en-US")} sub={`${s.shippedDailyAvg} per day on average`} />
            <StatTile label="median time-to-merge" value={s.medianTtmMin} unit="min" sub={`down from ${s.ttmBeforeMin} min before Autogate`} />
          </div>

          {/* judgment quality */}
          <h2 className="display-face" style={{ fontSize: 16, fontWeight: 500, margin: "0 0 14px" }}>Is the system's judgment good?</h2>
          <div style={{ display: "flex", gap: 14, marginBottom: 30 }}>
            <QualityCallout title="escalation precision" value={Math.round(m.escalation.precision * 100) + "%"} spark={precSpark} sparkColor="var(--info)"
              explain="Of the changes it escalated, the share a human agreed needed review. High means few false alarms." />
            <QualityCallout title="auto-merge miss rate" value={(s.autoMergeMissRate * 100).toFixed(1) + "%"} spark={missSpark} sparkColor="var(--fail)" watch
              explain="Of the changes it auto-merged, the share later rolled back — the cost of false confidence." />
          </div>

          {/* agreement over time */}
          <Panel title="Agreement rate over time" sub="human vs system">
            <AgreementChart data={m.agreementRate} />
            <p className="caption" style={{ margin: "14px 0 0", maxWidth: 640 }}>
              Week 8 dips — a cluster of rollbacks pushed human and system out of step before recovery. An honest curve has setbacks.</p>
          </Panel>

          {/* where changes go */}
          <Panel title="Where changes go" sub="per week">
            <OutcomesChart data={m.outcomes} />
          </Panel>

          {/* overrides trend (secondary) */}
          <Panel title="Human overrides per week" sub="ideally declining">
            <OverridesChart data={m.overridesPerWeek} />
          </Panel>

          {/* recent rollbacks */}
          <Panel title="Recent rollbacks">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {m.recentRollbacks ? null : null}
              {AG.metrics.recentRollbacks.map((r, i) => (
                <div key={i} onClick={() => r.runId && onOpen(r.runId)} className={r.runId ? "focusable" : ""} tabIndex={r.runId ? 0 : undefined}
                  style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "16px 0", borderBottom: i < AG.metrics.recentRollbacks.length - 1 ? "1px solid var(--line)" : "none", cursor: r.runId ? "pointer" : "default" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 7, background: "var(--fail)", marginTop: 5, flexShrink: 0, opacity: 0.85 }} />
                  <span className="mono caption" style={{ width: 86, flexShrink: 0, color: "var(--fg-muted)" }}>{r.date}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                      <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 450 }}>{r.change}</span>
                      <span className="mono caption">{r.repo}</span>
                      {r.runId && <Icon name="arrowRight" size={12} style={{ color: "var(--fg-faint)" }} />}
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>{r.cause}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TrustView });
