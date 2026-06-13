# Autogate Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Claude Design "Autogate" warm-graphite instrument into `apps/web` — app shell + Open reviews + Run detail + Stats — wired to the live tRPC `DashboardApi`.

**Architecture:** Next.js 16 App Router. Three route-based surfaces (`/`, `/runs/[runId]`, `/stats`) under a dashboard layout that renders a client `AppShell` (rail + topbar + toast). RSC prefetch → `useSuspenseQuery`; polling + invalidation for freshness (no SSE). All visual components are faithful transcriptions of the committed prototype reference, translating inline styles → Tailwind token utilities. A pure, unit-tested `lib/view-model.ts` holds every derivation the prototype computed client-side.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript (strict), Tailwind v4, shadcn/ui, lucide-react, `@tanstack/react-query` + `@trpc/tanstack-react-query`, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-autogate-dashboard-design.md`.

---

## Conventions (read first)

- **Porting is transcription, not invention.** The prototype source is committed in Task 0.1 to `docs/design-reference/autogate-prototype/`. When a task says *"port `RunRow` from `app/stream.jsx:7-39`"*, open that file and reproduce its visual output in TSX. This is complete and unambiguous — the source exists in-repo.
- **Style translation:** prototype inline styles → Tailwind. Use the token mapping from Task 1.4. Common cases use shadcn semantic classes (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`); the verdict/brand palette uses generated utilities (`text-pass`, `bg-pass-tint`, `border-warn-edge`, `text-brand`); exact pixel values that have no token use arbitrary values (`h-[60px]`, `text-[13.5px]`) or `style={{}}`.
- **Types:** import domain types from `@autogate/contracts` via the re-export barrel in Task 2.1. Never re-declare them.
- **Data mapping** (prototype field → real field), applied throughout:
  - `check.kind` → `check.sourceId`; `check.verdict` → `check.status` (`needs_human` renders as the slate "inconclusive" treatment); `check.finding` → `check.summary`; `check.detail`/expandable → `check.findings[]`.
  - layer `static` → the real `gateChecks` group; layer `ai` → `checks.filter(c => c.layer === 'ai')`; layer `monitoring` → `monitoring` panel + `checks.filter(c => c.layer === 'monitor')`.
  - `run.decisionInfo` → `run.decision`; `agreementRate.rate` is **0–1** (multiply by 100 for display).
- **Commit after every task** with the message shown. Run `pnpm --filter web check-types` before each commit in code tasks.
- **Working directory:** repo root `/Users/tyron/Developer/auto-gate`. Dev API: `pnpm --filter api dev` (port 3002) must be running for render checks.

---

## File structure

```
apps/web/
  components.json                         # shadcn config (Task 1.2)
  postcss.config.mjs                      # Tailwind v4 postcss (Task 1.1)
  vitest.config.ts                        # Task 2.2
  next.config.js                          # +@autogate/contracts transpile (Task 1.1)
  tsconfig.json                           # +@/* path alias (Task 1.2)
  app/
    fonts/                                # Bricolage + Instrument Sans TTF (Task 0.1); Geist removed
    globals.css                           # Tailwind import + token layer + base (Task 1.4)
    layout.tsx                            # fonts, theme no-flash, providers (Task 1.5)
    (dashboard)/
      layout.tsx                          # AppShell wrapper (Task 5.1)
      page.tsx                            # Open reviews (Task 6.9)
      runs/[runId]/page.tsx               # Run detail (Task 7.x)
      stats/page.tsx                      # Stats (Task 8.x)
    # REMOVED: page.tsx, _components/runs-list.tsx, page.module.css
  lib/
    utils.ts                              # cn() (Task 1.2)
    api-types.ts                          # contract type barrel (Task 2.1)
    view-model.ts                         # derivations (Task 2.3+)
    view-model.test.ts                    # Vitest (Task 2.3+)
  components/
    ui/                                   # shadcn primitives (Task 1.3)
    shell/      app-shell.tsx rail.tsx topbar.tsx toast.tsx theme-provider.tsx theme-toggle.tsx brand.tsx
    primitives/ icon.tsx verdict-glyph.tsx risk.tsx pills.tsx avatar.tsx tally.tsx sparkline.tsx spine.tsx
    stream/     release-stream.tsx run-row.tsx auto-row.tsx prod-card.tsx incident-bar.tsx group-header.tsx segmented.tsx empty-needs-you.tsx gate-progress.tsx
    run-detail/ run-detail.tsx orchestrator-brief.tsx assessing-panel.tsx evidence.tsx check-row.tsx monitoring-row.tsx action-block.tsx confirm-modal.tsx timeline.tsx
    stats/      trust-view.tsx charts.tsx stat-tile.tsx panel.tsx
docs/design-reference/autogate-prototype/   # committed prototype source (Task 0.1)
```

---

## Phase 0 — Reference & assets

### Task 0.1: Vendor the prototype source, fonts, and lockup into the repo

**Files:**
- Create: `docs/design-reference/autogate-prototype/**` (jsx/css/js + README + chat)
- Create: `apps/web/app/fonts/BricolageGrotesque.ttf`, `apps/web/app/fonts/InstrumentSans-{Regular,Medium,SemiBold,Bold}.ttf`
- Create: `apps/web/components/shell/autogate-lockup.svg.txt` (raw lockup, recolored in Task 4.3)
- Delete: `apps/web/app/fonts/GeistVF.woff`, `apps/web/app/fonts/GeistMonoVF.woff`

- [ ] **Step 1: Copy prototype source as the transcription reference**

```bash
SRC=/tmp/autogate-design/autogate-app
DEST=docs/design-reference/autogate-prototype
mkdir -p "$DEST/app"
cp "$SRC/project/app/"*.jsx "$SRC/project/app/"*.css "$SRC/project/app/"*.js "$DEST/app/"
cp "$SRC/project/Autogate.html" "$DEST/"
cp "$SRC/README.md" "$DEST/HANDOFF-README.md"
cp "$SRC/chats/chat1.md" "$DEST/chat-transcript.md"
cp "$SRC/project/_ds/"*/colors_and_type.css "$DEST/askable-colors_and_type.css"
ls -R "$DEST"
```

> If `/tmp/autogate-design` is gone, re-fetch: `WebFetch https://api.anthropic.com/v1/design/h/U_AIt9HUQNw2zIuWJLZ58Q?open_file=Autogate.html` saves a `.bin`; `tar -xzf <bin> -C /tmp/autogate-design`.

- [ ] **Step 2: Copy fonts into the web app, remove Geist**

```bash
FONTS=/tmp/autogate-design/autogate-app/project/_ds/*/fonts
cp $FONTS/BricolageGrotesque.ttf apps/web/app/fonts/
for w in Regular Medium SemiBold Bold; do cp $FONTS/InstrumentSans-$w.ttf apps/web/app/fonts/; done
rm -f apps/web/app/fonts/GeistVF.woff apps/web/app/fonts/GeistMonoVF.woff
ls apps/web/app/fonts/
```

- [ ] **Step 3: Copy the lockup SVG (recolored later)**

```bash
cp "/tmp/autogate-design/autogate-app/project/app/assets/autogate-lockup.svg" apps/web/components/shell/autogate-lockup.svg.txt
wc -c apps/web/components/shell/autogate-lockup.svg.txt
```

- [ ] **Step 4: Commit**

```bash
git add docs/design-reference apps/web/app/fonts apps/web/components/shell/autogate-lockup.svg.txt
git commit -m "chore(web): vendor Autogate prototype reference + brand fonts/lockup"
```

---

## Phase 1 — Build setup (Tailwind v4 + shadcn + tokens)

### Task 1.1: Install deps + PostCSS + transpile contracts

**Files:**
- Modify: `apps/web/package.json` (deps)
- Create: `apps/web/postcss.config.mjs`
- Modify: `apps/web/next.config.js`

- [ ] **Step 1: Add dependencies**

