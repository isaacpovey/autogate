/**
 * Pure derivation layer for the dashboard — everything the prototype computed
 * client-side, ported to the real contract types. No React, no I/O.
 */
import type {
  RunSummary,
  RunDetail,
  CheckResult,
  CheckLayer,
  RunDecision,
  RunStatus,
} from "./api-types";

/* ---------- risk ---------- */
export type RiskBand = "low" | "mid" | "high";
export function riskBand(score: number): RiskBand {
  if (score >= 60) return "high";
  if (score >= 30) return "mid";
  return "low";
}
export function riskColor(score: number): string {
  const b = riskBand(score);
  return b === "high" ? "var(--fail)" : b === "mid" ? "var(--warn)" : "var(--fg-2)";
}
export function riskDotColor(score: number): string {
  const b = riskBand(score);
  return b === "high" ? "var(--fail)" : b === "mid" ? "var(--warn)" : "var(--incon)";
}

/* ---------- formatting ---------- */
export function fmtDuration(ms: number | null | undefined): string | null {
  if (ms == null || ms === 0) return null;
  if (ms < 1000) return `${ms.toLocaleString("en-US")} ms`;
  const s = ms / 1000;
  return `${s >= 10 ? Math.round(s) : s.toFixed(1)} s`;
}

/** Trust agreement rate is 0–1 in the contract; show as a whole percent. */
export function agreementPct(rate: number): number {
  return Math.round(rate * 100);
}

