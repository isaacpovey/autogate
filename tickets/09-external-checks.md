---
id: 09-external-checks
title: External checks (bugbot, existing GH Actions)
stream: B
depends_on: [07-agent-sdk]
phase: 1
---

# 09 — External checks

## Goal
Integrate third-party / existing GitHub checks as first-class `CheckSource`s via `createExternalCheck`, so any agent can be swapped for an external action through `RepoConfig` alone.

## Owns
`packages/external-checks/` — one `mapToVerdict` per external tool.

## Deliverables
- `bugbot` mapper — awaits the CodeRabbit/Bugbot check; maps conclusion + scraped review comments → `Verdict.findings`.
- `ci` mapper — maps an existing GitHub Actions build/test workflow conclusion → `Verdict` (can serve as the Layer-1 static gate when config says so).
- Generic `githubCheck` mapper for any pass/fail check by name.

## Definition of Done
- Against the mock `VcsProvider`: a `success` check → `pass`; `failure` → `fail` with findings; missing/timeout → `warn`/`needs_human`.
- A `RepoConfig` with `{ use: 'external', id: 'bugbot', checkName: 'CodeRabbit' }` produces a `CheckSource` the orchestrator runs with zero orchestrator changes.

## Notes
- This is the payoff of the `CheckSource` abstraction — prove the "replace an agent with an external action via one config line" story end-to-end.
- Bugbot can be slow; set a sensible `timeoutMs` and surface timeouts as `warn`, not silent pass.