```bash
pnpm --filter web add tailwindcss@^4 @tailwindcss/postcss@^4 lucide-react class-variance-authority clsx tailwind-merge tw-animate-css
pnpm --filter web add @autogate/contracts@workspace:*
pnpm --filter web add -D vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 2: Create `apps/web/postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

- [ ] **Step 3: Add `@autogate/contracts` to transpilePackages in `next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@autogate/api", "@autogate/contracts"],
};
export default nextConfig;
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/postcss.config.mjs apps/web/next.config.js pnpm-lock.yaml
git commit -m "chore(web): add Tailwind v4, shadcn deps, contracts dep"
```

### Task 1.2: tsconfig path alias + `lib/utils.ts` + `components.json`

**Files:**
- Modify: `apps/web/tsconfig.json`
- Create: `apps/web/lib/utils.ts`
- Create: `apps/web/components.json`

- [ ] **Step 1: Add `@/*` path alias to `apps/web/tsconfig.json`** (merge into `compilerOptions`)

```json
"baseUrl": ".",
"paths": { "@/*": ["./*"] }
```

- [ ] **Step 2: Create `apps/web/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `apps/web/components.json`** (shadcn, Tailwind v4, RSC)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/tsconfig.json apps/web/lib/utils.ts apps/web/components.json
git commit -m "chore(web): tsconfig @/* alias, cn() util, shadcn components.json"
```

### Task 1.3: Add shadcn primitives

**Files:** Create `apps/web/components/ui/{button,dialog,switch,slider,toggle-group,tooltip,separator,skeleton}.tsx`

- [ ] **Step 1: Generate primitives**

```bash
pnpm --filter web dlx shadcn@latest add button dialog switch slider toggle-group tooltip separator skeleton --yes
ls apps/web/components/ui
```

> If the CLI balks at Next 16/React 19, append `--overwrite` or add components individually. These are restyled by the token layer (Task 1.4) — accept defaults.

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/ui apps/web/app/globals.css
git commit -m "feat(web): add shadcn ui primitives"
```

### Task 1.4: Token layer — `globals.css` (the aesthetic foundation)

**Files:** Modify `apps/web/app/globals.css` (full rewrite)

This ports `docs/design-reference/autogate-prototype/app/tokens.css` verbatim, maps shadcn's semantic vars onto the warm-graphite tokens, exposes the verdict/brand palette + fonts to Tailwind via `@theme inline`, and adds the base utilities (`.tnum`, `.mono`, `.label`, `.display-face`, `.scroll`, focus ring, keyframes, `.ag-range`, `.run-row` hover).

- [ ] **Step 1: Write `apps/web/app/globals.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";

/* ===== Warm-graphite token layer (ported from tokens.css) ===== */
:root,
[data-theme="dark"] {
  --bg: #1a1816; --bg-rail: #151311; --bg-raised: #211e1a; --bg-raised-2: #262320;
  --bg-hover: rgba(255,248,236,.035); --bg-active: rgba(255,248,236,.06);
  --lit-edge: inset 0 1px 0 0 rgba(255,244,230,.06);
  --lit-edge-strong: inset 0 1px 0 0 rgba(255,244,230,.09);
  --fg: #ece6dd; --fg-2: #b8afa2; --fg-3: #8a8174; --fg-muted: #6a6256; --fg-faint: #4e4840;
  --line: rgba(255,244,228,.075); --line-2: rgba(255,244,228,.11); --line-strong: rgba(255,244,228,.16);
  --brand: #fb5153; --brand-hover: #ff797b; --brand-tint: rgba(251,81,83,.12); --brand-tint-2: rgba(251,81,83,.20);
  --pass: #8fb07a; --pass-dim: #6e8961; --pass-tint: rgba(143,176,122,.13); --pass-edge: rgba(143,176,122,.55);
  --warn: #cda552; --warn-dim: #9c7e40; --warn-tint: rgba(205,165,82,.13); --warn-edge: rgba(205,165,82,.6);
  --fail: #cc6b54; --fail-dim: #9e5341; --fail-tint: rgba(204,107,84,.14); --fail-edge: rgba(204,107,84,.65);
  --incon: #7e8a98; --incon-dim: #616b77; --incon-tint: rgba(126,138,152,.13); --incon-edge: rgba(126,138,152,.5);
  --info: #6e92bd; --info-dim: #54718f; --info-tint: rgba(110,146,189,.11); --info-edge: rgba(110,146,189,.4);
  --effort: #9c8fb0; --effort-tint: rgba(156,143,176,.13);
  --spine-static: #7e8a98; --spine-ai: #9c8fb0; --spine-mon: #8a9e8e; --spine-rail: rgba(255,244,228,.10);
  --shadow-pop: 0 18px 48px -12px rgba(0,0,0,.6), 0 4px 14px -4px rgba(0,0,0,.5);
}
[data-theme="light"] {
  --bg: #f4f0ec; --bg-rail: #ebe6e0; --bg-raised: #fcfaf7; --bg-raised-2: #fff;
  --bg-hover: rgba(40,30,16,.035); --bg-active: rgba(40,30,16,.06);
  --lit-edge: inset 0 1px 0 0 rgba(255,255,255,.8); --lit-edge-strong: inset 0 1px 0 0 rgba(255,255,255,.9);
  --fg: #211d18; --fg-2: #5c5447; --fg-3: #6e6557; --fg-muted: #8a8175; --fg-faint: #ada597;
  --line: rgba(40,28,12,.10); --line-2: rgba(40,28,12,.14); --line-strong: rgba(40,28,12,.20);
  --brand: #e0383a; --brand-hover: #fb5153; --brand-tint: rgba(224,56,58,.10); --brand-tint-2: rgba(224,56,58,.18);
  --pass: #5c7f47; --pass-dim: #6e8961; --pass-tint: rgba(92,127,71,.12); --pass-edge: rgba(92,127,71,.5);
  --warn: #a77b22; --warn-dim: #9c7e40; --warn-tint: rgba(167,123,34,.12); --warn-edge: rgba(167,123,34,.5);
  --fail: #ba4c36; --fail-dim: #9e5341; --fail-tint: rgba(186,76,54,.12); --fail-edge: rgba(186,76,54,.55);
  --incon: #5e6b79; --incon-dim: #616b77; --incon-tint: rgba(94,107,121,.12); --incon-edge: rgba(94,107,121,.45);
  --info: #3e6896; --info-dim: #54718f; --info-tint: rgba(62,104,150,.09); --info-edge: rgba(62,104,150,.35);
  --effort: #6e6088; --effort-tint: rgba(110,96,136,.12);
  --spine-static: #5e6b79; --spine-ai: #6e6088; --spine-mon: #5c7159; --spine-rail: rgba(40,28,12,.12);
  --shadow-pop: 0 18px 48px -12px rgba(60,40,20,.22), 0 4px 14px -4px rgba(60,40,20,.14);
}

/* ===== shadcn semantic vars → warm-graphite ===== */
:root, [data-theme="dark"], [data-theme="light"] {
  --background: var(--bg); --foreground: var(--fg);
  --card: var(--bg-raised); --card-foreground: var(--fg);
  --popover: var(--bg-raised-2); --popover-foreground: var(--fg);
  --primary: var(--brand); --primary-foreground: #fff;
  --secondary: var(--bg-raised-2); --secondary-foreground: var(--fg);
  --muted: var(--bg-raised); --muted-foreground: var(--fg-muted);
  --accent: var(--bg-active); --accent-foreground: var(--fg);
  --destructive: var(--fail); --destructive-foreground: #fff;
  --border: var(--line-2); --input: var(--line-2); --ring: var(--brand);
  --radius: 0.5rem;
}

