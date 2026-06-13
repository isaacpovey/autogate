# Autogate Layer 1 gate — adoption template

This directory holds a portable version of Autogate's Layer 1 gate so any repo
(e.g. `askable-services`) can produce the deterministic check runs Autogate
gates on. The `autogate` repo dogfoods its own copy at
[`/.github/workflows/gate.yml`](../../.github/workflows/gate.yml); this template
is the same workflow, parameterised.

## What Autogate needs from a repo

Autogate's orchestrator calls `VcsProvider.awaitAllChecks({ pr, required })` and
only proceeds to its AI agents (Layer 2) once **all required check runs are
green**. So a repo is "gate-ready" when:

1. A workflow produces check runs named `check-types`, `lint`, `build` (and
   `test` if a suite exists).
2. CodeRabbit ("bugbot") is installed and posts a `CodeRabbit` check run.
3. Those checks are marked **required** in branch protection — otherwise a PR
   can go green-with-failures and the gate is not meaningful.

## Adopting on `askable-services`

`askable-services` already has CI. **Do not replace it** — the template only
adds what is missing for Autogate's gate to read named check runs.

1. **Audit existing checks.** List current required checks:
   ```sh
   gh api repos/askable/askable-services/branches/main/protection \
     --jq '.required_status_checks.checks'
   ```
   If existing jobs already emit `check-types` / `lint` / `build` / `test` check
   runs, you only need step 3 (mark them required) — skip the workflow copy.

2. **Add only the missing checks.** Copy `gate.yml` into
   `askable-services/.github/workflows/`, then trim the jobs that duplicate
   existing CI so each gate check run appears exactly once. Edit the `env` block
   to match the repo:
   | Param | Turborepo repo | Plain pnpm / single package |
   |-------|----------------|------------------------------|
   | `RUN_PREFIX` | `pnpm turbo run` | `pnpm run` |
   | `NODE_VERSION` | match `.nvmrc` / `engines` | same |
   | `INSTALL_CMD` | `pnpm install --frozen-lockfile` | same |

   If the repo uses npm/yarn, swap `pnpm/action-setup` + `cache: pnpm` and the
   `RUN_PREFIX`/`INSTALL_CMD` accordingly; keep the job **names** identical so
   Autogate reads them.

3. **Install CodeRabbit.** Install the
   [CodeRabbit GitHub App](https://github.com/apps/coderabbitai) and copy
   [`/.coderabbit.yaml`](../../.coderabbit.yaml) to the repo root. It posts a
   `CodeRabbit` check run that becomes a Layer 1 check.

## Required-checks / branch-protection settings (makes the gate meaningful)

Mark the gate's check runs **required** on `main`. Use the exact job names as
the contexts. With `gh`:

```sh
gh api -X PUT repos/askable/askable-services/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[checks][][context]=check-types' \
  -f 'required_status_checks[checks][][context]=lint' \
  -f 'required_status_checks[checks][][context]=build' \
  -f 'required_status_checks[checks][][context]=test' \
  -f 'required_status_checks[checks][][context]=CodeRabbit' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews=null' \
  -F 'restrictions=null'
```

Notes:
- `strict: true` requires branches to be up to date with `main` before merge.
- Omit `test` from the required list on repos with no test suite (the `test`
  check is skipped there, and a skipped-but-required check would never go green).
- Add the names of any **existing** askable CI checks Autogate should also wait
  on — they become Layer 1 gate inputs for free.

## Tying it back to `RepoConfig`

The required-check list above must agree with the repo's
[`RepoConfig.requiredChecks`](../../packages/contracts/src/schemas/domain.ts).
`'all'` (the default) waits on every check run on the PR; a string array waits
on exactly those names. Keep branch protection and `requiredChecks` in sync so
the merge button and Autogate gate on the same set.

## Verify it works on a scratch repo

Open a PR; the named jobs should appear as distinct check runs:

```sh
gh pr checks <pr-number> --repo <owner>/<repo>
```

`awaitAllChecks` resolves green when they pass and not-green if any fails —
identical behaviour to the `autogate` dogfood gate.
