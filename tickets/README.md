# Autogate — Tickets

Decomposition of the hackday build. Each ticket is **one package = one owner = one unit of work**, designed to be executed by an agent (point Claude at the ticket file).

Full design context: [`docs/superpowers/specs/2026-06-13-autogate-design.md`](../docs/superpowers/specs/2026-06-13-autogate-design.md).

## Conventions (apply to every ticket)

- **Monorepo is already scaffolded** via `create-turbo` (pnpm workspaces + Turborepo). Add new work as `packages/*` (libraries/adapters) and `apps/*` (orchestrator API, dashboard). The dashboard is the scaffold's `apps/web`.
- **Verify every step — don't over-test.** After each change, the agent must prove it works before moving on: `pnpm turbo check-types` passes **and** it runs the actual artifact (the CLI command, a small smoke script, the agent against a fixture, the endpoint) and confirms correct output. Write **targeted** checks for core behavior and contract boundaries — do **not** write exhaustive unit tests for every function.
- **Evals are the verification mechanism for agent behavior** — run them to confirm an agent works; just keep them focused, not exhaustive.
- Build against `contracts` + in-memory mocks — never against another package's half-finished adapter.
- Functional style: `(dependencies) => (arguments)`, destructured objects, no mutation.

## Layer model

- **Layer 1 — gate:** all *existing* GitHub checks (CI, lint, types, **bugbot**, etc.) pass → Autogate kicks off. We read check runs; we don't re-run them.
- **Layer 2 — AI agents:** semantic, blast-radius, risk, pattern, security, architecture (read diff + repo + RAG; no app boot).
- **Layer 3 — monitoring (post-merge):** Datadog MCP — new errors correlated to the change → canary/rollback.

## Build order

- **Phase 0 — blocks everything:** `00-contracts` (ports, `Verdict`, `CheckSource`, `RunContext`, `RepoConfig`, `DashboardApi`) + an in-mem mock per port.
- **Phase 1 — parallel fan-out:** tickets `01`–`13`, split across two streams.
- **Phase 2 — integration (last):** `14-integration`.

## Tickets

| # | Ticket | Stream | Depends on |
|---|---|---|---|
| 00 | [contracts + mocks](./00-contracts.md) | shared | — |
| 01 | [orchestrator + decide/policy](./01-orchestrator.md) | A | 00 |
| 02 | [sandbox (Docker) — clone + read](./02-sandbox.md) | A | 00 |
| 03 | [store-postgres (+queue, migrations)](./03-store-postgres.md) | A | 00 |
| 04 | [vcs-github (+ awaitAllChecks gate)](./04-vcs-github.md) | A | 00 |
| 05 | [memory-qdrant + ingestion](./05-memory-qdrant.md) | A | 00 |
| 06 | [infra: setup.sh + compose + repo-configs](./06-infra.md) | A | 00 |
| 07 | [agent-sdk + factory](./07-agent-sdk.md) | B | 00 |
| 08 | [agents (6 L2)](./08-agents.md) | B | 07 |
| 09 | [Layer 1 gate — GitHub checks incl. bugbot](./09-layer1-gate.md) | B | 04 |
| 10 | [monitoring-datadog (L3)](./10-monitoring-datadog.md) | B | 00 |
| 11 | [dashboard (Next.js / apps/web)](./11-dashboard.md) | B | 00 |
| 12 | [evals harness + fixtures (non-blocking)](./12-evals.md) | B | 00 |
| 13 | [cli](./13-cli.md) | B | 00 |
| 14 | [integration + demo](./14-integration.md) | shared | all |

**Streams:** A = backplane/infra, B = agents/UI/evals. Within a stream, tickets are independent and can run concurrently as separate agents.
