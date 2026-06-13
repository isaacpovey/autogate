# Autogate — Dashboard ("Full Instrument") Design

**Date:** 2026-06-13
**Ticket:** `tickets/11-dashboard.md` (Stream B, phase 1)
**Source design:** Claude Design handoff bundle `Autogate.html` (warm-graphite release-safety instrument; React/HTML prototype). User iterated the visuals to completion; this doc covers porting them into `apps/web` wired to the real tRPC `DashboardApi`.
**Scope of this doc:** the implementation design — architecture, the prototype→API data reconciliation, component inventory, styling, and testing. Approved 2026-06-13.

---

## 1. Goal & constraints

- **Build the full instrument** in `apps/web`: app shell (collapsible rail, topbar, dark/light, toast), **Open reviews** (release stream), **Run detail**, and **Stats/Trust** — pixel-faithful to the prototype, wired to the live tRPC API.
- **Recreate the visual output, not the prototype's structure.** The prototype is HTML/inline-style/`window.AG` globals; the target is idiomatic Next.js 16 App Router + React 19 + TypeScript, Tailwind v4 + shadcn/ui.
- **Wire to the real contract, don't change it.** The dashboard consumes `@autogate/api`'s `AppRouter` type end-to-end (`runs.list`, `runs.byId`, `runs.override`, `runs.rollback`, `metrics`, `repos`). Swapping the mock `DashboardApi` for the real Store-backed one requires **no component changes** (ticket 11 DoD).
- **No invented data.** Surfaces render only what `TrustMetrics`/`RunDetail` actually provide. The brief's own rule: *do not invent extra product features, data fields, or generic analytics panels.*
- **Decision clarity > everything.** When a tradeoff arises, choose the design that makes the human more confident making the right call.

### Out of scope
Settings, My runs, auth, real SSE streaming, and the prototype's invented analytics panels (stacked "where changes go", recent-rollbacks list, shipped/30d, median-TTM). These are explicitly cut.

---

## 2. Architecture

### 2.1 Routing (Next.js App Router)
Route-based navigation replaces the prototype's in-memory `view` state. Each route is a Server Component that prefetches its query into a per-request `QueryClient`, wraps children in `HydrateClient`, and renders a client view using `useSuspenseQuery` against the prefetched cache — the exact pattern already in `apps/web/app/page.tsx`.

| Route | Surface | RSC prefetch | Notes |
|---|---|---|---|
| `/` | Open reviews (release stream) | `runs.list({ limit })`, `repos`, `metrics` | `?repo=<id>` filter via search param; `?status=` optional |
| `/runs/[runId]` | Run detail | `runs.byId({ runId })` | shareable URL; back button returns to `/` |
| `/stats` | Trust | `metrics`, `repos` | |

All three sit under a dashboard **layout** (`app/(dashboard)/layout.tsx`) that renders the client `AppShell` (rail + topbar + toast region) around `{children}`. `export const dynamic = "force-dynamic"` on the data routes (already established in `page.tsx`) — the API isn't reachable at build time.

### 2.2 App shell (client)
`AppShell` owns rail collapse state, theme, and toast. The rail uses `next/link` + `usePathname` for active state; repo filter items link to `/?repo=<id>`. Topbar lives above `{children}`.

- **Rail:** brand lockup/emblem, primary nav (Open reviews / Stats), `Repositories` group from the `repos` query (each with a "needs you" count derived from a lightweight `runs.list` client query), footer with theme toggle + collapse. "My runs"/"Settings" nav items are omitted (out of scope).
- **Topbar:** incident indicator (derived) or "all systems nominal"; agreement % (latest `metrics.agreementRate`); **live/reconnecting** dot bound to *real* TanStack Query fetch/error status; the `+` button is informational (runs are CI-created).
- **Toast:** transient confirmation after override/rollback.

### 2.3 Data flow & live freshness
- **Reads:** RSC prefetch → `useSuspenseQuery`. `runs.list` (stream) and the open `runs.byId` (detail) carry a `refetchInterval` (≈5 s) so the UI stays fresh without SSE. The topbar live dot reflects `isFetching`/error rather than a simulated blip.
- **Writes:** `runs.override` / `runs.rollback` via `useMutation(trpc.runs.override.mutationOptions())`; on success invalidate `runs.byId` + `runs.list` and fire a toast. The mutation returns the updated `RunDetail`, so the detail view updates immediately.
- **No SSE:** `root.ts` confirms `stream`/`runs.onUpdate` are deferred; polling + invalidation is the sanctioned approach (ticket 11).

### 2.4 View-model module (`apps/web/lib/view-model.ts`)
Pure, dependency-free, unit-tested functions — the derivation logic the prototype computed in `data.js`, ported to the real types. This is the TDD core.

