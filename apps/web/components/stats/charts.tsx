"use client";

import { useState } from "react";
import { agreementPct } from "@/lib/view-model";

/* ---- agreement rate over time (rate is 0–1) ---- */
export function AgreementChart({ data }: { data: { date: string; rate: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <div className="caption">Not enough data points yet.</div>;

  const W = 760, H = 236, padL = 44, padR = 16, padT = 16, padB = 42;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const rates = data.map((d) => d.rate);
  const lo = Math.max(0, Math.floor((Math.min(...rates) - 0.05) * 10) / 10);
  const hi = Math.min(1, Math.ceil((Math.max(...rates) + 0.03) * 10) / 10);
  const span = hi - lo || 1;
  const x = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - ((v - lo) / span) * innerH;
  const pts = data.map((d, i) => [x(i), y(d.rate)] as const);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `M${padL} ${padT + innerH} ` + pts.map((p) => "L" + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + ` L${padL + innerW} ${padT + innerH} Z`;
  const grid = Array.from({ length: 5 }, (_, i) => lo + (span * i) / 4);
  const xlabel = (d: { date: string }) => {
    const dt = new Date(d.date);
    return Number.isNaN(dt.getTime()) ? d.date : `${dt.getMonth() + 1}/${dt.getDate()}`;
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let idx = Math.round(((px - padL) / innerW) * (data.length - 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));
    setHover(idx);
  };

  const hp = hover != null ? pts[hover]! : null;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} y1={y(g)} x2={padL + innerW} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 10} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill="var(--fg-muted)" className="tnum">{agreementPct(g)}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={"x" + i}>
            <line x1={x(i)} y1={padT} x2={x(i)} y2={padT + innerH} stroke="var(--line)" strokeWidth="1" opacity={hover === i ? 0 : 0.35} />
            <text x={x(i)} y={padT + innerH + 16} textAnchor="middle" fontSize="9" fill="var(--fg-faint)" className="tnum">{xlabel(d)}</text>
          </g>
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
        <text x={padL - 10} y={padT - 5} textAnchor="end" fontSize="8.5" fill="var(--fg-faint)">%</text>
        <path d={area} fill="var(--info)" fillOpacity="0.09" />
        <path d={line} fill="none" stroke="var(--info)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 3.6 : 2} fill="var(--info)" opacity={hover == null || hover === i ? 1 : 0.5} />
        ))}
        {hp && (
          <g>
            <line x1={hp[0]} y1={padT} x2={hp[0]} y2={padT + innerH} stroke="var(--info)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={hp[0]} cy={hp[1]} r="4.5" fill="var(--info)" stroke="var(--bg)" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {hover != null && hp && (
        <div
          style={{
            position: "absolute",
            top: 6,
            pointerEvents: "none",
            left: `clamp(8px, ${(hp[0] / W) * 100}% - 60px, calc(100% - 140px))`,
            background: "var(--bg-raised-2)",
            border: "1px solid var(--line-2)",
            borderRadius: 7,
            padding: "8px 11px",
            boxShadow: "var(--shadow-pop)",
            whiteSpace: "nowrap",
          }}
        >
          <div className="tnum" style={{ fontSize: 15, fontWeight: 500, color: "var(--info)" }}>{agreementPct(data[hover]!.rate)}% agreement</div>
          <div className="caption mono" style={{ marginTop: 2 }}>{data[hover]!.date}</div>
        </div>
      )}
    </div>
  );
}

/* ---- human overrides per week ---- */
export function OverridesChart({ data }: { data: { week: string; count: number }[] }) {
  if (!data.length) return <div className="caption">No overrides recorded yet.</div>;
  const W = 760, H = 210, padL = 30, padR = 14, padT = 20, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const counts = data.map((d) => d.count);
  const rawMax = Math.max(...counts);
  const max = Math.max(4, Math.ceil(rawMax / 4) * 4);
  const peak = rawMax;
  const yticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  const gap = innerW / data.length;
  const bw = Math.min(22, gap * 0.5);
  const weekLabel = (w: string) => (w.includes("-W") ? "W" + w.split("-W")[1] : w);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {yticks.map((t, i) => {
        const gy = padT + innerH - (t / max) * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={gy} x2={padL + innerW} y2={gy} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 9} y={gy + 3.5} textAnchor="end" fontSize="9.5" fill="var(--fg-muted)" className="tnum">{t}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const setback = d.count === peak && peak > 0 && data.filter((x) => x.count === peak).length === 1;
        const cx = padL + i * gap + gap / 2;
        const h = (d.count / max) * innerH;
        const c = setback ? "var(--warn)" : "var(--effort)";
        return (
          <g key={i}>
            <text x={cx} y={padT + innerH - h - 7} textAnchor="middle" fontSize="11" fontWeight="500" fill={setback ? "var(--warn)" : "var(--fg-muted)"} className="tnum">{d.count}</text>
            <rect x={cx - bw / 2} y={padT + innerH - h} width={bw} height={Math.max(h, 1)} rx="3" fill={c} fillOpacity={setback ? 0.9 : 0.5} />
            <text x={cx} y={padT + innerH + 16} textAnchor="middle" fontSize="9.5" fill="var(--fg-faint)" className="tnum">{weekLabel(d.week)}</text>
          </g>
        );
      })}
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="var(--line-2)" strokeWidth="1" />
      <text x={padL - 9} y={padT - 6} textAnchor="end" fontSize="8.5" fill="var(--fg-faint)">count</text>
    </svg>
  );
}