/* ===== Tailwind theme: expose palette + fonts as utilities ===== */
@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover); --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent); --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring);
  --color-brand: var(--brand);
  --color-pass: var(--pass); --color-pass-tint: var(--pass-tint); --color-pass-edge: var(--pass-edge);
  --color-warn: var(--warn); --color-warn-tint: var(--warn-tint); --color-warn-edge: var(--warn-edge);
  --color-fail: var(--fail); --color-fail-tint: var(--fail-tint); --color-fail-edge: var(--fail-edge);
  --color-incon: var(--incon); --color-incon-tint: var(--incon-tint); --color-incon-edge: var(--incon-edge);
  --color-info: var(--info); --color-info-tint: var(--info-tint); --color-info-edge: var(--info-edge);
  --color-effort: var(--effort); --color-effort-tint: var(--effort-tint);
  --color-fg: var(--fg); --color-fg-2: var(--fg-2); --color-fg-3: var(--fg-3);
  --color-fg-muted: var(--fg-muted); --color-fg-faint: var(--fg-faint);
  --color-line: var(--line); --color-line-2: var(--line-2);
  --color-raised: var(--bg-raised); --color-raised-2: var(--bg-raised-2); --color-rail: var(--bg-rail);
  --font-sans: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
}

/* ===== base ===== */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  background: var(--bg); color: var(--fg);
  font-family: var(--font-sans); font-size: 14px; line-height: 1.45;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  font-feature-settings: "tnum" 1, "lnum" 1, "cv01" 1; overflow: hidden;
}
.tnum { font-feature-settings: "tnum" 1, "lnum" 1; font-variant-numeric: tabular-nums lining-nums; }
.mono { font-family: var(--font-mono); font-feature-settings: "tnum" 1, "lnum" 1; font-variant-numeric: tabular-nums; }
.display-face { font-family: var(--font-display); }
.caption { font-size: 12px; color: var(--fg-muted); line-height: 1.5; }
.label { font-size: 10.5px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--fg-muted); }
.scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }
.scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.scroll::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 6px; border: 2px solid transparent; background-clip: content-box; }
::selection { background: var(--brand-tint-2); color: var(--fg); }
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; }
.focusable:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
textarea::placeholder, input::placeholder { color: var(--fg-faint); }
.run-row { transition: background-color 120ms ease; }
.run-row:hover { background: var(--bg-hover) !important; }
.ag-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 4px; outline: none;
  background: linear-gradient(90deg, var(--brand) 0%, var(--brand) var(--pct,30%), var(--line-2) var(--pct,30%), var(--line-2) 100%); }
.ag-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 15px; height: 15px; border-radius: 50%; background: var(--fg); border: 2px solid var(--bg-raised); cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.4); }

@keyframes settle-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes hl-fade { 0% { background-color: var(--bg-active); } 100% { background-color: transparent; } }
@keyframes incident-pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pop-in { from { opacity: 0; transform: translateY(6px) scale(.99); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: no-preference) {
  .settle { animation: settle-in 180ms cubic-bezier(.22,.61,.36,1) both; }
  .hl { animation: hl-fade 1100ms ease-out; }
  .popin { animation: pop-in 160ms cubic-bezier(.22,.61,.36,1) both; }
}
.pulse-dot { animation: incident-pulse 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .pulse-dot { animation: none; } }
```

- [ ] **Step 2: Verify the dev server boots with styles**

Run: `pnpm --filter web dev` then open `http://localhost:3000`.
Expected: page compiles, warm-graphite `--bg` body background applies (existing placeholder page is fine for now). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(web): warm-graphite token layer + Tailwind/shadcn theming"
```

### Task 1.5: Fonts + theme-no-flash + providers in `layout.tsx`

**Files:** Modify `apps/web/app/layout.tsx`

- [ ] **Step 1: Rewrite `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TRPCReactProvider } from "../trpc/client";

const instrument = localFont({
  variable: "--font-instrument",
  src: [
    { path: "./fonts/InstrumentSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/InstrumentSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/InstrumentSans-Bold.ttf", weight: "700", style: "normal" },
  ],
});
const bricolage = localFont({
  variable: "--font-bricolage",
  src: "./fonts/BricolageGrotesque.ttf",
});

export const metadata: Metadata = {
  title: "Autogate",
  description: "Automated release-safety instrument — dashboard",
};

const noFlashTheme = `(function(){try{var t=localStorage.getItem("ag-theme")||"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: noFlashTheme }} /></head>
      <body className={`${instrument.variable} ${bricolage.variable}`}>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
```

> The `@theme` `--font-sans`/`--font-display` reference the font family names that `next/font/local` registers via `@font-face`; the `.variable` classes expose CSS vars but the family names ("Instrument Sans", "Bricolage Grotesque") resolve through the `@font-face` `font-family`. `next/font/local` auto-names them from the file; to guarantee the exact family names, the `@font-face` is emitted by next/font and matched by the literal names in `@theme`. If the family name differs, set `declarations`/`adjustFontFallback` is unnecessary — verify in Task 9 by checking computed `font-family`.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web check-types`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): Bricolage + Instrument Sans fonts, no-flash theme"
```

---

## Phase 2 — API types + view-model (TDD)

### Task 2.1: Type barrel `lib/api-types.ts`

**Files:** Create `apps/web/lib/api-types.ts`

- [ ] **Step 1: Write it**

```ts
// Single import surface for contract types used across the dashboard.
export type {
  RunSummary, RunDetail, RunStatus, RunDecision,
  CheckResult, TrustMetrics, RepoSummary, OverrideAction, OverrideRequest,
} from "@autogate/contracts";
export type { Verdict, VerdictStatus, CheckLayer, Finding, Severity } from "@autogate/contracts";
```

- [ ] **Step 2: Verify typecheck** — Run: `pnpm --filter web check-types` → PASS.
- [ ] **Step 3: Commit** — `git add apps/web/lib/api-types.ts && git commit -m "feat(web): contract type barrel"`

### Task 2.2: Vitest config

**Files:** Create `apps/web/vitest.config.ts`; Modify `apps/web/package.json` scripts

- [ ] **Step 1: Write `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

- [ ] **Step 2: Add test script** to `apps/web/package.json` `scripts`: `"test": "vitest run"`
- [ ] **Step 3: Commit** — `git add apps/web/vitest.config.ts apps/web/package.json && git commit -m "chore(web): vitest config"`

### Task 2.3: `view-model.ts` — bands, duration, scale (TDD)

**Files:** Create `apps/web/lib/view-model.ts`, `apps/web/lib/view-model.test.ts`

- [ ] **Step 1: Write failing tests** — `apps/web/lib/view-model.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { riskBand, fmtDuration, agreementPct } from "./view-model";

describe("riskBand", () => {
  it("bands by threshold", () => {
    expect(riskBand(10)).toBe("low");
    expect(riskBand(30)).toBe("mid");
    expect(riskBand(59)).toBe("mid");
    expect(riskBand(60)).toBe("high");
  });
});
describe("fmtDuration", () => {
  it("formats ms / s, null for 0", () => {
    expect(fmtDuration(0)).toBeNull();
    expect(fmtDuration(940)).toBe("940 ms");
    expect(fmtDuration(5200)).toBe("5.2 s");
    expect(fmtDuration(24100)).toBe("24 s");
  });
});
describe("agreementPct", () => {
  it("scales 0–1 to a rounded percent", () => {
    expect(agreementPct(0.82)).toBe(82);
    expect(agreementPct(0.935)).toBe(94);
  });
});
```

- [ ] **Step 2: Run, verify fail** — Run: `pnpm --filter web test` → FAIL (module not found).

- [ ] **Step 3: Implement** — `apps/web/lib/view-model.ts`

```ts
import type { RunSummary, RunDetail, CheckResult, CheckLayer, VerdictStatus, RunDecision, RunStatus } from "./api-types";

export type RiskBand = "low" | "mid" | "high";
export function riskBand(score: number): RiskBand {
  if (score >= 60) return "high";
  if (score >= 30) return "mid";
  return "low";
}

export function fmtDuration(ms: number | null | undefined): string | null {
  if (ms == null || ms === 0) return null;
  if (ms < 1000) return `${ms.toLocaleString("en-US")} ms`;
  const s = ms / 1000;
  return `${s >= 10 ? Math.round(s) : s.toFixed(1)} s`;
}