- `riskBand(score) → 'low'|'mid'|'high'` (≥60 high, ≥30 mid)
- `effortBand(run) → 'quick'|'moderate'|'deep'` (from checkSummary spread + disagreement + risk + needs_human count) and `effortOrder`
- `disagreement(detail) → { conflict, stance }` across the three layers (gate / ai / monitor)
- `layerStance(checks, layer)` and gate stance from `gate`/`gateChecks`
- `groupRuns(summaries) → { incident, needsYou, inProgress, inProduction, autoMerged }` with the prototype's sort rules (needs-you quick→deep; auto riskiest-first)
- `deriveIncident(detail|summary) → boolean` (merged + monitoring present + not rolledBack + rising errors)
- `recordedReasonFrom(detail) → { actor?, at?, reason } | null` (parse the override reason appended to `decision.reasons`/`timeline`)
- `fmtDuration(ms)`, `fmtTimeLabel(iso)` (compact clock/relative), `agreementPct(rate)` (×100, handles 0–1)
- Style maps: `VERDICT`, `DECISION_STYLE` (+ `awaiting_checks`), `SPINE`/layer labels

---

## 3. Data reconciliation (prototype → real API)

Authoritative types: `packages/contracts/src/schemas/{domain,dashboard}.ts`. The prototype assumed a looser shape and invented fields; the real contract is the source of truth.

| Concept | Prototype | Real API | Resolution |
|---|---|---|---|
| status | `queued`/`running`/`completed` | `awaiting_checks`/`running`/`completed` | `awaiting_checks` → **In-progress** tier; row shows gate progress `gate.passed/total` |
| verdict | `pass`/`warn`/`fail`/`inconclusive` | `pass`/`warn`/`fail`/**`needs_human`** | `needs_human` renders as the prototype's slate **"inconclusive"** glyph/tone, labeled *needs human* |
| check identity | `check.kind` | `Verdict.sourceId` | use `sourceId` as the check name |
| finding | `check.finding` (string) + `check.detail` | `Verdict.summary` + `Verdict.findings[]` (`{severity,title,detail,location?,evidence?}`) | `summary` = the one-line finding; `findings[]` = expandable agent detail (severity, file:line, evidence) |
| layers | `static`/`ai`/`monitoring` | `gate`/`ai`/`monitor` | **Static = `gateChecks`** (Layer-1 GitHub checks: name + conclusion + url); **AI = `checks` where `layer==='ai'`**; **Monitoring = `monitoring` panel + `layer==='monitor'` checks** |
| gate | folded into "Static" checks | `gate{total,passed,failed,pending}` + `gateChecks[]` | first-class: gate progress on rows; gateChecks rendered as the Static evidence group (ticket 11) |
| decision detail | `decisionInfo` | `RunDetail.decision{outcome,riskScore,reasons,brief?}` | direct map |
| monitoring | invented per-run | `monitoring?{canaryPercent,newErrors,window,rolledBack}` | direct map; drives in-production card + monitoring evidence + incident |
| timeline emphasis | `timeline[].emphasis` | `timeline[]{at,event}` only | emphasis derived heuristically from event text (override/rolled back/failed) or rendered uniformly; no fabricated field |
| `incident`, `effort`, `autoWhy`, `overridden` | invented fields | not in API | **derived** in `view-model.ts` (see §2.4); recorded reason parsed from override output |
| agreement rate | 0–100 (`71`) | **0–1** (`0.82`); ISO/`YYYY-Www` date strings | charts/topbar convert via `agreementPct`; x-axis uses real date/week labels |
| Stats panels | summary strip + 2 callouts + 3 charts + rollbacks list | only `agreementRate`, `escalation{precision,recall}`, `overridesPerWeek` | **keep:** agreement line chart, escalation precision/recall callouts, overrides bar chart, derived summary strip. **drop:** stacked outcomes, recent-rollbacks, shipped/30d, median-TTM (no data) |

**Mock reality:** `apps/api/src/mock-dashboard.ts` ships 5 fixtures (auto_merge, escalate, awaiting_checks, running, rolled_back) and sparse metrics. The incident bar / in-production-degrading path is dormant under current fixtures (none are merged-and-degrading) and lights up automatically when real data arrives. Every surface must render gracefully against this set, including empty states.

---

## 4. Component inventory

Organized under `apps/web/components/` (client components; `"use client"` where they use hooks/interaction). Each view is composed from primitives.

- **shell/**: `AppShell`, `Rail`, `RailItem`, `Topbar`, `Toast`, `ThemeProvider`, `ThemeToggle`, `Emblem` (inline SVG paths from prototype), `Lockup` (recolored `currentColor` SVG).
- **primitives/**: `Icon` (lucide-react wrapper), `VerdictGlyph` (bespoke shape-per-verdict SVG, with `needs_human`→slate), `RiskDot`, `RiskNumeral`, `EffortPill`, `StatusPill` (decision/status, +`awaiting_checks`), `Avatar`, `TallyTiles`, `TallyInline`, `Sparkline`, `Spine`/`LayerMarker`.
- **stream/** (`/`): `ReleaseStream`, `StreamToolbar` (title + `Segmented` status filter), `RepoFilterChip`, `IncidentBar`, `GroupHeader`, `StreamColHeader`, `RunRow`, `GateProgress` (awaiting_checks), `ProdCard`, `AutoRow`, `EmptyNeedsYou`.
- **run-detail/** (`/runs/[runId]`): `RunDetail`, `DetailHeader` (status pill + title + PR meta + `RiskNumeral`), `TallyTiles`, `OrchestratorBrief`, `AssessingPanel` (running), `Evidence` → `GateChecksGroup` (Static) + `LayerGroup` (AI) + `MonitoringRow` (Monitoring) + future-note, `CheckRow` (expandable findings), `ActionBlock` (reason-gated approve/block), `RollbackBlock`, `RollbackProgress`, `AutoMergedFooter`, `ConfirmedSummary`, `ConfirmModal` (shadcn Dialog), `Timeline`.
- **stats/** (`/stats`): `TrustView`, `StatTile`, `QualityCallout` (+ sparkline), `Panel`, `AgreementChart` (line, hover, axes), `OverridesChart` (bar, axes).

shadcn primitives used (themed to tokens): **Dialog** (ConfirmModal), **Switch**, **Slider**, **Tabs**/**ToggleGroup** (Segmented), **Tooltip**, **Button**, **Separator**, **Skeleton** (loading).

