# Autogate — Hackday Design

**Date:** 2026-06-13
**Source brief:** Notion "Autogate — Overview" (initiative to replace traditional PR review with an automated safety layer).
**Scope of this doc:** A one-day, agent-built hackday system that demonstrates a large percentage of the full Autogate vision end-to-end, on real PRs.

---

## 1. Goal & constraints

- **North star demo:** a real PR (on `askable-services` *or* `autogate` itself) goes green on all existing checks → Autogate's AI agents review it → the orchestrator decides **auto-merge or escalate-with-a-brief** → it shows live in the dashboard → post-merge monitoring can roll back. Cover a *large percentage* of the full vision.
- **Build model:** the system is built **by agents** (sub-agents + Claude workflows), not by hand. The human deliverable is crisp tickets + contracts so agents can execute. Unlimited tokens.
- **Parallelism:** work splits across **two development streams** (two laptops). Runtime is single-node for the demo. Clean package boundaries + a shared contract so streams never collide.
- **Deployment:** single EC2 instance. `setup.sh` installs Docker + Compose, clones, `pnpm install`, writes `.env`, runs migrations; `docker-compose up` brings up the whole system (Postgres, Qdrant, orchestrator/API, dashboard, workers).
- **Testing posture:** starting from scratch and time-limited → **verify every step, don't over-test.** After each step an agent must prove the work runs: strict TypeScript (`turbo check-types`) passes **and** the artifact is exercised (CLI/smoke/endpoint/agent-on-fixture) with correct output. Write targeted checks for core behavior and contract boundaries; no exhaustive unit-test coverage. Evals are the verification mechanism for agent behavior.

## 2. Core design principles

1. **Everything is a port + adapter.** Every external dependency and subsystem sits behind a typed interface in `contracts`, with one real adapter and an in-memory mock. Nothing imports a concrete adapter; the orchestrator core is pure domain logic over ports. Enables parallel build (build against port + mock) and infra-free local runs.
2. **Every check produces the same `Verdict`.** L1 GitHub checks, L2 agents, and L3 monitoring are all surfaced as `Verdict`s. The orchestrator's `decide()` is agnostic to source.
3. **Agents are pure declaration.** An AI agent is a prompt + tool allowlist + Zod output schema + a `toVerdict` mapper, assembled by a factory. Authoring/iterating an agent touches one folder, never the orchestrator.
4. **Policy is data, not code.** Escalation thresholds, disagreement rules, and always-escalate paths live in config so they're tunable without redeploys.
5. **Repo-agnostic.** The backplane is driven by a per-target `RepoConfig` (RAG scope, sensitive paths, which agents run). We ship configs for `askable-services` and `autogate`.

## 3. Architecture & layers

```
PR opened (askable-services | autogate)
        │
        ▼
LAYER 1 — GATE:  all existing GitHub checks must pass  (CI · lint · types · BUGBOT · any repo check)
        │  Autogate reads check runs; only kicks off when ALL are green
        ▼
Orchestrator (Node + tRPC):  queue (Postgres) → fan out L2 agents → synthesize → decide
        │
LAYER 2 — AI agents (Claude Agent SDK + RAG; read diff + repo, no app boot):
        │   semantic · blast-radius · risk · pattern · security · architecture
        ▼
decide(verdicts, policy) → auto-merge | escalate (+ human brief)
        │
        ▼  (post-merge)
LAYER 3 — MONITORING:  Datadog MCP — new errors correlated to the change → canary / rollback

Cross-cutting:
   Sandbox (Docker):  clones PR ref → scoped repo read for L2 agents (no test runs, no app boot)
   Memory (Qdrant):   code_knowledge (RAG) · decisions (verdicts+overrides) · patterns (conventions)
   Store (Postgres):  runs · verdicts · escalations · overrides · job queue
   Dashboard (Next.js): release stream · run detail · human override   (against DashboardApi)
   Evals (non-blocking): per-agent fixture evals + end-to-end orchestrator-accuracy evals
```

**Changes from v1:** Layer 1 is now "all existing GitHub checks (incl. bugbot) pass" — the trigger for Autogate — rather than us re-running tests in a sandbox. **Layer 3a (boot-app web/pen-test) is dropped.** External checks are folded into Layer 1.

**Autogate builds the Layer 1 gate itself.** Rather than assume a repo has CI, we ship the GitHub Actions workflows that produce the gate checks (`check-types`, `lint`, `build`, plus bugbot wiring) — fully for the `autogate` repo (so dogfooding is self-contained) and as a reusable template for `askable-services`. See ticket 14. The orchestrator's `awaitAllChecks` reads the check runs these workflows produce.

## 4. Ports (interfaces in `contracts`)