/** Timeline `at` is an ISO string for real runs; render HH:MM, else passthrough. */
export function fmtTimeLabel(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/* ---------- verdict / layer stance ---------- */
export type Stance = "pass" | "warn" | "fail" | "needs_human" | "pending";

export function layerStance(checks: CheckResult[], layer: CheckLayer): Stance {
  const v = checks.filter((c) => c.layer === layer).map((c) => c.status);
  if (!v.length) return "pending";
  if (v.includes("fail")) return "fail";
  if (v.includes("warn")) return "warn";
  if (v.includes("needs_human")) return "needs_human";
  return "pass";
}

/** Layer-1 stance from gate counts (gate checks live in `gate`/`gateChecks`). */
export function gateStance(run: Pick<RunSummary, "gate">): Stance {
  const g = run.gate;
  if (g.total === 0) return "pending";
  if (g.failed > 0) return "fail";
  if (g.pending > 0) return "pending";
  return "pass";
}

/** Map a GitHub check conclusion to a verdict-ish status for the glyph. */
export function conclusionStance(conclusion: string): Stance {
  const c = conclusion.toLowerCase();
  if (c === "success") return "pass";
  if (c === "pending" || c === "" || c === "queued" || c === "in_progress") return "pending";
  if (c === "neutral" || c === "skipped") return "pass";
  return "fail"; // failure / error / timed_out / cancelled / action_required
}

export function disagreement(run: RunDetail): { conflict: boolean; stance: Record<string, Stance> } {
  const stance: Record<string, Stance> = {
    gate: gateStance(run),
    ai: layerStance(run.checks, "ai"),
    monitor: layerStance(run.checks, "monitor"),
  };
  const active = Object.values(stance).filter((s) => s !== "pending");
  return { conflict: active.includes("pass") && active.includes("fail"), stance };
}

export function needsHumanCount(checks: CheckResult[]): number {
  return checks.filter((c) => c.status === "needs_human").length;
}

/* ---------- effort (derived, labeled as such in UI) ---------- */
export type Effort = "quick" | "moderate" | "deep";
export const effortOrder: Record<Effort, number> = { quick: 0, moderate: 1, deep: 2 };

export function effortBand(run: Pick<RunSummary, "checkSummary" | "riskScore">): Effort {
  const cs = run.checkSummary;
  let score = (cs.warn || 0) + (cs.fail || 0);
  if (run.riskScore >= 60) score += 2;
  else if (run.riskScore >= 35) score += 1;
  if (score <= 1) return "quick";
  if (score <= 3) return "moderate";
  return "deep";
}

/* ---------- stream grouping ---------- */
export type RunGroups = {
  needsYou: RunSummary[];
  inProgress: RunSummary[];
  inProduction: RunSummary[];
  autoMerged: RunSummary[];
};

export function groupRuns(runs: RunSummary[]): RunGroups {
  const needsYou = runs
    .filter((r) => (r.decision === "escalate" || r.decision === "blocked") && r.status === "completed")
    .sort((a, b) => effortOrder[effortBand(a)] - effortOrder[effortBand(b)]);
  const inProgress = runs.filter((r) => r.status === "running" || r.status === "awaiting_checks");
  const autoMerged = runs
    .filter((r) => r.decision === "auto_merge")
    .sort((a, b) => b.riskScore - a.riskScore);
  const inProduction = runs
    .filter((r) => r.decision === "merged" || r.decision === "rolled_back")
    .sort((a, b) => Number(b.decision === "merged") - Number(a.decision === "merged"));
  return { needsYou, inProgress, inProduction, autoMerged };
}

/* ---------- incident detection (degrading in production) ---------- */
const INCIDENT_ERROR_FLOOR = 1;
export function deriveIncident(run: RunDetail): boolean {
  const m = run.monitoring;
  return (
    run.decision.outcome === "merged" &&
    !!m &&
    !m.rolledBack &&
    m.newErrors >= INCIDENT_ERROR_FLOOR
  );
}

/* ---------- recorded override reason (from mutation output) ---------- */
const OVERRIDE_PREFIX = "Human override: ";
export function recordedReasonFrom(run: RunDetail): { reason: string } | null {
  const hit = [...run.decision.reasons].reverse().find((r) => r.startsWith(OVERRIDE_PREFIX));
  if (hit) return { reason: hit.slice(OVERRIDE_PREFIX.length) };
  // fall back to a "Human …: <reason>" timeline event
  const ev = [...run.timeline].reverse().find((t) => /^Human .*:/.test(t.event));
  if (ev) {
    const idx = ev.event.indexOf(":");
    return { reason: ev.event.slice(idx + 1).trim() };
  }
  return null;
}

/** Heuristic emphasis for a timeline event (the contract has no emphasis field). */
export type TimelineEmphasis = "fail" | "override" | "decision" | null;
export function timelineEmphasis(event: string): TimelineEmphasis {
  if (/rolled back|roll back|failed|fail\b|error/i.test(event)) return "fail";
  if (/human|override|approved|blocked/i.test(event)) return "override";
  if (/escalat|auto-merge|auto-merged|merged|decision/i.test(event)) return "decision";
  return null;
}

/* ---------- style maps (CSS-var refs used inline by primitives) ---------- */
export const VERDICT: Record<string, { c: string; edge: string; tint: string; label: string }> = {
  pass: { c: "var(--pass)", edge: "var(--pass-edge)", tint: "var(--pass-tint)", label: "pass" },
  warn: { c: "var(--warn)", edge: "var(--warn-edge)", tint: "var(--warn-tint)", label: "warn" },
  fail: { c: "var(--fail)", edge: "var(--fail-edge)", tint: "var(--fail-tint)", label: "fail" },
  needs_human: { c: "var(--incon)", edge: "var(--incon-edge)", tint: "var(--incon-tint)", label: "needs human" },
  pending: { c: "var(--fg-faint)", edge: "var(--line-2)", tint: "transparent", label: "pending" },
};

export const DECISION_STYLE: Record<string, { label: string; c: string; tint: string }> = {
  escalate: { label: "escalated", c: "var(--warn)", tint: "var(--warn-tint)" },
  blocked: { label: "blocked", c: "var(--fail)", tint: "var(--fail-tint)" },
  merged: { label: "merged", c: "var(--pass)", tint: "var(--pass-tint)" },
  auto_merge: { label: "auto-merged", c: "var(--pass)", tint: "var(--pass-tint)" },
  rolled_back: { label: "rolled back", c: "var(--fail)", tint: "var(--fail-tint)" },
  pending: { label: "running", c: "var(--info)", tint: "var(--info-tint)" },
  awaiting_checks: { label: "awaiting checks", c: "var(--incon)", tint: "var(--incon-tint)" },
};

/** Pick the decision-pill style key from decision + status. */
export function statusPillKey(decision: RunDecision, status: RunStatus): string {
  if (status === "running") return "pending";
  if (status === "awaiting_checks") return "awaiting_checks";
  return decision;
}

export const SPINE_COLOR: Record<CheckLayer, string> = {
  gate: "var(--spine-static)",
  ai: "var(--spine-ai)",
  monitor: "var(--spine-mon)",
};
export const LAYER_LABEL: Record<CheckLayer, string> = {
  gate: "Static",
  ai: "AI",
  monitor: "Monitoring",
};
export const LAYER_ORDER: CheckLayer[] = ["gate", "ai", "monitor"];

/* ---------- safe lookups (noUncheckedIndexedAccess) ---------- */
const PENDING_VERDICT = { c: "var(--fg-faint)", edge: "var(--line-2)", tint: "transparent", label: "pending" };
export function verdictStyle(v: string) {
  return VERDICT[v] ?? PENDING_VERDICT;
}
const RUNNING_DECISION = { label: "running", c: "var(--info)", tint: "var(--info-tint)" };
export function decisionStyle(key: string) {
  return DECISION_STYLE[key] ?? RUNNING_DECISION;
}