export function agreementPct(rate: number): number {
  return Math.round(rate * 100);
}
```

- [ ] **Step 4: Run, verify pass** — Run: `pnpm --filter web test` → PASS.
- [ ] **Step 5: Commit** — `git add apps/web/lib/view-model.ts apps/web/lib/view-model.test.ts && git commit -m "feat(web): view-model bands/duration/scale (TDD)"`

### Task 2.4: `view-model.ts` — layer stance + disagreement (TDD)

**Files:** Modify `apps/web/lib/view-model.ts`, `apps/web/lib/view-model.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
import { layerStance, disagreement } from "./view-model";
import type { RunDetail } from "./api-types";

const mk = (over: Partial<RunDetail>): RunDetail => ({
  runId: "r", pr: { number: 1, title: "t", repo: "x", author: "a", url: "#", branch: "b" },
  status: "completed", decision: { outcome: "escalate", riskScore: 50, reasons: [] },
  riskScore: 50, gate: { total: 3, passed: 3, failed: 0, pending: 0 },
  checkSummary: { pass: 1, warn: 0, fail: 1, pending: 0 },
  createdAt: "", updatedAt: "", gateChecks: [], checks: [], timeline: [], ...over,
});
const chk = (layer: "gate"|"ai"|"monitor", status: "pass"|"warn"|"fail"|"needs_human"): RunDetail["checks"][number] =>
  ({ sourceId: "s", status, confidence: 1, riskContribution: 0, summary: "", findings: [], layer, durationMs: 0 });

