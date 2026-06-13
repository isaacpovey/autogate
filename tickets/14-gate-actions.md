---
id: 14-gate-actions
title: Layer 1 gate workflows (GitHub Actions)
stream: A
depends_on: []
phase: 1
---

# 14 — Layer 1 gate workflows (GitHub Actions)

## Goal
Build the **GitHub Actions workflows that produce the Layer 1 checks Autogate gates on**, so the gate doesn't depend on a repo happening to have CI already. Fully wire the `autogate` repo's own gate (dogfood), and provide a reusable template other repos (e.g. `askable-services`) can adopt.

## Owns
- `.github/workflows/` in the `autogate` repo (its real gate).
- `infra/gate-template/` — a portable workflow + setup README for adopting the same gate on another repo.

## Deliverables
- **`gate.yml`** (runs on `pull_request`): jobs for `check-types`, `lint`, and `build` via `pnpm turbo run <task>` (pnpm + Node setup, turbo remote cache optional). Each job surfaces as a distinct GitHub **check run**. A `test` job is included but only runs if test scripts exist (no exhaustive suites required — see project conventions).
- **Bugbot/CodeRabbit wiring:** the config the repo needs for bugbot to run on PRs (e.g. `.coderabbit.yaml`) + a note that it's a GitHub App install. Bugbot's check is one of the Layer 1 checks.
- **Required-checks setup:** document/script the branch-protection settings (or the `RepoConfig.requiredChecks` list) so the gate is meaningful — Autogate only proceeds when these are green.
- **`infra/gate-template/`:** the same workflow parameterized + a short README so `askable-services` (or any repo) can drop it in. Note where askable already has CI, the template just adds anything missing.

## Definition of Done
- `pnpm turbo check-types` passes (for any helper scripts added).
- Opening a PR on `autogate` triggers `gate.yml`; the jobs appear as check runs that `VcsProvider.listCheckRuns` (ticket 04) can read, and `awaitAllChecks` resolves green when they pass / not-green on failure.
- The template applied to a scratch repo produces the same check runs.

## Notes
- This is what makes dogfooding self-contained: `autogate`'s own PRs get a real Layer 1 gate Autogate then reviews.
- Keep the workflow fast (cache pnpm + turbo) so `awaitAllChecks` latency stays low — that's the integration-phase risk.
- These checks mirror the Notion brief's Layer 1 (tests, lint, static type checking) as deterministic, non-negotiable gates.