| Port | Key methods | Adapter now | Mock |
|---|---|---|---|
| `VcsProvider` | getPR · getDiff · listCheckRuns · **awaitAllChecks** · postStatus · postBrief · merge | GitHub App | in-mem PR fixtures |
| `SandboxRunner` | clone(ref) · read/grep (RepoAccess) · teardown | Docker | git-worktree |
| `AgentSdk` | run({instructions, tools, outputSchema, context}) | Claude Agent SDK | canned responses |
| `MemoryClient` | query(collection) · upsert(collection) | Qdrant | in-mem vector stub |
| `Store` | runs · verdicts · escalations · overrides | Postgres + Drizzle | in-mem repository |
| `Queue` | enqueue · claim · complete | Postgres table | in-mem queue |
| `MonitoringClient` | errorsSince(deploy, change) | Datadog MCP | synthetic feed |
| `DashboardApi` | typed tRPC router (see §6) | tRPC standalone server (`@autogate/api`) | in-mem store + mock context |

## 5. Key contracts

```ts
type VerdictStatus = 'pass' | 'warn' | 'fail' | 'needs_human'
type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'
type Finding = { severity: Severity; title: string; detail: string; location?: { file: string; line?: number }; evidence?: string }
type Verdict = { sourceId: string; status: VerdictStatus; confidence: number; riskContribution: number; summary: string; findings: Finding[] }

type RunContext = {
  pr: PullRequest          // intent/description + diff
  repo: RepoAccess         // scoped read/grep within sandbox checkout
  memory: MemoryClient     // code_knowledge / decisions / patterns
  datadog?: MonitoringClient // present only post-merge (L3)
}

type CheckSource = {
  id: string
  layer: 'gate' | 'ai' | 'monitor'   // gate = L1 GitHub checks, ai = L2 agents, monitor = L3
  appliesTo: (ctx: RunContext) => boolean
  run: (ctx: RunContext) => Promise<Verdict>
}

type Policy = {
  riskEscalateThreshold: number
  escalateOnDisagreement: boolean
  alwaysEscalatePaths: string[]   // sensitive globs
}

type RepoConfig = {
  id: string
  ragInclude: string[]
  sensitivePaths: string[]
  requiredChecks?: 'all' | string[]   // which existing GitHub checks gate (default: all)
  agents: string[]                    // which L2 agents run
}
```

Factory (AI agents are pure declaration):

```ts
// (dependencies) => (arguments)
const createAiAgent = ({ sdk }) => ({ id, instructions, tools, outputSchema, toVerdict }): CheckSource => ({
  id, layer: 'ai', appliesTo: () => true,
  run: async (ctx) => toVerdict({ id, result: await sdk.run({ instructions, tools, outputSchema, context: ctx }) }),
})
```

Orchestrator core:

```ts
const green = await vcs.awaitAllChecks({ pr, required: repoConfig.requiredChecks ?? 'all' })  // LAYER 1 gate
if (!green.allPassed) return blockOrWait(green)
const agents = registry.filter((s) => s.layer === 'ai' && s.appliesTo(ctx))                   // LAYER 2
const verdicts = await Promise.all(agents.map((s) => s.run(ctx)))
const decision = decide({ verdicts, gate: green, policy })
```

## 6. DashboardApi surface

The DashboardApi is a **tRPC router** (`@autogate/api`), not REST. It is the single typed contract for the orchestrator/API ↔ dashboard seam: the server serves `appRouter` over a framework-free tRPC standalone adapter; the dashboard imports only the `AppRouter` *type* and gets end-to-end inference (rename a procedure field → the dashboard fails to compile). The dashboard consumes it via the modern `@trpc/tanstack-react-query` integration (typed `queryOptions` + native TanStack Query hooks). No auth for hackday.

**The router delegates to an injected `DashboardApi` provider** (the port in `@autogate/contracts`). The procedure *shapes* are the contract and are fixed; only the provider swaps. A rich in-memory mock provider (`apps/api/src/mock-dashboard.ts`) ships now so the dashboard builds every surface in parallel; ticket 01 injects the real Store/orchestrator-backed provider — a one-line change at the server boundary, no router/procedure/dashboard edits.

```ts
appRouter = {
  health:  query() → { status: 'ok'; time: string }                          // liveness
  runs: {
    list:      query({ repo?, status?, cursor?, limit? }) → RunsListResponse  // { items: RunSummary[], nextCursor? }
    byId:      query({ runId })                   → RunDetail
    override:  mutation({ runId, action, reason }) → RunDetail                // action: 'approve_merge' | 'block'
    rollback:  mutation({ runId })                → RunDetail
  }
  metrics: query()                                → TrustMetrics
  repos:   query()                                → RepoSummary[]
}
```

**Not yet implemented — live SSE deltas:** the spec's `stream` (RunSummary deltas) and `runs.onUpdate` (RunDetail deltas) map to tRPC v11 SSE subscriptions. They'll be added without changing any existing procedure. Until then the dashboard stays fresh via refetch/invalidation on the queries above.

