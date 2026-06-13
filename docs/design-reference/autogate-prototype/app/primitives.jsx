/* ============================================================
   Autogate — shared primitives
   Glyphs (shape-bearing, monochrome-safe), the three-layer spine,
   risk numeral, effort/status pills, avatar, sparkline, icons.
   ============================================================ */
const { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } = React;

/* ---------- Lucide-style line icons (1.5 stroke, round caps) ---------- */
const ICON_PATHS = {
  releases: '<path d="M3 5h18M3 12h18M3 19h12"/>',
  stats: '<path d="M3 3v18h18"/><path d="M7 14l3-4 3 2 4-6"/>',
  myruns: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  settings: '<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/>',
  repo: '<path d="M6 3v12"/><circle cx="6" cy="18" r="3"/><circle cx="6" cy="6" r="0"/><path d="M6 9a9 9 0 0 0 9 9"/><circle cx="18" cy="6" r="3"/><path d="M18 9v0a9 9 0 0 1-9 9"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  incident: '<path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
  x: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  branch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
};
function Icon({ name, size = 18, stroke = 1.5, fill = "none", style, className }) {
  return React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: fill,
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round",
    className, style: { flexShrink: 0, display: "block", ...style },
    dangerouslySetInnerHTML: { __html: ICON_PATHS[name] || "" },
  });
}

/* ---------- verdict tokens ---------- */
const VERDICT = {
  pass: { c: "var(--pass)", edge: "var(--pass-edge)", tint: "var(--pass-tint)", label: "pass" },
  warn: { c: "var(--warn)", edge: "var(--warn-edge)", tint: "var(--warn-tint)", label: "warn" },
  fail: { c: "var(--fail)", edge: "var(--fail-edge)", tint: "var(--fail-tint)", label: "fail" },
  inconclusive: { c: "var(--incon)", edge: "var(--incon-edge)", tint: "var(--incon-tint)", label: "inconclusive" },
  pending: { c: "var(--fg-faint)", edge: "var(--line-2)", tint: "transparent", label: "pending" },
};

