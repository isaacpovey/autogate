# Autogate — Hackday Design

**Date:** 2026-06-13
**Source brief:** Notion "Autogate — Overview" (initiative to replace traditional PR review with an automated safety layer).
**Scope of this doc:** A one-day, agent-built hackday system that demonstrates a large percentage of the full Autogate vision end-to-end, on real PRs.

---

## 1. Goal & constraints

- **North star demo:** a real PR (on `askable-services` *or* `autogate` itself) flows through the gate — static checks, AI agents, runtime checks — the orchestrator decides **auto-merge or escalate-with-a-brief**, it shows live in the dashboard, and post-merge monitoring can roll back. Cover a *large percentage* of the full vision, not a narrow slice.
- **Build model:** the system is built **by agents** (sub-agents + Claude workflows), not by hand. The human deliverable is crisp tickets + contracts + evals so agents can execute and self-verify. Unlimited tokens.
- **Parallelism:** work splits across **two development streams** (two laptops). Runtime is single-node for the demo. The constraint this imposes: clean package boundaries + a shared contract so streams never collide.
- **Deployment:** single EC2 instance. `setup.sh` installs Docker + Compose, clones, writes `.env`, runs migrations; `docker-compose up` brings up the whole system (Postgres, Qdrant, orchestrator/API, dashboard, N sandbox workers).

## 2. Core design principles

1. **Everything is a port + adapter.** Every external dependency and subsystem sits behind a typed interface in `contracts`, with one real adapter and an in-memory mock. Nothing imports a concrete adapter; the orchestrator core is pure domain logic over ports. This is what enables parallel build (build against port + mock) and infra-free evals.
2. **Every check produces the same `Verdict`.** Agents, static checks, and external GitHub checks are all `CheckSource`s yielding a uniform `Verdict`. The orchestrator's `decide()` is agnostic to source.
3. **Agents are pure declaration.** An AI agent is a prompt + tool allowlist + Zod output schema + a `toVerdict` mapper, assembled by a factory. Authoring/iterating an agent touches one folder, never the orchestrator.
4. **Policy is data, not code.** Escalation thresholds, disagreement rules, and always-escalate paths live in config so they're tunable without redeploys.
5. **Repo-agnostic.** The backplane is driven by a per-target `RepoConfig` (how to boot, test, ingest for RAG, sensitive paths, which checks are agents vs external). We ship configs for `askable-services` and `autogate`.

## 3. Architecture

```
PR (askable-services | autogate)  ──webhook──►  Orchestrator (Node/Hono)
                                                  │  queue (Postgres) → fan-out → synthesize → decide
                                                  ▼
                                   Sandbox workers (Docker, clone PR ref, RepoConfig)
   Layer 1 Static (run real):      tests · lint · typecheck            (fail-fast)
   Layer 2 AI (Claude SDK + RAG):  semantic · blast-radius · risk · pattern · security · architecture
   Layer 3a runtime (boot app):    web-testing · pen-test
   External checks:                bugbot (CodeRabbit) · existing GH Actions
                                                  │
                                   decide(verdicts, policy) → auto-merge | escalate (+brief)
                                                  ▼
   Layer 3b monitoring:            Datadog MCP — new errors correlated to change → canary/rollback

Cross-cutting:
   Memory (Qdrant):  code_knowledge (RAG) · decisions (verdicts+overrides) · patterns (conventions)
   Store (Postgres): runs · verdicts · escalations · overrides · job queue
   Dashboard (Next.js): release stream · run detail · human override   (against DashboardApi)
   Evals (Vitest): per-agent fixture evals + end-to-end orchestrator-accuracy evals
```

## 4. Ports (interfaces in `contracts`)

| Port | Key methods | Adapter now | Mock |
|---|---|---|---|
| `VcsProvider` | getPR · getDiff · postStatus · postBrief · merge · listCheckRuns · awaitCheck | GitHub App | in-mem PR fixtures |
| `SandboxRunner` | clone(ref) · exec · bootApp · teardown | Docker | git-worktree + subprocess |
| `AgentSdk` | run({instructions, tools, outputSchema, context}) | Claude Agent SDK | canned responses |
| `MemoryClient` | query(collection) · upsert(collection) | Qdrant | in-mem vector stub |
| `Store` | runs · verdicts · escalations · overrides | Postgres + Drizzle | in-mem repository |
| `Queue` | enqueue · claim · complete | Postgres table | in-mem queue |
| `MonitoringClient` | errorsSince(deploy, change) | Datadog MCP | synthetic feed |
| `DashboardApi` | typed HTTP contract (see §6) | Hono routes | mock server |

## 5. Key contracts

```ts
type VerdictStatus = 'pass' | 'warn' | 'fail' | 'needs_human'
type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'
type Finding = { severity: Severity; title: string; detail: string; location?: { file: string; line?: number }; evidence?: string }
type Verdict = { agentId: string; status: VerdictStatus; confidence: number; riskContribution: number; summary: string; findings: Finding[] }

type RunContext = {
  pr: PullRequest          // intent/description + diff
  repo: RepoAccess         // scoped read/grep within sandbox checkout
  memory: MemoryClient     // code_knowledge / decisions / patterns
  app?: RunningApp         // present only when booted (L3a)
  datadog?: MonitoringClient // present only post-merge (L3b)
}

type CheckSource = {
  id: string
  kind: 'agent' | 'external'
  layer: 'static' | 'ai' | 'runtime' | 'monitor' | 'external'
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
  bootCmd?: string; testCmd?: string; lintCmd?: string; typecheckCmd?: string
  ragInclude: string[]; sensitivePaths: string[]
  checks: ({ use: 'agent'; id: string } | { use: 'external'; id: string; checkName: string })[]
}
```

