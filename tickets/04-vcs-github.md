---
id: 04-vcs-github
title: VcsProvider (GitHub)
stream: A
depends_on: [00-contracts]
phase: 1
---

# 04 — VcsProvider (GitHub)

## Goal
Implement `VcsProvider` over a GitHub App: read PRs/diffs, post status + the escalation brief, merge, and — for external checks — list and **await** named check runs.

## Owns
`packages/vcs-github` — GitHub App auth + REST/GraphQL adapter.

## Deliverables
- `getPR`, `getDiff` → `PullRequest` (intent/description + unified diff).
- `postStatus({ pr, state })` and `postBrief({ pr, brief })` (PR comment / check output).
- `merge({ pr })`.
- `listCheckRuns({ pr })` and `awaitCheck({ pr, name, timeoutMs })` — poll the Checks API until the named check completes; timeout → resolve as a `warn`/`needs_human` signal for the external-check adapter to map.
- Webhook handler stub that enqueues a job (wired in integration).

## Definition of Done
- Contract test against mock parity for `getPR`/`getDiff`/`listCheckRuns`.
- Against a live throwaway test PR: reads PR + diff, posts a comment, lists check runs.
- `awaitCheck` returns promptly on completion and honors `timeoutMs`.

## Notes
- Repo-agnostic: same adapter serves `askable-services` and `autogate` — selection is via `RepoConfig`, not code.
- Keep secrets in `.env`; never log tokens.