describe("layerStance", () => {
  it("fail dominates, then warn, then needs_human, else pass", () => {
    expect(layerStance([chk("ai","pass"), chk("ai","fail")], "ai")).toBe("fail");
    expect(layerStance([chk("ai","pass"), chk("ai","warn")], "ai")).toBe("warn");
    expect(layerStance([chk("ai","needs_human")], "ai")).toBe("needs_human");
    expect(layerStance([chk("ai","pass")], "ai")).toBe("pass");
    expect(layerStance([], "ai")).toBe("pending");
  });
});
describe("disagreement", () => {
  it("conflict when gate passes but an AI check fails", () => {
    const d = mk({ gate: { total: 2, passed: 2, failed: 0, pending: 0 }, checks: [chk("ai","fail"), chk("ai","pass")] });
    expect(disagreement(d).conflict).toBe(true);
  });
  it("no conflict when all clear", () => {
    const d = mk({ gate: { total: 2, passed: 2, failed: 0, pending: 0 }, checks: [chk("ai","pass")] });
    expect(disagreement(d).conflict).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter web test` → FAIL.

- [ ] **Step 3: Implement (append to `view-model.ts`)**

```ts
export type Stance = "pass" | "warn" | "fail" | "needs_human" | "pending";

export function layerStance(checks: CheckResult[], layer: CheckLayer): Stance {
  const v = checks.filter((c) => c.layer === layer).map((c) => c.status);
  if (!v.length) return "pending";
  if (v.includes("fail")) return "fail";
  if (v.includes("warn")) return "warn";
  if (v.includes("needs_human")) return "needs_human";
  return "pass";
}

// Layer-1 (gate) stance derived from gate counts.
export function gateStance(run: Pick<RunSummary, "gate">): Stance {
  const g = run.gate;
  if (g.failed > 0) return "fail";
  if (g.pending > 0) return "pending";
  if (g.total === 0) return "pending";
  return "pass";
}

export function disagreement(run: RunDetail): { conflict: boolean; stance: Record<string, Stance> } {
  const stance: Record<string, Stance> = {
    gate: gateStance(run),
    ai: layerStance(run.checks, "ai"),
    monitor: layerStance(run.checks, "monitor"),
  };
  const active = Object.values(stance).filter((s) => s !== "pending");
  const hasPass = active.includes("pass");
  const hasFail = active.includes("fail");
  return { conflict: hasPass && hasFail, stance };
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter web test` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): view-model layer stance + disagreement (TDD)"`

### Task 2.5: `view-model.ts` — effort + grouping + incident + recorded reason (TDD)

**Files:** Modify `apps/web/lib/view-model.ts`, `apps/web/lib/view-model.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
import { effortBand, groupRuns, deriveIncident, recordedReasonFrom, needsHumanCount } from "./view-model";

const sum = (over: Partial<RunSummary>): RunSummary => ({
  runId: "r", pr: { number: 1, title: "t", repo: "askable-services", author: "a", url: "#", branch: "b" },
  status: "completed", decision: "auto_merge", riskScore: 10,
  gate: { total: 5, passed: 5, failed: 0, pending: 0 },
  checkSummary: { pass: 6, warn: 0, fail: 0, pending: 0 }, createdAt: "", updatedAt: "", ...over,
});

describe("effortBand", () => {
  it("quick for clean low-risk", () => {
    expect(effortBand(sum({ riskScore: 10, checkSummary: { pass: 6, warn: 0, fail: 0, pending: 0 } }))).toBe("quick");
  });
  it("deep for high-risk with concerns", () => {
    expect(effortBand(sum({ riskScore: 80, checkSummary: { pass: 3, warn: 1, fail: 2, pending: 0 } }))).toBe("deep");
  });
});
describe("groupRuns", () => {
  it("buckets by decision/status, needs-you sorted quick→deep", () => {
    const runs = [
      sum({ runId: "esc1", decision: "escalate", riskScore: 70, checkSummary: { pass: 3, warn: 1, fail: 1, pending: 0 } }),
      sum({ runId: "esc2", decision: "escalate", riskScore: 20, checkSummary: { pass: 7, warn: 1, fail: 0, pending: 0 } }),
      sum({ runId: "run", status: "running", decision: "pending" }),
      sum({ runId: "auto", decision: "auto_merge", riskScore: 8 }),
      sum({ runId: "merged", decision: "merged", riskScore: 22 }),
    ];
    const g = groupRuns(runs);
    expect(g.needsYou.map((r) => r.runId)).toEqual(["esc2", "esc1"]); // quick before deep
    expect(g.inProgress.map((r) => r.runId)).toEqual(["run"]);
    expect(g.autoMerged.map((r) => r.runId)).toEqual(["auto"]);
    expect(g.inProduction.map((r) => r.runId)).toEqual(["merged"]);
  });
});
describe("deriveIncident", () => {
  it("true for merged + monitoring not-rolled-back + rising errors", () => {
    expect(deriveIncident(mk({ decision: { outcome: "merged", riskScore: 22, reasons: [] }, monitoring: { canaryPercent: 25, newErrors: 142, window: "18m", rolledBack: false } }))).toBe(true);
    expect(deriveIncident(mk({ decision: { outcome: "merged", riskScore: 22, reasons: [] }, monitoring: { canaryPercent: 25, newErrors: 0, window: "1h", rolledBack: false } }))).toBe(false);
  });
});
describe("recordedReasonFrom", () => {
  it("extracts the human override reason from decision.reasons", () => {
    const d = mk({ decision: { outcome: "merged", riskScore: 50, reasons: ["x", "Human override: looked fine to me"] } });
    expect(recordedReasonFrom(d)?.reason).toBe("looked fine to me");
  });
  it("null when no override recorded", () => {
    expect(recordedReasonFrom(mk({}))).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter web test` → FAIL.

- [ ] **Step 3: Implement (append)**

```ts
export type Effort = "quick" | "moderate" | "deep";
export const effortOrder: Record<Effort, number> = { quick: 0, moderate: 1, deep: 2 };

export function needsHumanCount(checks: CheckResult[]): number {
  return checks.filter((c) => c.status === "needs_human").length;
}

export function effortBand(run: Pick<RunSummary, "checkSummary" | "riskScore">): Effort {
  const cs = run.checkSummary;
  let score = (cs.warn || 0) + (cs.fail || 0);
  if (run.riskScore >= 60) score += 2;
  else if (run.riskScore >= 35) score += 1;
  if (score <= 1) return "quick";
  if (score <= 3) return "moderate";
  return "deep";
}

export type RunGroups = {
  incident: RunSummary | undefined;
  needsYou: RunSummary[];
  inProgress: RunSummary[];
  inProduction: RunSummary[];
  autoMerged: RunSummary[];
};

export function groupRuns(runs: RunSummary[]): RunGroups {
  const needsYou = runs
    .filter((r) => (r.decision === "escalate" || r.decision === "blocked") && r.status === "completed")
    .sort((a, b) => effortOrder[effortBand(a)] - effortOrder[effortBand(b)]);
  const inProgress = runs.filter((r) => r.status === "running" || r.status === "awaiting_checks");
  const autoMerged = runs.filter((r) => r.decision === "auto_merge").sort((a, b) => b.riskScore - a.riskScore);
  const inProduction = runs
    .filter((r) => r.decision === "merged" || r.decision === "rolled_back")
    .sort((a, b) => Number(b.decision === "merged") - Number(a.decision === "merged"));
  const incident = runs.find((r) => r.decision === "merged"); // refined by detail in deriveIncident at row level
  return { incident, needsYou, inProgress, inProduction, autoMerged };
}

const INCIDENT_ERROR_FLOOR = 1;
export function deriveIncident(run: RunDetail): boolean {
  const m = run.monitoring;
  return run.decision.outcome === "merged" && !!m && !m.rolledBack && m.newErrors >= INCIDENT_ERROR_FLOOR;
}

const OVERRIDE_PREFIX = "Human override: ";
export function recordedReasonFrom(run: RunDetail): { reason: string } | null {
  const hit = [...run.decision.reasons].reverse().find((r) => r.startsWith(OVERRIDE_PREFIX));
  return hit ? { reason: hit.slice(OVERRIDE_PREFIX.length) } : null;
}
```

> Note: `groupRuns().incident` returns a candidate (first merged run); the stream uses `deriveIncident(detail)` per-run when detail is loaded, and only renders the incident bar when a degrading run is confirmed. With current mock fixtures none are degrading, so the bar stays hidden — verify in Task 9.

- [ ] **Step 4: Run, verify pass** — `pnpm --filter web test` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): view-model effort/grouping/incident/reason (TDD)"`

### Task 2.6: Style maps `view-model.ts` — verdict / decision / status / layer

**Files:** Modify `apps/web/lib/view-model.ts`

- [ ] **Step 1: Append style maps (no test — pure data tables)**

```ts
// CSS-var color refs, used inline by primitives.
export const VERDICT: Record<string, { c: string; edge: string; tint: string; label: string }> = {
  pass: { c: "var(--pass)", edge: "var(--pass-edge)", tint: "var(--pass-tint)", label: "pass" },
  warn: { c: "var(--warn)", edge: "var(--warn-edge)", tint: "var(--warn-tint)", label: "warn" },
  fail: { c: "var(--fail)", edge: "var(--fail-edge)", tint: "var(--fail-tint)", label: "fail" },
  needs_human: { c: "var(--incon)", edge: "var(--incon-edge)", tint: "var(--incon-tint)", label: "needs human" },
  pending: { c: "var(--fg-faint)", edge: "var(--line-2)", tint: "transparent", label: "pending" },
};

export const DECISION_STYLE: Record<string, { label: string; c: string; tint: string }> = {
  escalate: { label: "escalated", c: "var(--warn)", tint: "var(--warn-tint)" },
  blocked: { label: "blocked", c: "var(--fail)", tint: "var(--fail-tint)" },
  merged: { label: "merged", c: "var(--pass)", tint: "var(--pass-tint)" },
  auto_merge: { label: "auto-merged", c: "var(--pass)", tint: "var(--pass-tint)" },
  rolled_back: { label: "rolled back", c: "var(--fail)", tint: "var(--fail-tint)" },
  pending: { label: "running", c: "var(--info)", tint: "var(--info-tint)" },
  awaiting_checks: { label: "awaiting checks", c: "var(--incon)", tint: "var(--incon-tint)" },
};

export const SPINE_COLOR: Record<CheckLayer, string> = {
  gate: "var(--spine-static)", ai: "var(--spine-ai)", monitor: "var(--spine-mon)",
};
export const LAYER_LABEL: Record<CheckLayer, string> = { gate: "Static", ai: "AI", monitor: "Monitoring" };
export const LAYER_ORDER: CheckLayer[] = ["gate", "ai", "monitor"];
```

- [ ] **Step 2: Verify** — `pnpm --filter web test && pnpm --filter web check-types` → PASS.
- [ ] **Step 3: Commit** — `git commit -am "feat(web): view-model style maps"`

---

## Phase 3 — Primitives

> All under `apps/web/components/primitives/`. Port from `docs/design-reference/autogate-prototype/app/primitives.jsx` unless noted. Keep bespoke SVG inline. Each is a small `"use client"`-free component unless it needs hooks (most don't).

### Task 3.1: `icon.tsx`
**Port note:** Replace the prototype's hand-rolled `ICON_PATHS` with `lucide-react`. Export an `Icon` wrapper mapping the prototype's names to lucide icons.

- [ ] **Step 1: Create `apps/web/components/primitives/icon.tsx`**

```tsx
import {
  AlignLeft, BarChart3, User, Settings2, GitBranch, PanelLeft, ChevronDown, ChevronRight,
  ArrowLeft, ArrowRight, X, Plus, Check, Sun, Moon, Clock, ExternalLink, RotateCcw,
  Shield, Zap, Activity, OctagonAlert, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  releases: AlignLeft, stats: BarChart3, myruns: User, settings: Settings2, repo: GitBranch,
  panel: PanelLeft, chevronDown: ChevronDown, chevronRight: ChevronRight, arrowLeft: ArrowLeft,
  arrowRight: ArrowRight, x: X, plus: Plus, check: Check, sun: Sun, moon: Moon, clock: Clock,
  external: ExternalLink, rotate: RotateCcw, shield: Shield, zap: Zap, activity: Activity, incident: OctagonAlert, branch: GitBranch,
};

export function Icon({ name, size = 18, className, style }: { name: keyof typeof MAP | string; size?: number; className?: string; style?: React.CSSProperties }) {
  const C = MAP[name] ?? AlignLeft;
  return <C size={size} strokeWidth={1.5} className={className} style={{ flexShrink: 0, display: "block", ...style }} />;
}
```

- [ ] **Step 2: Commit** — `git add apps/web/components/primitives/icon.tsx && git commit -m "feat(web): Icon (lucide)"`

### Task 3.2: `verdict-glyph.tsx`
**Port:** `primitives.jsx:55-78` (`VerdictGlyph`). Reproduce the four bespoke SVG shapes (pass ✓-in-circle, warn triangle, fail filled-circle, needs_human dashed `?`-circle), plus pending. Key by the real status; map `needs_human` to the dashed-circle "inconclusive" shape. Prop: `{ verdict: VerdictStatus | "pending"; size?: number }`.

- [ ] **Step 1: Create the file** porting the five SVG branches verbatim (swap `inconclusive` → `needs_human`).
- [ ] **Step 2: Commit** — `git commit -m "feat(web): VerdictGlyph"`

### Task 3.3: `risk.tsx` — `RiskDot`, `RiskNumeral`
**Port:** `primitives.jsx:122-144`. Use `riskBand` from view-model for colors. Props: `RiskDot { score; size? }`, `RiskNumeral { score }`.
- [ ] Create + commit (`git commit -m "feat(web): RiskDot + RiskNumeral"`).

### Task 3.4: `pills.tsx` — `EffortPill`, `StatusPill`
**Port:** `primitives.jsx:146-180`. `StatusPill` consumes `DECISION_STYLE` (now incl. `awaiting_checks`); for `status==="running"` use the `pending` key + pulse dot; for `status==="awaiting_checks"` use the `awaiting_checks` key. `EffortPill` takes the derived `effortBand` string. Props: `EffortPill { effort: Effort }`, `StatusPill { decision: RunDecision; status: RunStatus; size?: "md"|"lg" }`.
- [ ] Create + commit (`git commit -m "feat(web): EffortPill + StatusPill"`).

### Task 3.5: `avatar.tsx`, `tally.tsx`, `sparkline.tsx`, `spine.tsx`
**Port:** `Avatar` (182-193), `TallyTiles`+`TallyInline` (195-245), `Sparkline` (247-265), and the run-detail layer `Spine`/marker concept (the per-layer colored gutter; the compact stream spine is intentionally NOT ported — removed per the chat). `TallyTiles` adds a 4th "needs human" tile fed by `needsHumanCount`. Props match the prototype.
- [ ] Create the four files + commit (`git commit -m "feat(web): Avatar, Tally, Sparkline, Spine"`).

---

## Phase 4 — Theme + shell

### Task 4.1: `theme-provider.tsx` + `theme-toggle.tsx`
**Files:** Create both in `components/shell/`.

- [ ] **Step 1: `theme-provider.tsx`**

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
type Theme = "dark" | "light";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });
export const useTheme = () => useContext(Ctx);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme((localStorage.getItem("ag-theme") as Theme) || "dark"); }, []);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("ag-theme", theme); }, [theme]);
  return <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: `theme-toggle.tsx`** — a `RailItem`-compatible button using `useTheme()` + `Icon name={theme==="dark"?"sun":"moon"}`. (Wired into the rail footer in Task 4.4.)
