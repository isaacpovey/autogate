# Autogate — Tickets

Decomposition of the hackday build. Each ticket is **one package = one owner = one unit of work**, designed to be executed by an agent (point Claude at the ticket file).

Full design context: [`docs/superpowers/specs/2026-06-13-autogate-design.md`](../docs/superpowers/specs/2026-06-13-autogate-design.md).

## How to use

Point an agent at a single ticket file. Each ticket is self-contained: goal, the contract it owns/consumes, deliverables, and a **Definition of Done** that is a runnable gate (tests/evals). Build against `contracts` + in-memory mocks — never against another package's half-finished adapter.

## Build order

- **Phase 0 — blocks everything:** `00-contracts`. Must land first (ports, `Verdict`, `CheckSource`, `RunContext`, `RepoConfig`, `DashboardApi`) + an in-mem mock per port.
- **Phase 1 — parallel fan-out:** tickets `01`–`13`, split across two streams. All depend only on `contracts` + mocks.
- **Phase 2 — integration (last):** `14-integration`. Swap mocks for real adapters, boot on EC2, run both demo repos, author seeded demo PRs.

## Tickets

| # | Ticket | Stream | Depends on |
|---|---|---|---|
| 00 | [contracts + mocks](./00-contracts.md) | shared | — |
| 01 | [orchestrator + decide/policy](./01-orchestrator.md) | A | 00 |
| 02 | [sandbox (Docker)](./02-sandbox.md) | A | 00 |
| 03 | [store-postgres (+queue, migrations)](./03-store-postgres.md) | A | 00 |
| 04 | [vcs-github](./04-vcs-github.md) | A | 00 |
| 05 | [memory-qdrant + ingestion](./05-memory-qdrant.md) | A | 00 |
| 06 | [infra: setup.sh + compose + repo-configs](./06-infra.md) | A | 00 |
| 07 | [agent-sdk + factories](./07-agent-sdk.md) | B | 00 |
| 08 | [agents (6 L2 + 2 L3a)](./08-agents.md) | B | 07 |
| 09 | [external checks (bugbot, CI)](./09-external-checks.md) | B | 07 |
| 10 | [monitoring-datadog (L3b)](./10-monitoring-datadog.md) | B | 00 |
| 11 | [dashboard (Next.js)](./11-dashboard.md) | B | 00 |
| 12 | [evals harness + fixtures](./12-evals.md) | B | 00 |
| 13 | [cli](./13-cli.md) | B | 00 |
| 14 | [integration + demo](./14-integration.md) | shared | all |

**Streams:** A = backplane/infra, B = agents/UI/evals. Within a stream, tickets are independent and can run concurrently as separate agents.