Inputs are Zod-validated; the SSE streams map to tRPC v11 SSE **subscriptions** (`httpSubscriptionLink`). All payload types below are unchanged from the REST design.

```ts
type RunSummary = {
  runId: string
  pr: { number: number; title: string; repo: string; author: string; url: string; branch: string }
  status: 'awaiting_checks' | 'running' | 'completed'   // awaiting_checks = Layer 1 not yet green
  decision: 'pending' | 'auto_merge' | 'escalate' | 'blocked' | 'merged' | 'rolled_back'
  riskScore: number
  gate: { total: number; passed: number; failed: number; pending: number }   // Layer 1 GitHub checks
  checkSummary: { pass: number; warn: number; fail: number; pending: number } // Layer 2 agents
  createdAt: string; updatedAt: string
}
type CheckResult = Verdict & { layer: 'gate' | 'ai' | 'monitor'; durationMs: number }
type RunDetail = RunSummary & {
  gateChecks: { name: string; conclusion: string; url?: string }[]   // raw GitHub checks incl. bugbot
  checks: CheckResult[]                                              // Layer 2 verdicts
  decision: { outcome: RunSummary['decision']; riskScore: number; reasons: string[]; brief?: string }
  monitoring?: { canaryPercent: number; newErrors: number; window: string; rolledBack: boolean }
  timeline: { at: string; event: string }[]
}
type TrustMetrics = {
  agreementRate: { date: string; rate: number }[]
  escalation: { precision: number; recall: number }
  overridesPerWeek: { week: string; count: number }[]
}
type RepoSummary = { id: string; name: string; agents: string[] }
```

## 7. Evals & the trust loop

- **Per-agent (verify each agent):** `agents/<id>/evals/*.json` = fixture PR + expected verdict labels. `pnpm agent eval <id>` replays against `AgentSdk` (real or mock), scores status / risk-band / key findings. Run it to confirm an agent works after changing it — focused fixtures, not exhaustive.
- **End-to-end (orchestrator accuracy):** replay labeled fixture PRs through the orchestrator against mocks; assert final `Decision` vs ground truth; report escalation **precision/recall**.
- **Override → learning (no fine-tuning):** a dashboard override writes to `overrides` store + `decisions` memory (embed diff + verdicts + human decision + reason). Two channels: (a) **runtime retrieval** — new PRs pull similar precedent as few-shot context; (b) **eval growth** — each override becomes a labeled fixture feeding the agreement-rate metric.

## 8. Stack

TypeScript monorepo **scaffolded via `create-turbo`** (pnpm workspaces + Turborepo). Functional style, strict types. Orchestrator/API: Node + **tRPC v11** (standalone adapter, `apps/api`) — the typed contract lives in `packages/api` (`@autogate/api`). Agent runtime: Claude Agent SDK. Sandbox: Docker. Store: Postgres + Drizzle. Queue: Postgres table. Memory: Qdrant. Dashboard: Next.js (the scaffold's `apps/web`), consuming tRPC via `@trpc/tanstack-react-query` + TanStack Query v5. Monitoring: Datadog MCP. Infra: `setup.sh` + `docker-compose.yml` + `infra/repo-configs/{askable,autogate}.ts`. Verification gate per step: `turbo check-types` + exercising the artifact (no test framework / no exhaustive suites).

## 9. Build order

**Phase 0 (blocks all):** `contracts` + an in-mem mock for every port. (Monorepo scaffold already in place — agents add `apps/*` and `packages/*` per tickets.) Then all packages build in parallel against contracts + mocks across two streams. **Integration phase (last):** swap mocks for real adapters, boot on EC2, run both demo repos end-to-end, author seeded demo PRs. See `tickets/`.

## 10. Demo narrative (seeded PRs)

1. Clean copy tweak → all GitHub checks green → agents pass → **auto-merge**.
2. Risky/high-blast-radius change → checks green → agents agree (risk 55) → merges with monitoring.
3. Auth change → checks green, but **security + architecture agents flag** a sensitive-path concern → **escalate w/ brief** → human override w/ reason → captured to memory + eval.
4. Merged change that degrades → **Datadog** flags new errors → **rollback**.
5. Dogfood: a PR opened on `autogate` itself is reviewed by the system.

## 11. Risks / open items

- **Layer 1 gate must be installed + required on both repos.** We build the workflows (ticket 14) so `autogate` is self-contained; for `askable-services` apply the template and confirm bugbot is enabled and the checks are marked required (else the gate is not meaningful).
- **`awaitAllChecks` latency** — bugbot/CI can be slow; the gate must poll `check_suite` completion and handle long waits without blocking workers.
- Qdrant ingestion time for a large repo; scope `ragInclude` tightly.
- Datadog MCP availability in the runtime env (synthetic-feed mock keeps the demo deterministic).