- [ ] **Step 3: Commit** — `git commit -m "feat(web): theme provider + toggle"`

### Task 4.2: `brand.tsx` — emblem + lockup
**Port:** `app.jsx:7-14` (`Logomark` emblem, inline paths) and the recolored lockup. Convert `apps/web/components/shell/autogate-lockup.svg.txt` to a React component: strip hardcoded `fill="#..."` → `fill="currentColor"`, set `style={{ color: "var(--fg)" }}`. Export `Emblem({ size })` and `Lockup({ height })`.

- [ ] **Step 1:** Inline the emblem paths (verbatim from `app.jsx:8`). For the lockup, read the `.svg.txt`, replace fill colors with `currentColor`, wrap in a component. Delete the `.svg.txt` after inlining.
- [ ] **Step 2: Commit** — `git commit -m "feat(web): brand emblem + lockup (theme-aware)"`

### Task 4.3: `toast.tsx`
**Port:** `app.jsx:106-113`. Self-dismissing (2600ms) fixed bottom-center popin. Prop: `{ msg: string; onDone: () => void }`. A `useToast` store (simple module-level zustand-free context) lives in `app-shell.tsx`.
- [ ] Create + commit (`git commit -m "feat(web): toast"`).

### Task 4.4: `rail.tsx`
**Port:** `app.jsx:16-73` (`RailItem` + `Rail`), adapted to routing. Nav items become `next/link`: Open reviews → `/`, Stats → `/stats`. Active state via `usePathname()`. Repositories group from a `repos` query (client `useTRPC().repos`); each repo links to `/?repo=<id>` and shows its needs count (computed from a `runs.list` client query filtered to that repo's escalate/blocked). Footer: `<ThemeToggle/>` + collapse toggle. Omit "My runs"/"Settings". Props: `{ collapsed; setCollapsed }`.

- [ ] **Step 1:** Create `rail.tsx` (`"use client"`). Use `Emblem`/`Lockup` from Task 4.2, `Icon`, `RailItem`. `needsCount` badge on Open reviews = total escalate+blocked completed.
- [ ] **Step 2: Commit** — `git commit -m "feat(web): rail with routed nav + repo filters"`

### Task 4.5: `topbar.tsx`
**Port:** `app.jsx:76-103`. Incident indicator: if any loaded run is a confirmed incident show the red pill (links to that run); else "all systems nominal". Agreement %: `agreementPct(metrics.agreementRate.at(-1).rate)`. Live dot: bind to TanStack Query global `useIsFetching()`/error — fetching→"live", error→"reconnecting…". `+` button → toast "Runs are created automatically by CI when code is pushed." Props: `{ incidentHref?: string; agreement: number; }`.

- [ ] **Step 1:** Create `topbar.tsx` (`"use client"`), use `useIsFetching` from `@tanstack/react-query`.
- [ ] **Step 2: Commit** — `git commit -m "feat(web): topbar (incident, agreement, live status)"`

### Task 4.6: `app-shell.tsx`
**Port:** `app.jsx:237-248` shell layout. Client component: holds `collapsed` + toast context + theme provider boundary; renders `<Rail/>`, a column with `<Topbar/>` + `{children}`, and the toast region. Provides `useToast()` to descendants. Props: `{ children }`.

- [ ] **Step 1:** Create `app-shell.tsx`. Wrap children; expose toast via context. Topbar reads `metrics`/runs via client queries (prefetched by routes).
- [ ] **Step 2: Commit** — `git commit -m "feat(web): app shell (rail + topbar + toast)"`

---

## Phase 5 — Routes skeleton

### Task 5.1: Dashboard layout + remove placeholders
**Files:** Create `app/(dashboard)/layout.tsx`; Delete `app/page.tsx`, `app/_components/runs-list.tsx`, `app/page.module.css`.

- [ ] **Step 1: Create `app/(dashboard)/layout.tsx`**

```tsx
import { ThemeProvider } from "@/components/shell/theme-provider";
import { AppShell } from "@/components/shell/app-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Remove the scaffold placeholders**

```bash
git rm apps/web/app/page.tsx apps/web/app/_components/runs-list.tsx apps/web/app/page.module.css
```

- [ ] **Step 3:** Create temporary stub `app/(dashboard)/page.tsx` rendering `<div className="p-6">Open reviews</div>` so the route resolves.
- [ ] **Step 4: Verify** — `pnpm --filter web dev`, open `/`: rail + topbar render, theme toggle + collapse work. Stop server.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): dashboard layout + shell wiring; drop scaffold page"`

---

## Phase 6 — Open reviews (`/`)

> Components under `components/stream/`. Port from `docs/design-reference/autogate-prototype/app/stream.jsx`. Navigation: rows become `next/link` to `/runs/${runId}` (no `onOpen` callback).

### Task 6.1: `group-header.tsx`
**Port:** `stream.jsx:56-70`. Optional collapse chevron, glyph, label, count (plain numeral), sub-cue, right slot. Props `{ glyph?; label; count?; sub?; right?; collapsed?; onToggle? }`.
- [ ] Create + commit.

### Task 6.2: `segmented.tsx`
**Port:** `stream.jsx:351-363`. Implement with shadcn `ToggleGroup` (type single) themed to the prototype's pill look, or port the plain buttons. Options: All / Needs you / In production / Auto-merged. Props `{ value; onChange; options }`.
- [ ] Create + commit.

### Task 6.3: `run-row.tsx`
**Port:** `stream.jsx:7-39` (`RunRow`). Grid `76px minmax(0,1fr) 96px 78px 30px`, h-60. Cells: `EffortPill effort={effortBand(run)}` · title + `{run.pr.repo} #{run.pr.number}` · `RiskDot`+score (+ needs-human glyph if `run.checkSummary` has no needs-human count... use `run` summary; needs-human not in summary, so omit the inconclusive glyph on rows) · `TallyInline summary={run.checkSummary}` · `Avatar`. Wrap in `next/link href={/runs/${run.runId}}`. Props `{ run: RunSummary; visited?; justUpdated? }`.
- [ ] Create + commit.

### Task 6.4: `gate-progress.tsx`
**New (no prototype equiv).** For `awaiting_checks` rows: a compact `gate X/total` chip using `run.gate` (passed/total), slate-toned, shown in place of the tally. Props `{ gate: RunSummary["gate"] }`. Render `gate {passed}/{total}` with a small progress bar.
- [ ] **Step 1: Create**

```tsx
import type { RunSummary } from "@/lib/api-types";
export function GateProgress({ gate }: { gate: RunSummary["gate"] }) {
  const pct = gate.total ? (gate.passed / gate.total) * 100 : 0;
  return (
    <div className="mono flex items-center gap-2 text-[12px]" style={{ color: "var(--incon)" }}>
      <span className="tnum">gate {gate.passed}/{gate.total}</span>
      <span className="h-[3px] w-12 overflow-hidden rounded-full" style={{ background: "var(--line-2)" }}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "var(--incon)" }} />
      </span>
    </div>
  );
}
```

In `run-row.tsx`, when `run.status === "awaiting_checks"` render `<GateProgress gate={run.gate}/>` instead of `<TallyInline/>`.
- [ ] **Step 2: Commit** — `git commit -m "feat(web): gate progress for awaiting_checks rows"`

### Task 6.5: `auto-row.tsx`
**Port:** `stream.jsx:154-174`. Compact merged-row: title + repo#num, a derived "why" line (`run` summary has none — use empty/secondary; on detail it's `decision.brief`; for the list omit the why line or show risk only), risk dot+score, chevron. Props `{ run: RunSummary; visited? }`. Link to `/runs/${runId}`.
- [ ] Create + commit.

### Task 6.6: `incident-bar.tsx`
**Port:** `stream.jsx:73-95`. Red Tier-0 bar: "Errors rising in production — {title}" + Inspect → link to the degrading run. Props `{ title: string; href: string }`. Rendered only when a confirmed incident exists.
- [ ] Create + commit.

### Task 6.7: `prod-card.tsx`
**Port:** `stream.jsx:98-146` (`ProdCard`). Expandable in-production card using `monitoring` (canary/newErrors/window/rolledBack) + `decision.brief`. Degrading vs healthy vs rolled-back states. **Needs `RunDetail`** (monitoring + brief), so the stream fetches detail for in-production runs (see Task 6.8). Props `{ run: RunDetail; expanded; onToggle }`. "Open run detail" → link; "Review & roll back" → link to `/runs/${runId}` (rollback handled in detail).
- [ ] Create + commit.

### Task 6.8: `empty-needs-you.tsx`
**Port:** `stream.jsx:334-348`. Affirmative empty state. Props `{ filtered: boolean }`.
- [ ] Create + commit.

### Task 6.9: `release-stream.tsx` + wire `app/(dashboard)/page.tsx`
**Port:** `stream.jsx:176-331` (`ReleaseStream`), adapted: tiers from `groupRuns(runs.list)`. In-production + incident need detail — fetch `runs.byId` for each merged/rolled-back run via parallel `useSuspenseQueries` (or a small client fetch) to get `monitoring`/`brief` and run `deriveIncident`. Status filter (Segmented) + repo filter (from `?repo=` search param). "In production" collapsed by default; filtering to a group force-expands it.

- [ ] **Step 1: `release-stream.tsx`** (`"use client"`): `useSuspenseQuery(trpc.runs.list.queryOptions({ limit: 50 }, { refetchInterval: 5000 }))`, then `groupRuns`. For `inProduction` ids, `useQueries`/`useSuspenseQueries(trpc.runs.byId...)` to render `ProdCard` + detect incident. Render IncidentBar (if any), Needs you (RunRow), In progress (RunRow + GateProgress), Handled-by-system → In production (ProdCard, collapsed) + Auto-merged (AutoRow, riskiest-first, "load more").

- [ ] **Step 2: `app/(dashboard)/page.tsx`** (RSC)

```tsx
import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { ReleaseStream } from "@/components/stream/release-stream";

export const dynamic = "force-dynamic";

export default async function OpenReviews() {
  const qc = getQueryClient();
  await Promise.all([
    qc.prefetchQuery(trpc.runs.list.queryOptions({ limit: 50 })),
    qc.prefetchQuery(trpc.repos.queryOptions()),
    qc.prefetchQuery(trpc.metrics.queryOptions()),
  ]);
  return (
    <HydrateClient>
      <Suspense fallback={<div className="p-6 caption">Loading…</div>}>
        <ReleaseStream />
      </Suspense>
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Verify** — dev server + API: `/` shows Needs you (run_02), In progress (run_03 awaiting + run_04 running with gate progress), In production (run_05 rolled-back), Auto-merged (run_01). No incident bar (no degrading fixture). Repo filter via `/?repo=autogate` narrows. `check-types` PASS.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(web): Open reviews stream wired to runs.list"`

---

## Phase 7 — Run detail (`/runs/[runId]`)

> Components under `components/run-detail/`. Port from `docs/design-reference/autogate-prototype/app/rundetail.jsx`.

### Task 7.1: `check-row.tsx`
**Port:** `rundetail.jsx:10-49` (`CheckRow`). Expandable AI check: `VerdictGlyph verdict={check.status}` · `check.sourceId` (mono) · status label if concern · `fmtDuration(check.durationMs)` · `check.summary` as the finding line · expand reveals `check.findings[]` (severity, `location.file:line`, `detail`, `evidence`). Props `{ check: CheckResult; conflict?: boolean }`. Expandable when `findings.length > 0`.
- [ ] Create + commit.

### Task 7.2: `monitoring-row.tsx`
**Port:** `rundetail.jsx:91-119`. Renders the `monitoring` panel (canary/newErrors/window) with degrading/healthy/rolled-back copy. Props `{ run: RunDetail }`.
- [ ] Create + commit.

### Task 7.3: `evidence.tsx` — Static (gate) / AI / Monitoring groups
**Port + adapt:** `rundetail.jsx:51-89` (`LayerGroup`), split into three real-data groups:
- **GateChecksGroup** (Static): renders `run.gateChecks` — each `{name, conclusion, url?}` as a row with a pass/fail/pending glyph derived from `conclusion` (`success`→pass, `failure`/`error`→fail, `pending`/`""`→pending), name (mono), external-link icon if `url`. Spine color `--spine-static`.
- **AILayerGroup**: `run.checks.filter(c => c.layer === "ai")` → `<CheckRow/>`. Spine `--spine-ai`. Counts header.
- **MonitoringGroup**: if `run.monitoring` → `<MonitoringRow/>`; else if completed pre-merge → the dashed "Runs after this change merges" future note (`rundetail.jsx:73-81`); also render any `layer==="monitor"` checks. Spine `--spine-mon`.

Export `<Evidence run={run} conflict={...} />` composing the three with a subtle layer marker + the "layers disagree" chip (from `disagreement(run).conflict`).
- [ ] **Step 1: Create `evidence.tsx`** with the three groups + a `conclusionToVerdict(conclusion: string)` helper.
- [ ] **Step 2: Commit** — `git commit -m "feat(web): run-detail evidence (gateChecks/AI/monitoring)"`

### Task 7.4: `orchestrator-brief.tsx` + `assessing-panel.tsx`
**Port:** `rundetail.jsx:121-142` (brief: `decision.brief` + `decision.reasons[]`) and `374-388` (assessing panel for running runs: `checks.filter(status).length`/`checks.length`). Props `{ run: RunDetail }`.
- [ ] Create both + commit.

### Task 7.5: `confirm-modal.tsx`
**Port:** `rundetail.jsx:305-343`, implemented with shadcn **Dialog**. Restates the consequence per action (approve_merge / block / rollback), shows the recorded reason, Cancel / confirm CTA. Props `{ open; action: "approve_merge"|"block"|"rollback"; reason; pr; onCancel; onConfirm }`.
- [ ] Create + commit.

### Task 7.6: `action-block.tsx` — decision/override/rollback/confirmed
**Port:** `rundetail.jsx:145-302`. The state machine over `run.decision.outcome`:
- `escalate`/`blocked` → reason-gated `ActionBlock` (textarea ≥4 chars → Approve & merge / Block / Keep blocked).
- `auto_merge` → `AutoMergedFooter` ("I disagree — roll back").
- `merged` + incident (`deriveIncident`) → `RollbackBlock`.
- `merged`/`rolled_back` + recorded reason → `ConfirmedSummary` (uses `recordedReasonFrom`).
- in-progress rollback → `RollbackProgress`.

Wire actions to mutations (passed in as props from `run-detail.tsx`): `onApprove(reason)`, `onBlock(reason)`, `onRollback(reason)`. Props `{ run: RunDetail; onAct: (a: {action; reason}) => void; pending: boolean }`.
- [ ] Create + commit (`git commit -m "feat(web): run-detail action block + confirmed states"`).

### Task 7.7: `timeline.tsx`
**Port:** `rundetail.jsx:346-372`. Renders `run.timeline[{at,event}]`. Derive `emphasis` from event text (`/rolled back|failed/i`→fail, `/Human (approved|blocked)|override/i`→override, `/Escalated|auto-merge|Auto-merged/i`→decision) since the API has no `emphasis` field. Format `at` with `fmtTimeLabel`. Props `{ run: RunDetail }`.

> Add `fmtTimeLabel(iso: string)` to view-model: if parseable ISO → `HH:MM`; else return the raw string. Add a quick test.
- [ ] Create + add `fmtTimeLabel` (with test) + commit.

### Task 7.8: `run-detail.tsx` + `app/(dashboard)/runs/[runId]/page.tsx`
**Port:** `rundetail.jsx:391-462` (`RunDetail`). Layout: back link → `/`, header (StatusPill + title + PR meta + RiskNumeral), TallyTiles (+ needs-human), brief|assessing, Evidence, ActionBlock (hidden while running), Timeline. Wire mutations:

```tsx
const trpc = useTRPC();
const qc = useQueryClient();
const override = useMutation(trpc.runs.override.mutationOptions({
  onSuccess: () => { qc.invalidateQueries({ queryKey: trpc.runs.pathKey() }); toast("…"); },
}));
const rollback = useMutation(trpc.runs.rollback.mutationOptions({ onSuccess: () => { qc.invalidateQueries({ queryKey: trpc.runs.pathKey() }); toast("…"); } }));
```

- [ ] **Step 1:** `run-detail.tsx` (`"use client"`): `useSuspenseQuery(trpc.runs.byId.queryOptions({ runId }, { refetchInterval: 4000 }))`; pass `onAct` dispatching override/rollback; toast on success via `useToast()`.
- [ ] **Step 2:** `app/(dashboard)/runs/[runId]/page.tsx` (RSC): `await params`, prefetch `trpc.runs.byId.queryOptions({ runId })`, render `<RunDetail runId={runId}/>` in Suspense. `export const dynamic = "force-dynamic"`.
- [ ] **Step 3: Verify** — open `/runs/run_02` (escalate hero): brief, gateChecks (5 green), AI checks (security fail w/ finding expand, architecture warn), reason-gated approve/block; submit a reason → confirm modal → merged + recorded reason; toast. `/runs/run_05` → rolled-back confirmed. `/runs/run_03` awaiting (gate 2/4 pending). `check-types` PASS.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(web): run detail wired to byId + override/rollback"`

---

## Phase 8 — Stats (`/stats`)

> Components under `components/stats/`. Port from `docs/design-reference/autogate-prototype/app/stats.jsx`, trimmed to the real `TrustMetrics` (agreementRate, escalation{precision,recall}, overridesPerWeek). Drop outcomes/recentRollbacks/summary-derived panels with no data.

### Task 8.1: `panel.tsx` + `stat-tile.tsx`
**Port:** `stats.jsx:231-243` (`Panel`) and `6-18` (`StatTile`). Props as prototype.
- [ ] Create both + commit.

### Task 8.2: `charts.tsx` — `AgreementChart` (0–1 scale) + `OverridesChart`
**Port + adapt:** `stats.jsx:38-102` (line, hover, axes) and `181-229` (bar, axes). **Adapt agreement to 0–1:** data points `{date, rate}` with `rate` in 0–1; y-domain `0.6–0.95`, labels via `agreementPct`. X-axis labels from `date` (ISO or `YYYY-Www`) — show index or short label. `OverridesChart` uses `{week, count}` with `week` labels. Both keep hover tooltips. Props `{ data }`.
- [ ] **Step 1: Create `charts.tsx`** with both SVG charts (client components for hover state).
- [ ] **Step 2: Commit** — `git commit -m "feat(web): trust charts (agreement 0–1, overrides)"`

### Task 8.3: `trust-view.tsx` + `app/(dashboard)/stats/page.tsx`
**Port + trim:** `stats.jsx:245-320`. Surfaces: summary strip (agreement now from last point, escalation precision, escalation recall — 3 `StatTile`s from real data), QualityCallouts (escalation precision + recall, sparkline from agreementRate), AgreementChart panel (+ honest note only if a dip exists), OverridesChart panel. **No** outcomes/rollbacks panels.

- [ ] **Step 1:** `trust-view.tsx` (`"use client"`): `useSuspenseQuery(trpc.metrics.queryOptions())`.
- [ ] **Step 2:** `app/(dashboard)/stats/page.tsx` (RSC): prefetch `metrics`, render in Suspense. `dynamic = "force-dynamic"`.
- [ ] **Step 3: Verify** — `/stats`: 3 tiles (agreement 93%, precision 81%, recall 74%), agreement line chart (5 pts, hover), overrides bar chart (3 weeks). `check-types` PASS.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(web): Stats/Trust view wired to metrics"`

---

## Phase 9 — Final verification

### Task 9.1: Full gates + manual sweep
- [ ] **Step 1:** `pnpm --filter web test` → PASS (view-model).
- [ ] **Step 2:** `pnpm turbo check-types` → PASS (whole repo).
- [ ] **Step 3:** `pnpm --filter web lint` → clean (fix any warnings).
- [ ] **Step 4: Manual sweep** (dev server + `pnpm --filter api dev`):
  - `/`: tiers correct; repo filter (`/?repo=autogate`); status segmented; In-production collapsed; auto-merged riskiest-first; empty "Needs you" when filtered to a repo with none.
  - `/runs/run_02`: approve flow → confirm modal restates consequence → merged + recorded reason + toast; reason gate disables submit under 4 chars.
  - `/runs/run_05`: rolled-back confirmed summary; `/runs/run_01`: auto-merged footer (disagree → rollback); `/runs/run_03`: awaiting (gate 2/4); `/runs/run_04`: running (assessing panel, action block hidden).
  - `/stats`: charts + tiles render; hover tooltips.
  - Theme toggle (dark↔light) faithful on every surface; rail collapse; back button from detail → `/`.
  - Topbar live dot reflects fetching; "all systems nominal" (no incident in mock).
- [ ] **Step 5:** Verify computed `font-family` on a heading is "Bricolage Grotesque" and body is "Instrument Sans" (DevTools); fix `@theme`/`localFont` names if not.
- [ ] **Step 6: Commit any fixes** — `git commit -am "fix(web): final verification adjustments"`

---

## Self-review notes (resolved)
- **Spec §2.1 routes** → Tasks 5.1, 6.9, 7.8, 8.3. **§2.2 shell** → Phase 4. **§2.3 live/polling** → refetchInterval + invalidation in 6.9/7.8; live dot in 4.5. **§2.4 view-model** → Phase 2 (all functions covered + tested). **§3 reconciliation:** needs_human→3.2/2.6; gateChecks=Static→7.3; awaiting_checks→6.4/3.4; agreement 0–1→8.2/2.3; Stats trim→Phase 8; incident derive→2.5/6.6. **§4 components** → Phases 3–8. **§5 styling** → Phase 1. **§6 testing** → Phase 2 + 9. **§7 DoD** → Task 9.1.
- **Type consistency:** `effortBand`/`groupRuns`/`disagreement`/`deriveIncident`/`recordedReasonFrom`/`gateStance`/`layerStance`/`needsHumanCount`/`fmtDuration`/`agreementPct`/`fmtTimeLabel` defined in Phase 2, consumed by the same names in Phases 3–8. `VERDICT`/`DECISION_STYLE`/`SPINE_COLOR`/`LAYER_LABEL`/`LAYER_ORDER` defined 2.6.
- **No placeholders:** all config/logic/primitive code is inline; visual components reference exact committed prototype files + line ranges + props + data mapping.
```