---

## 5. Styling & tokens

- **Token layer:** port `tokens.css` into `app/globals.css` as `:root`/`[data-theme="light"]` — warm-graphite surfaces, warm-taupe text scale, hairlines, brand red (scarce), earthy verdict palette (pass/warn/fail/incon/info/effort), spine tones, lit-edge shadows, `--shadow-pop`, keyframes (settle/hl/pulse/spin/pop/overlay). Plus the Askable brand `colors_and_type.css` tokens that the prototype binds to.
- **Tailwind v4:** `@import "tailwindcss"`; expose tokens via `@theme inline` so utilities map to tokens (`bg`, `bg-raised`, `bg-rail`, `fg`/`fg-2`/`fg-muted`/`fg-faint`, `line`/`line-2`, `brand`, `pass`/`warn`/`fail`/`incon`/`info`/`effort`, spine colors). Exact px (row heights 60/55/52/46, type 13.5/12.5/11, gaps) preserved via arbitrary values / inline style where fidelity demands.
- **shadcn theming:** map shadcn's semantic CSS vars (`--background`, `--foreground`, `--primary`, `--border`, `--ring`, `--popover`, `--muted`…) onto the warm-graphite tokens so primitives inherit the instrument look. `components.json` for Tailwind v4 / RSC / `lucide-react`.
- **Fonts (`next/font/local`):** Bricolage Grotesque (display → `.display-face`), Instrument Sans (body/UI), TTFs copied from the bundle's `_ds/.../fonts/` into `apps/web/app/fonts/`. Mono = system stack. Tabular/lining numerals (`font-feature-settings: "tnum" "lnum"`) on `.tnum`/`.mono`.
- **Theme:** defaults **dark**; `ThemeProvider` writes `data-theme` to `<html>`, persists to `localStorage`, no-flash inline script in `layout.tsx`.
- **Assets:** copy `autogate-lockup.svg` + emblem paths from the bundle; recolor to `currentColor` for theme-awareness.
- **Icons:** `lucide-react` (DS-canonical Lucide set) for line icons; bespoke SVG kept for emblem/spine/verdict-glyphs/charts.

---

## 6. Testing & verification

- **Unit (Vitest):** `lib/view-model.ts` — `riskBand`, `effortBand`, `disagreement`, `groupRuns` (tier assignment + sort order), `deriveIncident`, `recordedReasonFrom`, `agreementPct`, `fmtDuration`. These encode the load-bearing logic; test them directly.
- **Type safety:** `pnpm turbo check-types` green (web inherits the `AppRouter` type; renaming a server field must break the build).
- **Render verification:** runs against `apps/api`'s mock; manually exercise every fixture state + the override→confirm→recorded-reason and rollback flows, dark/light, rail collapse, empty "Needs you".
- **No exhaustive component coverage** — match the repo's "verify, don't over-test" posture.

---

## 7. Definition of Done

1. `pnpm turbo check-types` passes; `pnpm --filter web lint` clean.
2. All three surfaces render against `apps/api` across every fixture state, including empty/awaiting/running.
3. Override + rollback hit the router and invalidate/optimistically update; reason field required (≥ a few chars) and recorded.
4. Swapping the mock `DashboardApi` for the real Store-backed provider needs no component changes.
5. Dark/light both faithful; route nav (`/`, `/runs/[id]`, `/stats`) with working back button and shareable run URLs.
6. View-model unit tests pass.
