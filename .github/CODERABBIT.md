# CodeRabbit (bugbot) — Layer 1 check

CodeRabbit reviews every PR and posts a `CodeRabbit` check run that Autogate's
Layer 1 gate reads. It is configured by [`/.coderabbit.yaml`](../.coderabbit.yaml).

> **Requires the GitHub App:** install the [CodeRabbit GitHub App](https://github.com/apps/coderabbitai)
> on this repo (Settings → GitHub Apps). The config file alone does nothing
> until the App is installed.

Once installed, add `CodeRabbit` to the repo's required status checks (see
[`infra/gate-template/README.md`](../infra/gate-template/README.md)) so the gate
is meaningful — Autogate only proceeds when this check, plus the `gate.yml`
jobs, are all green.
