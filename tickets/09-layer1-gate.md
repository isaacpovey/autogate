---
id: 09-layer1-gate
title: Layer 1 gate — GitHub checks (incl. bugbot)
stream: B
depends_on: [04-vcs-github]
phase: 1
---

# 09 — Layer 1 gate (GitHub checks, incl. bugbot)

## Goal
Treat **all existing GitHub checks** (CI, lint, types, **bugbot/CodeRabbit**, and anything else already configured on the repo) as Layer 1 — the precondition that must be fully green before Autogate's Layer-2 agents run. Surface those check runs in the run record and dashboard.

## Owns
`packages/layer1-gate` — aggregation + mapping of GitHub check runs into the run model. (Uses `VcsProvider.listCheckRuns` / `awaitAllChecks` from ticket 04.)

## Deliverables
- `gateFromChecks({ checks, required }) => GateResult` — `{ allPassed, total, passed, failed, pending, raw }` where `raw` is the per-check `{ name, conclusion, url }` list (populates `RunDetail.gateChecks`).
- A `CheckSource` of `layer: 'gate'` (optional) so the gate can also appear as a `Verdict` in the unified list — or keep it as a distinct `GateResult` consumed by the orchestrator. Pick whichever keeps the orchestrator simplest; document the choice.
- Map bugbot/CodeRabbit findings (its check output/comments) into `gateChecks` detail so the dashboard shows *why* a gate check failed.

## Definition of Done
- `pnpm turbo check-types` passes.
- Against the mock `VcsProvider`: all checks success → `allPassed: true`; any failure/pending → `false` with the offending checks listed.
- A repo-config with bugbot enabled shows bugbot as a gate check with its conclusion.

## Notes
- This replaces the old "we re-run tests/lint in a sandbox" model and the separate external-checks abstraction — bugbot is just one of the existing GitHub checks now.
- Gate config lives in `RepoConfig.requiredChecks` (default `'all'`).
