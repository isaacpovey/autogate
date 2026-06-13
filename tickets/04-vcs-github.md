---
id: 04-vcs-github
title: VcsProvider (GitHub) + Layer 1 gate
stream: A
depends_on: [00-contracts]
phase: 1
---

# 04 — VcsProvider (GitHub)

## Goal
Implement `VcsProvider` over a GitHub App: read PRs/diffs, **await all existing checks (the Layer 1 gate)**, post status + the escalation brief, and merge. The webhook triggers a run when a PR's check suite completes green.

## Owns
`packages/vcs-github` — GitHub App auth + REST/GraphQL adapter + webhook handler.

## Deliverables
- `getPR`, `getDiff` → `PullRequest` (intent/description + unified diff).
- `listCheckRuns({ pr })` → all check runs (CI, lint, types, **bugbot**, etc.) with conclusions.
- `awaitAllChecks({ pr, required })` → polls `check_suite` until all required checks complete; returns `{ allPassed, checks }`; honors a timeout (long-running bugbot/CI must not block a worker — yield and re-poll).
- `postStatus({ pr, state })`, `postBrief({ pr, brief })`, `merge({ pr })`.
- Webhook handler: on `check_suite` completed + success → enqueue a run; on PR open with already-green checks → enqueue.

## Definition of Done
- `pnpm turbo check-types` passes; mock parity for `getPR`/`getDiff`/`listCheckRuns`/`awaitAllChecks`.
- Against a live throwaway test PR: reads PR + diff, lists check runs, resolves `awaitAllChecks` when they go green, posts a comment.

## Notes
- Repo-agnostic: same adapter serves `askable-services` and `autogate` — selection via `RepoConfig`.
- `requiredChecks: 'all'` means every check on the suite must pass; a list narrows it. Missing/timeout → gate stays not-green (run waits), surfaced as `awaiting_checks`.
- Keep secrets in `.env`; never log tokens.
