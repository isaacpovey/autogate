/* ============================================================
   Autogate — mock data + derivations
   Strictly the API shape. No invented fields (no confidence,
   severity, SLA, owner, environment, or diff).
   Exposed as window.AG
   ============================================================ */
(function () {
  "use strict";

  // ---- formatting helpers ----
  function fmtDuration(ms) {
    if (ms == null || ms === 0) return null;
    if (ms < 1000) return ms.toLocaleString("en-US") + " ms";
    const s = ms / 1000;
    return (s >= 10 ? Math.round(s) : s.toFixed(1)) + " s";
  }
  // riskScore band -> token family
  function riskBand(score) {
    if (score >= 60) return "high";
    if (score >= 30) return "mid";
    return "low";
  }
  // derive cross-layer disagreement from checks (no invented score)
  function disagreement(checks) {
    const byLayer = {};
    checks.forEach((c) => {
      if (c.layer === "monitoring" && c.verdict == null) return;
      (byLayer[c.layer] = byLayer[c.layer] || new Set()).add(
        c.verdict === "warn" ? "fail" : c.verdict // warn rolls toward concern
      );
    });
    // a layer is "concerned" if it holds any fail/warn; "clear" if all pass
    const stance = {};
    Object.keys(byLayer).forEach((layer) => {
      const verdicts = checks.filter((c) => c.layer === layer && c.verdict).map((c) => c.verdict);
      if (verdicts.some((v) => v === "fail")) stance[layer] = "fail";
      else if (verdicts.some((v) => v === "warn")) stance[layer] = "warn";
      else if (verdicts.some((v) => v === "inconclusive")) stance[layer] = "inconclusive";
      else stance[layer] = "pass";
    });
    const active = Object.keys(stance).filter((l) => l !== "monitoring" || stance[l]);
    const set = new Set(active.map((l) => stance[l]));
    // disagreement = at least one pass AND at least one fail across layers
    const hasPass = active.some((l) => stance[l] === "pass");
    const hasFail = active.some((l) => stance[l] === "fail");
    return { conflict: hasPass && hasFail, stance };
  }
  // effort band: derived from check-spread + disagreement + risk (labeled derived in UI)
  function effortBand(run) {
    const cs = run.checkSummary;
    const spread = (cs.warn || 0) + (cs.fail || 0);
    const dis = run.checks ? disagreement(run.checks).conflict : false;
    let score = 0;
    score += spread; // each unresolved-ish concern
    if (dis) score += 2;
    if (run.riskScore >= 60) score += 2;
    else if (run.riskScore >= 35) score += 1;
    if (run.checks && run.checks.some((c) => c.verdict === "inconclusive")) score += 1;
    if (score <= 1) return "quick";
    if (score <= 3) return "moderate";
    return "deep";
  }
  const effortOrder = { quick: 0, moderate: 1, deep: 2 };

  function summaryOf(run) {
    return {
      runId: run.runId, pr: run.pr, status: run.status, decision: run.decision,
      riskScore: run.riskScore, checkSummary: run.checkSummary,
      createdAt: run.createdAt, updatedAt: run.updatedAt,
    };
  }

  // ---- check builders ----
  const C = (kind, layer, verdict, durationMs, finding, detail) => ({ kind, layer, verdict, durationMs, finding, detail });

  // ============================================================
  // RUNS
  // ============================================================
  const RUNS = [];

  // 1) HERO — cross-layer disagreement (Static pass / AI fail / Monitoring future)
  RUNS.push({
    runId: "run_4821",
    pr: { number: 4821, title: "Rotate token issuance to short-lived signed JWTs", repo: "askable/api", author: "Priya Nadig", url: "#", branch: "feat/jwt-rotation" },
    status: "completed", decision: "escalate", riskScore: 64,
    createdAt: "09:58:11", updatedAt: "10:02:44",
    checkSummary: { pass: 6, warn: 1, fail: 1, pending: 0 },
    checks: [
      C("lint", "static", "pass", 1204, "No lint violations across 14 changed files."),
      C("typecheck", "static", "pass", 6300, "Type checking passed; no new implicit any introduced."),
      C("unit-tests", "static", "pass", 18400, "412 of 412 unit tests passed.", "auth/token.spec.ts · auth/jwt.spec.ts · 9 files exercised the issuance path."),
      C("build", "static", "pass", 24100, "Production build succeeded; bundle size +1.2 kB."),
      C("dependency-audit", "static", "pass", 880, "No known advisories in added or updated dependencies."),
      C("semantic-review", "ai", "pass", 9100, "Refactor is behavior-preserving for the standard login flow; token shape and claims are unchanged for first-party clients.", "Reviewed issuance call sites and the rotation timer; logic matches the prior long-lived path one-to-one for the common case."),
      C("security-review", "ai", "fail", 12600, "Cannot confirm audience (`aud`) claim validation survives the refactor on the service-to-service issuance path; a token minted for one internal audience may be accepted by another.", "Touches auth/token.ts issueServiceToken(); the prior path validated `aud` against the requesting service registry — that check is not present on the new short-lived path."),
      C("test-coverage", "ai", "warn", 4100, "The service-to-service issuance branch added here is not exercised by any test; only the first-party login path is covered.", "New branch: auth/token.ts L142–171."),
    ],
    decisionInfo: {
      outcome: "escalate", riskScore: 64,
      brief: "Static and the semantic AI review both pass cleanly — but the AI security agent fails this change on the service-to-service token path: it can't confirm the audience claim is still validated. The layers disagree on a security-sensitive path, and the failing branch has no test coverage. That conflict is why this is with you rather than auto-merged.",
      reasons: [
        "cross-layer disagreement — security review (fail) vs semantic review & static (pass)",
        "touches a security-sensitive path: service-to-service token issuance",
        "audience-claim validation not verifiable on the new short-lived path",
        "the failing issuance branch is not covered by any test",
      ],
    },
    timeline: [
      { at: "09:58:11", event: "run created from feat/jwt-rotation" },
      { at: "09:58:13", event: "static layer started — 5 checks" },
      { at: "09:59:37", event: "static layer passed" },
      { at: "09:59:38", event: "AI layer started — 3 agents" },
      { at: "10:02:11", event: "semantic review passed" },
      { at: "10:02:39", event: "security review failed — sensitive path: token issuance", emphasis: "fail" },
      { at: "10:02:43", event: "test-coverage review warned — issuance branch uncovered" },
      { at: "10:02:44", event: "orchestrator escalated to human — cross-layer disagreement", emphasis: "decision" },
    ],
  });

  // 2) quick escalate — single AI warn, low risk
  RUNS.push({
    runId: "run_2210",
    pr: { number: 2210, title: "Add exponential backoff to webhook dispatcher", repo: "askable/web", author: "Marco Reyes", url: "#", branch: "fix/webhook-backoff" },
    status: "completed", decision: "escalate", riskScore: 27,
    createdAt: "10:11:02", updatedAt: "10:12:55",
    checkSummary: { pass: 7, warn: 1, fail: 0, pending: 0 },
    checks: [
      C("lint", "static", "pass", 990, "Clean."),
      C("typecheck", "static", "pass", 5400, "Passed."),
      C("unit-tests", "static", "pass", 12200, "318 of 318 unit tests passed."),
      C("build", "static", "pass", 21900, "Build succeeded; no size change."),
      C("dependency-audit", "static", "pass", 760, "No advisories."),
      C("semantic-review", "ai", "pass", 7300, "Backoff schedule is bounded (max 5 retries, 30s cap) and idempotent; no risk of unbounded retry storms."),
      C("regression-review", "ai", "pass", 5100, "No behavioral change to successful-delivery path; only failure handling is affected."),
      C("test-coverage", "ai", "warn", 3200, "The new retry branch is not covered by tests; success path is fully covered.", "New branch: dispatcher/retry.ts L40–58."),
    ],
    decisionInfo: {
      outcome: "escalate", riskScore: 27,
      brief: "Everything passes except one AI warning: the newly added retry branch has no test coverage. The change is small, well-bounded, and low-risk — this is a quick call on whether shipping the uncovered branch is acceptable, or whether it should go back for a test first.",
      reasons: [
        "AI test-coverage review warns: the retry branch is uncovered",
        "no other layer raised a concern; risk is low and the change is isolated",
      ],
    },
    timeline: [
      { at: "10:11:02", event: "run created from fix/webhook-backoff" },
      { at: "10:11:04", event: "static layer started" },
      { at: "10:12:18", event: "static layer passed" },
      { at: "10:12:51", event: "semantic & regression review passed" },
      { at: "10:12:54", event: "test-coverage review warned — retry branch uncovered" },
      { at: "10:12:55", event: "orchestrator escalated to human — unresolved warning", emphasis: "decision" },
    ],
  });

  // 3) moderate escalate — inconclusive verdict (can't confidently assess)
  RUNS.push({
    runId: "run_0883",
    pr: { number: 883, title: "Migrate session store to Redis cluster", repo: "askable/infra", author: "Dana Whitfield", url: "#", branch: "infra/redis-cluster" },
    status: "completed", decision: "escalate", riskScore: 52,
    createdAt: "09:40:20", updatedAt: "09:45:02",
    checkSummary: { pass: 6, warn: 0, fail: 0, pending: 0 },
    // note: 1 inconclusive — not counted in pass/warn/fail; surfaced in tally separately
    inconclusive: 1,
    checks: [
      C("lint", "static", "pass", 1020, "Clean."),
      C("typecheck", "static", "pass", 4900, "Passed."),
      C("unit-tests", "static", "pass", 9800, "207 of 207 unit tests passed."),
      C("build", "static", "pass", 19800, "Build succeeded."),
      C("config-validation", "static", "pass", 1400, "Redis connection config and TLS settings validate against the cluster schema."),
      C("semantic-review", "ai", "pass", 8200, "Read/write call sites are correctly pointed at the cluster client; serialization format is unchanged."),
      C("data-migration-review", "ai", "inconclusive", 11200, "Cannot confirm the dual-write window is safe from the change alone — whether in-flight sessions written to the old single-node store are read back during cutover depends on deploy ordering, which isn't visible here.", "Sessions touch auth state; a missed dual-write would silently log users out. Needs a human to confirm the rollout sequence."),
    ],
    decisionInfo: {
      outcome: "escalate", riskScore: 52,
      brief: "Static is green and the semantic review is clean, but the data-migration agent returned inconclusive: it can't tell from this change whether the dual-write window during cutover is safe, because that depends on deploy ordering it can't see. This isn't a failure — it's a genuine 'can't confirm from here.' You can verify the rollout sequence and decide.",
      reasons: [
        "data-migration review is inconclusive — dual-write safety depends on deploy ordering not visible in the change",
        "touches session persistence; a missed write would log users out",
      ],
    },
    timeline: [
      { at: "09:40:20", event: "run created from infra/redis-cluster" },
      { at: "09:40:22", event: "static layer started" },
      { at: "09:42:10", event: "static layer passed" },
      { at: "09:44:48", event: "semantic review passed" },
      { at: "09:45:01", event: "data-migration review inconclusive — dual-write window not verifiable" },
      { at: "09:45:02", event: "orchestrator escalated to human — unresolved uncertainty", emphasis: "decision" },
    ],
  });

  // 4) blocked — gate held it (static fail + AI security fail), deep
  RUNS.push({
    runId: "run_4799",
    pr: { number: 4799, title: "Drop legacy /v1 auth endpoints", repo: "askable/api", author: "Sam Oketch", url: "#", branch: "chore/remove-v1-auth" },
    status: "completed", decision: "blocked", riskScore: 83,
    createdAt: "08:30:00", updatedAt: "08:36:40",
    checkSummary: { pass: 3, warn: 0, fail: 2, pending: 0 },
    checks: [
      C("lint", "static", "pass", 880, "Clean."),
      C("typecheck", "static", "pass", 5100, "Passed."),
      C("contract-tests", "static", "fail", 14200, "6 consumer contract tests fail: external integrations still call POST /v1/auth/token.", "partners/zapier.contract.ts and 5 others reference the removed route."),
      C("build", "static", "pass", 22000, "Build succeeded."),
      C("semantic-review", "ai", "pass", 7600, "Removal is internally consistent; no first-party caller references the v1 routes."),
      C("security-review", "ai", "fail", 9900, "Removing /v1 without a deprecation window will hard-break active third-party integrations still authenticating against it; observed traffic on these routes in the last 24h is non-zero.", "Breaking change with live external dependents."),
    ],
    decisionInfo: {
      outcome: "blocked", riskScore: 83,
      brief: "The gate blocked this automatically: contract tests fail and the security review confirms live third-party traffic still hits the v1 auth routes. Removing them now would hard-break active integrations. It's surfaced so you can confirm the block or override it if you have context the system doesn't — e.g. the integrations are already being migrated.",
      reasons: [
        "static contract tests fail — external consumers still call /v1/auth",
        "security review fail — breaking change with live external dependents",
        "no deprecation window for active third-party traffic",
      ],
    },
    timeline: [
      { at: "08:30:00", event: "run created from chore/remove-v1-auth" },
      { at: "08:30:02", event: "static layer started" },
      { at: "08:34:18", event: "contract tests failed — external consumers reference removed route", emphasis: "fail" },
      { at: "08:36:30", event: "security review failed — breaking change, live dependents", emphasis: "fail" },
      { at: "08:36:40", event: "orchestrator blocked merge — gate held the change", emphasis: "decision" },
    ],
  });

  // 5) running — in motion, checks landing live (not a decision view)
  RUNS.push({
    runId: "run_4830",
    pr: { number: 4830, title: "Cache repository permission lookups", repo: "askable/api", author: "Lena Fischer", url: "#", branch: "perf/permission-cache" },
    status: "running", decision: "pending", riskScore: 31,
    createdAt: "10:18:40", updatedAt: "10:18:40",
    checkSummary: { pass: 1, warn: 0, fail: 0, pending: 6 },
    // checks land progressively; _resolveOrder drives the live sim
    checks: [
      C("lint", "static", "pass", 940, "Clean."),
      C("typecheck", "static", null, 0, null),
      C("unit-tests", "static", null, 0, null),
      C("build", "static", null, 0, null),
      C("dependency-audit", "static", null, 0, null),
      C("semantic-review", "ai", null, 0, null),
      C("performance-review", "ai", null, 0, null),
    ],
    _resolveOrder: [
      { i: 1, verdict: "pass", durationMs: 5200, finding: "Passed." },
      { i: 2, verdict: "pass", durationMs: 11800, finding: "289 of 289 unit tests passed." },
      { i: 3, verdict: "pass", durationMs: 22400, finding: "Build succeeded." },
      { i: 4, verdict: "pass", durationMs: 820, finding: "No advisories." },
      { i: 5, verdict: "pass", durationMs: 8100, finding: "Cache invalidation correctly tracks permission grant/revoke events; no stale-read window introduced." },
      { i: 6, verdict: "warn", durationMs: 6400, finding: "Cache TTL (15 min) means a revoked permission could persist up to 15 minutes; acceptable for read paths but worth a human glance.", detail: "perf/cache.ts L22." },
    ],
    timeline: [
      { at: "10:18:40", event: "run created from perf/permission-cache" },
      { at: "10:18:42", event: "static layer started — 5 checks" },
    ],
  });

  // 6) IN PRODUCTION — degrading (the incident, pre-merge green history)
  RUNS.push({
    runId: "run_2233",
    pr: { number: 2233, title: "Enable new pricing page", repo: "askable/web", author: "Ada Lindqvist", url: "#", branch: "feat/pricing-v2" },
    status: "completed", decision: "merged", riskScore: 22,
    createdAt: "Yesterday 16:40", updatedAt: "10:04:10",
    checkSummary: { pass: 8, warn: 0, fail: 0, pending: 0 },
    monitoring: { canaryPercent: 25, newErrors: 142, window: "18 min", rolledBack: false },
    incident: true,
    checks: [
      C("lint", "static", "pass", 870, "Clean."),
      C("typecheck", "static", "pass", 4600, "Passed."),
      C("unit-tests", "static", "pass", 8800, "201 of 201 unit tests passed."),
      C("build", "static", "pass", 20100, "Build succeeded."),
      C("dependency-audit", "static", "pass", 700, "No advisories."),
      C("semantic-review", "ai", "pass", 6900, "Pricing page is a self-contained route; no shared component or pricing-logic change. Low blast radius."),
      C("regression-review", "ai", "pass", 5400, "Checkout flow untouched; feature is gated behind a route flag."),
      C("accessibility-review", "ai", "pass", 4200, "New page meets contrast and focus-order checks."),
    ],
    decisionInfo: {
      outcome: "merged", riskScore: 22,
      brief: "This change auto-merged cleanly at low risk — every layer passed and blast radius looked contained. It is now degrading in production: error rate has been climbing for 18 minutes on the 25% canary. This is no longer a merge question; the decision is whether to roll back.",
      reasons: [
        "all pre-merge layers passed — auto-merged at risk 22",
        "post-merge monitoring: new errors climbing for 18 min on the 25% canary",
        "errors concentrate on the new pricing route — likely the cause",
      ],
    },
    timeline: [
      { at: "Yesterday 16:40", event: "run created from feat/pricing-v2" },
      { at: "Yesterday 16:48", event: "all layers passed — risk 22" },
      { at: "Yesterday 16:48", event: "orchestrator auto-merged — within autonomy policy", emphasis: "decision" },
      { at: "Yesterday 16:49", event: "merged to main — canary rollout started at 25%" },
      { at: "09:46:00", event: "monitoring: error rate began climbing on canary", emphasis: "fail" },
      { at: "10:04:10", event: "error threshold approaching — surfaced as incident", emphasis: "fail" },
    ],
  });

  // 7) IN PRODUCTION — post-override approved (recorded reason), healthy
  RUNS.push({
    runId: "run_2150",
    pr: { number: 2150, title: "Relax rate limit on public search endpoint", repo: "askable/api", author: "Marco Reyes", url: "#", branch: "feat/search-ratelimit" },
    status: "completed", decision: "merged", riskScore: 44,
    createdAt: "Yesterday 11:02", updatedAt: "Yesterday 11:31",
    monitoring: { canaryPercent: 100, newErrors: 0, window: "20 h", rolledBack: false },
    overridden: { action: "approve_merge", actor: "Ada Lindqvist", at: "Yesterday 11:30", reason: "Confirmed the new limit (120/min) is still well below our abuse threshold, and the search team owns alerting on this endpoint. The AI's concern about scraping is valid in general but doesn't apply here — results are already public and unauthenticated." },
    checkSummary: { pass: 7, warn: 1, fail: 0, pending: 0 },
    checks: [
      C("lint", "static", "pass", 910, "Clean."),
      C("typecheck", "static", "pass", 4700, "Passed."),
      C("unit-tests", "static", "pass", 9200, "176 of 176 unit tests passed."),
      C("build", "static", "pass", 19900, "Build succeeded."),
      C("semantic-review", "ai", "pass", 7100, "Rate-limit change is localized to the public search middleware; no auth path affected."),
      C("security-review", "ai", "warn", 8600, "Higher request ceiling marginally eases automated scraping of public search results; not a vulnerability, but a policy judgment.", "Results are already public and unauthenticated."),
      C("regression-review", "ai", "pass", 5000, "No change to result ranking or caching behavior."),
    ],
    decisionInfo: {
      outcome: "merged", riskScore: 44,
      brief: "The AI security review warned that a higher rate limit eases scraping of public search results — a policy judgment, not a vulnerability. A human reviewed the context and approved the merge with a recorded reason.",
      reasons: [
        "security review warned — higher ceiling eases scraping of public results",
        "no static or semantic concern; localized middleware change",
      ],
    },
    timeline: [
      { at: "Yesterday 11:02", event: "run created from feat/search-ratelimit" },
      { at: "Yesterday 11:14", event: "static layer passed" },
      { at: "Yesterday 11:27", event: "security review warned — eases scraping of public results" },
      { at: "Yesterday 11:28", event: "orchestrator escalated to human — policy judgment" },
      { at: "Yesterday 11:30", event: "approved & merged by Ada Lindqvist — reason recorded", emphasis: "override" },
      { at: "Yesterday 11:31", event: "merged to main — canary rollout started at 25%" },
      { at: "Yesterday 13:05", event: "canary advanced to 100% — error rate flat" },
    ],
  });

  // 8) IN PRODUCTION — healthy
  RUNS.push({
    runId: "run_2228",
    pr: { number: 2228, title: "Add CSV export to insights table", repo: "askable/web", author: "Priya Nadig", url: "#", branch: "feat/insights-csv" },
    status: "completed", decision: "merged", riskScore: 12,
    createdAt: "Today 08:15", updatedAt: "Today 09:30",
    monitoring: { canaryPercent: 100, newErrors: 0, window: "1 h 15 m", rolledBack: false },
    checkSummary: { pass: 8, warn: 0, fail: 0, pending: 0 },
    checks: [
      C("lint", "static", "pass", 820, "Clean."),
      C("typecheck", "static", "pass", 4400, "Passed."),
      C("unit-tests", "static", "pass", 7600, "164 of 164 unit tests passed."),
      C("build", "static", "pass", 19000, "Build succeeded; bundle +0.8 kB."),
      C("dependency-audit", "static", "pass", 690, "No advisories."),
      C("semantic-review", "ai", "pass", 6100, "Export is read-only and client-side; no data exposure beyond what the table already renders."),
      C("regression-review", "ai", "pass", 4800, "Table rendering unchanged."),
      C("accessibility-review", "ai", "pass", 3900, "Export control is keyboard-reachable and labeled."),
    ],
    decisionInfo: {
      outcome: "merged", riskScore: 12,
      brief: "A small, read-only, client-side feature. Every layer passed at very low risk and it auto-merged. Healthy in production.",
      reasons: ["all layers passed — read-only, client-side, low blast radius"],
    },
    timeline: [
      { at: "Today 08:15", event: "run created from feat/insights-csv" },
      { at: "Today 08:24", event: "all layers passed — risk 12" },
      { at: "Today 08:24", event: "orchestrator auto-merged — within autonomy policy", emphasis: "decision" },
      { at: "Today 08:25", event: "merged to main — canary rollout started at 25%" },
      { at: "Today 09:30", event: "canary advanced to 100% — error rate flat" },
    ],
  });

  // 9) ROLLED BACK — terminal (auto-rollback)
  RUNS.push({
    runId: "run_0861",
    pr: { number: 861, title: "Parallelize asset upload pipeline", repo: "askable/infra", author: "Dana Whitfield", url: "#", branch: "perf/parallel-upload" },
    status: "completed", decision: "rolled_back", riskScore: 38,
    createdAt: "Yesterday 14:20", updatedAt: "Yesterday 15:08",
    monitoring: { canaryPercent: 25, newErrors: 0, window: "rolled back", rolledBack: true },
    checkSummary: { pass: 7, warn: 1, fail: 0, pending: 0 },
    checks: [
      C("lint", "static", "pass", 900, "Clean."),
      C("typecheck", "static", "pass", 4600, "Passed."),
      C("unit-tests", "static", "pass", 9100, "188 of 188 unit tests passed."),
      C("build", "static", "pass", 20500, "Build succeeded."),
      C("semantic-review", "ai", "pass", 7200, "Parallelization preserves upload ordering guarantees via the existing sequence token."),
      C("concurrency-review", "ai", "warn", 8800, "Increased parallelism raises peak memory on the upload workers; within limits in tests but close to the ceiling.", "worker/upload.ts — concurrency raised 4→16."),
      C("regression-review", "ai", "pass", 5100, "Upload result shape unchanged."),
    ],
    decisionInfo: {
      outcome: "rolled_back", riskScore: 38,
      brief: "Auto-merged with one concurrency warning about peak worker memory. In production, upload workers hit the memory ceiling under real load and the auto-rollback fired when the error threshold was crossed — exactly the case the concurrency warning flagged.",
      reasons: [
        "concurrency review warned — peak worker memory near the ceiling",
        "production: workers OOM'd under real load; error threshold crossed",
        "auto-rollback fired automatically — reverted at 25% canary",
      ],
    },
    timeline: [
      { at: "Yesterday 14:20", event: "run created from perf/parallel-upload" },
      { at: "Yesterday 14:35", event: "static layer passed" },
      { at: "Yesterday 14:41", event: "concurrency review warned — peak memory near ceiling" },
      { at: "Yesterday 14:42", event: "orchestrator auto-merged — warning within tolerance", emphasis: "decision" },
      { at: "Yesterday 14:43", event: "merged to main — canary rollout started at 25%" },
      { at: "Yesterday 15:06", event: "monitoring: upload workers OOM — error rate spiked", emphasis: "fail" },
      { at: "Yesterday 15:08", event: "rolled back automatically — error threshold exceeded", emphasis: "override" },
    ],
  });

  // ---- Auto-merged (handled by system) — completed, decision auto_merge ----
  const autoMerged = [
    { runId: "run_4825", n: 4825, title: "Add index on runs.created_at", repo: "askable/api", author: "Lena Fischer", branch: "perf/runs-index", risk: 16, why: "Index-only migration; semantic review confirmed no query plan regressions and no lock on write path." },
    { runId: "run_0879", n: 879, title: "Tune nginx keepalive timeout", repo: "askable/infra", author: "Sam Oketch", branch: "infra/nginx-keepalive", risk: 19, why: "Config-only change within documented safe range; static config validation and semantic review both clean." },
    { runId: "run_4822", n: 4822, title: "Memoize feature-flag evaluation", repo: "askable/api", author: "Marco Reyes", branch: "perf/flag-memo", risk: 11, why: "Pure performance change; flag values and invalidation semantics unchanged, fully covered by tests." },
    { runId: "run_2240", n: 2240, title: "Bump design-system to 4.2.0", repo: "askable/web", author: "Ada Lindqvist", branch: "chore/ds-4.2.0", risk: 8, why: "Patch + minor dependency bump; no breaking API in changelog, visual regression suite passed." },
    { runId: "run_2238", n: 2238, title: "Fix typo in onboarding tooltip", repo: "askable/web", author: "Priya Nadig", branch: "fix/onboarding-copy", risk: 3, why: "Copy-only change to a single string; zero logic touched." },
  ];
  autoMerged.forEach((a) => {
    RUNS.push({
      runId: a.runId,
      pr: { number: a.n, title: a.title, repo: a.repo, author: a.author, url: "#", branch: a.branch },
      status: "completed", decision: "auto_merge", riskScore: a.risk,
      createdAt: "Today", updatedAt: "Today",
      checkSummary: { pass: a.risk < 12 ? 6 : 8, warn: 0, fail: 0, pending: 0 },
      autoWhy: a.why,
      checks: [
        C("lint", "static", "pass", 800, "Clean."),
        C("typecheck", "static", "pass", 4200, "Passed."),
        C("unit-tests", "static", "pass", 7000, "All unit tests passed."),
        C("build", "static", "pass", 18800, "Build succeeded."),
        C("semantic-review", "ai", "pass", 6000, a.why),
        C("regression-review", "ai", "pass", 4600, "No behavioral regression detected."),
      ],
      decisionInfo: { outcome: "auto_merge", riskScore: a.risk, brief: a.why, reasons: ["all layers passed within autonomy policy — no human needed"] },
      timeline: [
        { at: "Today", event: "run created from " + a.branch },
        { at: "Today", event: "all layers passed — risk " + a.risk },
        { at: "Today", event: "orchestrator auto-merged — within autonomy policy", emphasis: "decision" },
        { at: "Today", event: "merged to main" },
      ],
    });
  });

  // ============================================================
  // TRUST METRICS — honest, with a visible dip-and-recovery
  // ============================================================
  // agreementRate over ~12 weeks (weekly), real noise + a setback week
  const agreementRate = [
    { date: "wk1", rate: 71 }, { date: "wk2", rate: 73 }, { date: "wk3", rate: 72 },
    { date: "wk4", rate: 76 }, { date: "wk5", rate: 78 }, { date: "wk6", rate: 77 },
    { date: "wk7", rate: 81 }, { date: "wk8", rate: 72 }, /* setback week */
    { date: "wk9", rate: 75 }, { date: "wk10", rate: 83 }, { date: "wk11", rate: 86 },
    { date: "wk12", rate: 88 },
  ];
  // where changes go — per week: auto / escalated / rolled-back
  const outcomes = [
    { week: "wk1", auto: 58, escalated: 34, rolled: 4 },
    { week: "wk2", auto: 64, escalated: 31, rolled: 3 },
    { week: "wk3", auto: 70, escalated: 28, rolled: 3 },
    { week: "wk4", auto: 79, escalated: 24, rolled: 2 },
    { week: "wk5", auto: 88, escalated: 22, rolled: 2 },
    { week: "wk6", auto: 96, escalated: 19, rolled: 2 },
    { week: "wk7", auto: 104, escalated: 17, rolled: 1 },
    { week: "wk8", auto: 99, escalated: 21, rolled: 6 }, /* setback: rollbacks cluster */
    { week: "wk9", auto: 108, escalated: 18, rolled: 4 },
    { week: "wk10", auto: 121, escalated: 15, rolled: 2 },
    { week: "wk11", auto: 133, escalated: 13, rolled: 1 },
    { week: "wk12", auto: 142, escalated: 11, rolled: 1 },
  ];
  const overridesPerWeek = [
    { week: "wk1", count: 12 }, { week: "wk2", count: 11 }, { week: "wk3", count: 10 },
    { week: "wk4", count: 9 }, { week: "wk5", count: 8 }, { week: "wk6", count: 8 },
    { week: "wk7", count: 6 }, { week: "wk8", count: 11 }, { week: "wk9", count: 7 },
    { week: "wk10", count: 5 }, { week: "wk11", count: 4 }, { week: "wk12", count: 4 },
  ];
  const recentRollbacks = [
    { date: "Yesterday", change: "Parallelize asset upload pipeline", repo: "askable/infra", cause: "Upload workers hit memory ceiling under load — auto-rollback at threshold.", runId: "run_0861" },
    { date: "wk8 · Mon", change: "Switch image CDN provider", repo: "askable/web", cause: "Cache-miss storm on cutover; latency tripled. Rolled back by Dana.", runId: null },
    { date: "wk8 · Wed", change: "Batch notification fan-out", repo: "askable/api", cause: "Duplicate notifications from retry race. Auto-rollback.", runId: null },
    { date: "wk8 · Thu", change: "New onboarding redirect rules", repo: "askable/web", cause: "Redirect loop for SSO users. Rolled back by Ada.", runId: null },
  ];
  const metrics = {
    agreementRate,
    recentRollbacks,
    escalation: { precision: 0.82, recall: 0.91 },
    overridesPerWeek,
    // derived/aggregate (labeled as derived in UI)
    summary: {
      agreementNow: 88, agreementSinceLaunch: 17,
      shipped30d: 1284, shippedDailyAvg: 43,
      medianTtmMin: 9, ttmBeforeMin: 47,
      autoMergeMissRate: 0.014, // share of auto-merges later rolled back
    },
    outcomes,
  };

  // repositories (for the sidebar filter group)
  const repos = [
    { name: "askable/api", needs: 2 },
    { name: "askable/web", needs: 1 },
    { name: "askable/infra", needs: 1 },
  ];

  // current human (for "My runs")
  const ME = "Priya Nadig";

  window.AG = {
    RUNS, metrics, repos, ME,
    fmtDuration, riskBand, effortBand, effortOrder, disagreement, summaryOf,
    layerLabel: { static: "Static", ai: "AI", monitoring: "Monitoring" },
  };
})();
