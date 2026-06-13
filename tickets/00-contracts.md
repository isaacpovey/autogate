---
id: 00-contracts
title: Contracts + mocks (the spine)
stream: shared
depends_on: []
phase: 0
---

# 00 — Contracts + mocks

## Goal
Define every shared type, port (interface), and the `DashboardApi` schema, plus an in-memory mock for every port. This package is the single dependency of every other package and **must land before Phase 1 starts**.

## Owns
`packages/contracts` — the only package other packages may import for types. No runtime adapters here.

## Deliverables
- Zod schemas + inferred TS types for: `Verdict`, `Finding`, `Severity`, `VerdictStatus`, `RunContext`, `PullRequest`, `CheckSource`, `Policy`, `RepoConfig`.
- Port interfaces: `VcsProvider` (incl. `awaitAllChecks`, `listCheckRuns`), `SandboxRunner`, `AgentSdk`, `MemoryClient`, `Store`, `Queue`, `MonitoringClient`.
- `DashboardApi` request/response schemas (`RunSummary`, `CheckResult`, `RunDetail`, `TrustMetrics`, `RepoSummary`) — see spec §6. **Note:** the `DashboardApi` is exposed as a **tRPC router** (`@autogate/api`), not REST — these Zod schemas + the `DashboardApi`/`Store` ports are consumed directly by it (the tRPC router delegates to an injected `DashboardApi` provider).
- `packages/contracts/mocks/*` — an in-memory implementation of every port (deterministic, seedable) so all Phase-1 packages build without infra.

## Contract (authoritative source: spec §4–§6)
```ts
type Verdict = { sourceId: string; status: 'pass'|'warn'|'fail'|'needs_human'; confidence: number; riskContribution: number; summary: string; findings: Finding[] }
type RunContext = { pr: PullRequest; repo: RepoAccess; memory: MemoryClient; datadog?: MonitoringClient }
type CheckSource = { id: string; layer: 'gate'|'ai'|'monitor'; appliesTo: (ctx: RunContext) => boolean; run: (ctx: RunContext) => Promise<Verdict> }
type RepoConfig = { id: string; ragInclude: string[]; sensitivePaths: string[]; requiredChecks?: 'all'|string[]; agents: string[] }
// ...full set in spec §5–§6
```

## Definition of Done
- `pnpm turbo check-types` passes for `contracts`; all schemas export inferred types.
- Every port has a mock that **satisfies its interface at compile time** (no `as`/`any`); a tiny `tsx` smoke script round-trips seed data through each mock.
- A consumer can `import { Verdict, mockStore } from '@autogate/contracts'` and compile.

## Notes
- Functional style: `(dependencies) => (arguments)`, destructured objects, no mutation. No test framework.
- Mocks are the contract for parallel work — realistic enough that swapping the real adapter in Phase 2 needs no consumer changes.