Factories:

```ts
// (dependencies) => (arguments)
const createAiAgent = ({ sdk }) => ({ id, instructions, tools, outputSchema, toVerdict }): CheckSource => ({
  id, kind: 'agent', layer: 'ai', appliesTo: () => true,
  run: async (ctx) => toVerdict({ id, result: await sdk.run({ instructions, tools, outputSchema, context: ctx }) }),
})

const createExternalCheck = ({ vcs }) => ({ id, checkName, mapToVerdict, timeoutMs }): CheckSource => ({
  id, kind: 'external', layer: 'external', appliesTo: () => true,
  run: async ({ pr }) => mapToVerdict({ id, check: await vcs.awaitCheck({ pr, name: checkName, timeoutMs }) }),
})
```

Orchestrator core:

```ts
const applicable = registry.filter((s) => s.appliesTo(ctx))
const verdicts = await Promise.all(applicable.map((s) => s.run(ctx)))
const decision = decide({ verdicts, policy })
```

## 6. DashboardApi surface

(Designer builds the Next.js dashboard against this; mock server available from day one. No auth for hackday.)

```
GET  /api/runs?repo=&status=&cursor=&limit=      → { items: RunSummary[], nextCursor? }
GET  /api/runs/:runId                            → RunDetail
POST /api/runs/:runId/override  { action, reason } → RunDetail   // 'approve_merge' | 'block'
POST /api/runs/:runId/rollback                   → RunDetail
GET  /api/metrics                                → TrustMetrics
GET  /api/repos                                  → RepoSummary[]
GET  /api/stream                  (SSE)          → RunSummary deltas
GET  /api/runs/:runId/stream      (SSE)          → RunDetail deltas
```

```ts
type RunSummary = {
  runId: string
  pr: { number: number; title: string; repo: string; author: string; url: string; branch: string }
  status: 'queued' | 'running' | 'completed'
  decision: 'pending' | 'auto_merge' | 'escalate' | 'blocked' | 'merged' | 'rolled_back'
  riskScore: number
  checkSummary: { pass: number; warn: number; fail: number; pending: number }
  createdAt: string; updatedAt: string
}
type CheckResult = Verdict & { kind: 'agent' | 'external'; layer: string; durationMs: number }
type RunDetail = RunSummary & {
  checks: CheckResult[]
  decision: { outcome: RunSummary['decision']; riskScore: number; reasons: string[]; brief?: string }
  monitoring?: { canaryPercent: number; newErrors: number; window: string; rolledBack: boolean }
  timeline: { at: string; event: string }[]
}
type TrustMetrics = {
  agreementRate: { date: string; rate: number }[]
  escalation: { precision: number; recall: number }
  overridesPerWeek: { week: string; count: number }[]
}
type RepoSummary = { id: string; name: string; checks: { id: string; kind: 'agent' | 'external' }[] }
```

## 7. Evals & the trust loop

- **Per-agent (dev loop):** `agents/<id>/evals/*.json` = fixture PR + expected verdict labels. `pnpm agent eval <id>` replays against `AgentSdk` (real or mock), asserts status / risk-band / key findings, prints pass-rate.
- **End-to-end (orchestrator accuracy):** replay labeled fixture PRs through the whole pipeline against mocks; assert final **decision** vs human ground truth. Reports **escalation precision** (false escalations) and **recall** (missed escalations).
- **Override → learning (no fine-tuning):** a dashboard override writes to `overrides` store + `decisions` memory (embed diff + verdicts + human decision + reason). Two feedback channels: (a) **runtime retrieval** — new PRs pull similar precedent as few-shot context; (b) **eval growth** — each override becomes a labeled fixture and feeds the agreement-rate-over-time metric. The rising agreement curve *is* "trust earned incrementally."

## 8. Stack

TypeScript monorepo (pnpm workspaces + Turborepo, functional style, strict types). Orchestrator/API: Node + Hono. Agent runtime: Claude Agent SDK. Sandbox: Docker. Store: Postgres + Drizzle. Queue: Postgres table. Memory: Qdrant. Dashboard: Next.js + Tailwind + shadcn/ui. Evals: Vitest. Infra: `setup.sh` + `docker-compose.yml` + `infra/repo-configs/{askable,autogate}.ts`.

## 9. Build order

**Phase 0 (blocks all):** `contracts` + an in-mem mock for every port. Then all packages build in parallel against contracts + mocks across two streams. **Integration phase (last):** swap mocks for real adapters, boot on EC2, run both demo repos end-to-end, author seeded demo PRs. See `tickets/` for the full decomposition.

## 10. Demo narrative (seeded PRs)

1. Clean copy tweak → all checks pass → **auto-merge**.
2. Risky change (high blast radius) → risk 55, agents agree → merges with monitoring.
3. Auth change → security agent and **bugbot disagree**, touches sensitive path → **escalate with brief**; human overrides with reason → captured to memory/eval.
4. Merged change that degrades → **Datadog** flags new errors → **rollback**.

## 11. Risks / open items

- **Booting `askable-services` in the sandbox** (L3a) is the biggest unknown — depends on a clean `bootCmd` + seed. Mitigation: prove the boot first; fall back to boot-once if per-run is too slow.
- GitHub App setup + `awaitCheck` polling latency for external checks (bugbot can be slow → timeout → `warn`).
- Qdrant ingestion time for a large repo; scope `ragInclude` tightly for the demo.
- Datadog MCP availability in the runtime environment.