/* ---------- VerdictGlyph — distinct SHAPE per verdict, monochrome-safe ---------- */
function VerdictGlyph({ verdict, size = 16 }) {
  const c = (VERDICT[verdict] || VERDICT.pending).c;
  const s = size;
  if (verdict === "pass")
    return (<svg width={s} height={s} viewBox="0 0 16 16" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" fill="none" stroke={c} strokeWidth="1.3" opacity="0.55" />
      <path d="M4.8 8.2l2 2 4.4-4.6" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);
  if (verdict === "warn")
    return (<svg width={s} height={s} viewBox="0 0 16 16" style={{ display: "block", flexShrink: 0 }}>
      <path d="M8 2.2l6 11H2z" fill="none" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6.6v3.1" stroke={c} strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="11.4" r="0.85" fill={c} /></svg>);
  if (verdict === "fail")
    return (<svg width={s} height={s} viewBox="0 0 16 16" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.6" fill={c} fillOpacity="0.92" />
      <path d="M8 4.4v4.2" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" /><circle cx="8" cy="11.3" r="0.95" fill="var(--bg)" /></svg>);
  if (verdict === "inconclusive")
    return (<svg width={s} height={s} viewBox="0 0 16 16" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.6" fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="2.2 2.2" />
      <path d="M6.4 6.6a1.6 1.6 0 1 1 2.4 1.5c-.6.4-.8.7-.8 1.3" fill="none" stroke={c} strokeWidth="1.3" strokeLinecap="round" /><circle cx="8" cy="11.4" r="0.8" fill={c} /></svg>);
  // pending — quiet hollow
  return (<svg width={s} height={s} viewBox="0 0 16 16" style={{ display: "block", flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6.4" fill="none" stroke={c} strokeWidth="1.3" strokeDasharray="1 2.4" /></svg>);
}

/* ---------- layer stance from checks ---------- */
function layerStance(checks, layer) {
  const v = checks.filter((c) => c.layer === layer).map((c) => c.verdict);
  if (!v.length || v.every((x) => x == null)) return "pending";
  if (v.some((x) => x === "fail")) return "fail";
  if (v.some((x) => x === "warn")) return "warn";
  if (v.some((x) => x === "inconclusive")) return "inconclusive";
  if (v.some((x) => x == null)) return "running";
  return "pass";
}
const SPINE_COLOR = {
  static: "var(--spine-static)", ai: "var(--spine-ai)", monitoring: "var(--spine-mon)",
};

/* ---------- Spine — the recurring three-layer signature ----------
   compact: 3 short vertical segments (stream rows)
   each segment tinted by that layer's stance; pass = quiet, concern = lit */
function SpineMini({ run, height = 22 }) {
  const checks = run.checks || [];
  const layers = ["static", "ai", "monitoring"];
  const hasMon = !!run.monitoring;
  return (
    <div title="Static · AI · Monitoring" style={{ display: "flex", gap: 2, alignItems: "stretch", height }}>
      {layers.map((L) => {
        let stance = L === "monitoring"
          ? (hasMon ? (run.monitoring.rolledBack ? "fail" : (run.incident ? "fail" : "pass")) : "future")
          : layerStance(checks, L);
        let col, op;
        if (stance === "fail") { col = "var(--fail)"; op = 1; }
        else if (stance === "warn") { col = "var(--warn)"; op = 1; }
        else if (stance === "inconclusive") { col = "var(--incon)"; op = 1; }
        else if (stance === "pending" || stance === "running") { col = SPINE_COLOR[L]; op = 0.4; }
        else if (stance === "future") { col = "var(--fg-faint)"; op = 0.3; }
        else { col = SPINE_COLOR[L]; op = 0.55; } // pass — quiet
        return <div key={L} style={{ width: 3, borderRadius: 2, background: col, opacity: op,
          ...(stance === "future" ? { background: "repeating-linear-gradient(180deg,var(--fg-faint) 0 2px,transparent 2px 4px)" } : {}) }} />;
      })}
    </div>
  );
}

/* ---------- Risk numeral — the single most prominent figure ---------- */
function riskColor(score) {
  const b = AG.riskBand(score);
  return b === "high" ? "var(--fail)" : b === "mid" ? "var(--warn)" : "var(--fg-2)";
}
function RiskDot({ score, size = 8 }) {
  const b = AG.riskBand(score);
  const c = b === "high" ? "var(--fail)" : b === "mid" ? "var(--warn)" : "var(--incon)";
  return <span title={`risk ${score} (${b})`} style={{ width: size, height: size, borderRadius: size,
    background: c, opacity: b === "low" ? 0.7 : 1, display: "inline-block", flexShrink: 0,
    boxShadow: b === "high" ? "0 0 0 3px var(--fail-tint)" : "none" }} />;
}
function RiskNumeral({ score }) {
  const col = riskColor(score);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1 }}>
      <div className="label" style={{ marginBottom: 6 }}>risk</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="display-face tnum" style={{ fontSize: 52, fontWeight: 500, letterSpacing: "-0.03em", color: col }}>{score}</span>
        <span className="tnum" style={{ fontSize: 17, color: "var(--fg-muted)", fontWeight: 400 }}>/ 100</span>
      </div>
    </div>
  );
}

/* ---------- Effort pill (distinct hue family from verdicts) ---------- */
function EffortPill({ effort }) {
  return <span title="Estimated effort to clear (derived)" style={{
    fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", textTransform: "lowercase",
    color: "var(--effort)", background: "var(--effort-tint)", border: "1px solid color-mix(in srgb, var(--effort) 28%, transparent)",
    padding: "2px 8px", borderRadius: 5, lineHeight: 1.5, whiteSpace: "nowrap",
  }}>{effort}</span>;
}

/* ---------- Status / decision pill ---------- */
const DECISION_STYLE = {
  escalate: { label: "escalated", c: "var(--warn)", tint: "var(--warn-tint)" },
  blocked: { label: "blocked", c: "var(--fail)", tint: "var(--fail-tint)" },
  merged: { label: "merged", c: "var(--pass)", tint: "var(--pass-tint)" },
  auto_merge: { label: "auto-merged", c: "var(--pass)", tint: "var(--pass-tint)" },
  rolled_back: { label: "rolled back", c: "var(--fail)", tint: "var(--fail-tint)" },
  pending: { label: "running", c: "var(--info)", tint: "var(--info-tint)" },
};
function StatusPill({ decision, status, size = "md" }) {
  let key = decision;
  if (status === "running") key = "pending";
  const s = DECISION_STYLE[key] || DECISION_STYLE.pending;
  const pad = size === "lg" ? "4px 11px" : "2px 9px";
  const fz = size === "lg" ? 12.5 : 11.5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: pad, borderRadius: 5,
      fontSize: fz, fontWeight: 500, letterSpacing: "0.02em", color: s.c, background: s.tint,
      border: `1px solid color-mix(in srgb, ${s.c} 30%, transparent)`, whiteSpace: "nowrap" }}>
      {status === "running"
        ? <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: 6, background: s.c }} />
        : <span style={{ width: 6, height: 6, borderRadius: 6, background: s.c }} />}
      {s.label}
    </span>
  );
}

