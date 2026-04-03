# DPINO Launchpad

## Overview

Full-stack DPINO Launchpad — the curated token launch platform for the $DPINO (Dark Pino) Solana meme coin ecosystem.
Built as a pnpm workspace monorepo using TypeScript.

### Key Architecture Decisions
- **All IDO participation, fees, and allocations are denominated in $DPINO** (not SOL or USDC)
- **$DPINO token**: `4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy` — 9 decimals, ~987B supply
- **0.5% protocol fee** on every IDO participation routes to DPINO/SOL LP on Raydium
- **Staking tiers** (9-decimal thresholds): SOLDIER=100K DPINO, GENERAL=500K DPINO, DARK LORD=1M DPINO
- **DEX Screener pair**: `8wKQuMgoXKV9w8Vn8CpsA2g2WckuVs3ChcN5ZNp8mcNM`
- **Rust compilation** not possible in Replit NixOS — build Anchor contracts locally (see `contracts/DEPLOY.md`)

### DB Fields (all DPINO amounts, not USD)
`totalRaise`, `raisedAmount`, `tokenPrice`, `minAllocation`, `maxAllocation` → represent raw DPINO token amounts

### API Field
`totalRaisedDpino` (renamed from `totalRaisedUsd`) in `/api/stats/platform` response

### Authentication (Clerk)
Clerk auth is fully integrated. Routes: `/sign-in`, `/sign-up`.
- Registration with email + password or Google OAuth
- Email verification sent automatically on sign-up
- Forgot password built into sign-in flow
- Navbar shows "SIGN IN" + "REGISTER" when signed out; user email + "Sign Out" when signed in
- Env secrets: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- API: `@clerk/express` middleware on server; `@clerk/react` on client

### Smart Contract Review (Anchor)
Both contracts are logically correct and ready for local compilation:

**dpino-staking:**
- Thresholds: SOLDIER=100K×10^9, GENERAL=500K×10^9, DARK_LORD=1M×10^9 ✅
- SPL token transfer user → vault on stake ✅
- Reward accumulation before re-stake (no double-counting) ✅
- 7-day cooldown on unstake ✅
- Tier auto-assigned from amount ✅

**dpino-ido:**
- All amounts in $DPINO base units (9 decimals) ✅
- 0.5% protocol fee (50 BPS) to fee vault ✅
- Hard cap, soft cap, min/max allocation enforcement ✅
- Tier gating (min_tier_required) ✅
- Finalization + token claim + refund (if soft cap not met) ✅

**Before mainnet deployment (must do locally):**
1. `cd contracts && anchor build && anchor keys list` → get real program IDs
2. Update `Anchor.toml` + both `declare_id!()` macros + `SolanaWalletProvider.tsx`
3. Fund protocol fee vault and reward vault
4. Test on devnet first

### Admin Panel
Available at `/admin` (hidden URL, no authentication).
Supports: Add Project, Edit Project, Delete Project, Change Status (upcoming/live/ended).
New projects always start as UPCOMING — change to LIVE to open for participation.

### Database State
Database is CLEAN — all dummy data removed. Ready for real projects only.
Use `/admin` to add real token launches, or `/apply` for project teams to submit their own.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── dpino-launchpad/    # DPINO Launchpad React+Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
