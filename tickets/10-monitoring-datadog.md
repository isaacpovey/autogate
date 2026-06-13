---
id: 10-monitoring-datadog
title: MonitoringClient (Datadog MCP) — Layer 3
stream: B
depends_on: [00-contracts]
phase: 1
---

# 10 — Monitoring (Datadog MCP) — Layer 3

## Goal
Implement `MonitoringClient` over the Datadog MCP and the post-merge monitor `CheckSource` (`layer: 'monitor'`) that detects **new errors correlated to a change** and emits a canary/rollback signal.

## Owns
`packages/monitoring-datadog` — Datadog MCP adapter + the monitor source.

## Deliverables
- `MonitoringClient.errorsSince({ deploy, change, window })` → new/regressed error groups attributable to the change.
- `datadog-monitor` `CheckSource`: runs post-merge; `appliesTo` checks `ctx.datadog` present; returns a `Verdict` (`fail`/`needs_human` when new errors spike) that drives canary hold / rollback.
- Maps results into `RunDetail.monitoring` ({ canaryPercent, newErrors, window, rolledBack }).

## Definition of Done
- `pnpm turbo check-types` passes.
- Against the **synthetic-error mock** from ticket 00: a spike of new errors → `fail` verdict + rollback signal; flat baseline → `pass`.
- Correlation logic links errors to the change window/service, not just absolute error count.

## Notes
- Datadog MCP availability in the runtime env is a known risk — the synthetic mock keeps the demo deterministic and is the eval driver.
- Realizes the "Datadog flags it → rollback" beat of the demo narrative.