/* ---------- Avatar — warm initials chip ---------- */
const AVATAR_TINTS = ["var(--info)", "var(--effort)", "var(--pass)", "var(--warn)", "var(--incon)"];
function Avatar({ name, size = 22 }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length;
  const c = AVATAR_TINTS[idx];
  return <span title={name} style={{ width: size, height: size, borderRadius: 5, flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.4, fontWeight: 500, color: c,
    background: `color-mix(in srgb, ${c} 16%, transparent)`,
    border: `1px solid color-mix(in srgb, ${c} 26%, transparent)` }}>{initials}</span>;
}

/* ---------- Check tally (4 compact tiles) ---------- */
function TallyTiles({ summary, inconclusive = 0, size = "md" }) {
  const items = [
    { k: "pass", n: summary.pass || 0, ...VERDICT.pass },
    { k: "warn", n: summary.warn || 0, ...VERDICT.warn },
    { k: "fail", n: summary.fail || 0, ...VERDICT.fail },
    { k: "inconclusive", n: inconclusive || 0, ...VERDICT.inconclusive },
  ];
  const big = size === "lg";
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {items.map((it) => {
        const zero = it.n === 0;
        return (
          <div key={it.k} style={{
            display: "flex", flexDirection: big ? "column" : "row", alignItems: big ? "flex-start" : "center",
            gap: big ? 6 : 7, padding: big ? "12px 14px" : "0", minWidth: big ? 86 : "auto",
            borderRadius: 6, opacity: zero ? 0.34 : 1,
            background: big ? "var(--bg-raised)" : "transparent",
            boxShadow: big ? "var(--lit-edge)" : "none",
            border: big ? "1px solid var(--line)" : "none",
          }}>
            <VerdictGlyph verdict={it.k} size={big ? 16 : 14} />
            <div style={{ display: "flex", flexDirection: big ? "row" : "row", alignItems: "baseline", gap: 5 }}>
              <span className="tnum" style={{ fontSize: big ? 22 : 13, fontWeight: 500, color: zero ? "var(--fg-muted)" : it.c, lineHeight: 1 }}>{it.n}</span>
              {big && <span className="label" style={{ color: zero ? "var(--fg-faint)" : "var(--fg-muted)" }}>{it.label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
/* compact stream-row tally: p/w/f counts in mono */
function TallyInline({ summary }) {
  const cells = [
    { n: summary.pass || 0, c: "var(--pass)" },
    { n: summary.warn || 0, c: "var(--warn)" },
    { n: summary.fail || 0, c: "var(--fail)" },
  ];
  return (
    <div className="mono" style={{ display: "flex", gap: 9, fontSize: 12.5, alignItems: "center" }}>
      {cells.map((c, i) => (
        <span key={i} style={{ color: c.n ? c.c : "var(--fg-faint)", display: "inline-flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: 5, background: "currentColor", opacity: c.n ? 0.9 : 0.4 }} />
          {c.n}
        </span>
      ))}
    </div>
  );
}

/* ---------- Sparkline ---------- */
function Sparkline({ data, w = 88, h = 26, color = "var(--info)", fill = true }) {
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 3 - ((v - min) / rng) * (h - 6);
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `M0 ${h} ` + pts.map((p) => "L" + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + ` L${w} ${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {fill && <path d={area} fill={color} fillOpacity="0.1" />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}

Object.assign(window, {
  Icon, VERDICT, VerdictGlyph, layerStance, SPINE_COLOR, SpineMini,
  riskColor, RiskDot, RiskNumeral, EffortPill, DECISION_STYLE, StatusPill,
  Avatar, TallyTiles, TallyInline, Sparkline,
});
