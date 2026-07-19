# AleTrack Frontend — Clean React Rebuild (Execution Plan)

**Date:** 2026-07-19
**Goal:** Delete the existing `app/` and rebuild a clean React frontend that implements
the approved redesign (see `docs/prototype/aletrack-prototype.html` +
`2026-07-19-aletrack-redesign-prototype-design.md`), wired to the real backend via the
generated API client. Bulk module implementation dispatched to Sonnet subagents; Opus
does planning, foundation architecture, and review.

**Location:** new project replaces `app/` (keeps monorepo layout, CI path filters
`app/**`, port 3039, and the FE↔BE contract references in `CLAUDE.md` consistent).
**Branch:** `feat/frontend-rebuild` off the current branch (design doc + prototype travel in-tree as the spec for subagents).

## Stack (clean, mirrors the good parts of the old app)

- React 19 + Vite 6 + `@vitejs/plugin-react-swc`, TypeScript strict, port **3039**, `src/*` alias.
- **MUI 7** (`@mui/material`, `icons-material`, `@mui/x-date-pickers`) + Emotion, **amber/navy theme** from our design tokens, light/dark.
- **react-router-dom 7** (data router, protected routes).
- **@tanstack/react-query 5** for server state; typed hooks per module over the generated client.
- **react-hook-form + zod** for forms/validation.
- **Czech-only UI** (strings inline, no i18n indirection) — matches the prototype; i18next can be added later if DE/EN is needed.
- **Leaflet + react-leaflet** for real maps (replaces the prototype's stylized SVG), with route polylines for Vývozy/Dovozy.
- **@dnd-kit** for shipment stop reordering; **notistack** for toasts; **jwt-decode**, **dayjs**.
- ESLint 9 flat config + Prettier.

## Carry-forward plumbing (recreated clean, not copied)

- **NSwag codegen** — recreate `nswag.json` (input `http://localhost:8080/swagger/v1/swagger.json`, output `src/generated/api-client.ts`, Fetch template, camelCase, `useAbortSignal`). Script `generate-api`. Client is git-tracked.
- **Auth wrapper** — `authorizedFetch`: `Authorization: Bearer <token>`, `401` → silent refresh (`POST /ale-track/refresh`, dedup concurrent refreshes), retry-or-logout. Tokens in `localStorage` (`authToken`, `refreshToken`). Proxy fix for the NSwag dictionary-query-param bug on `*Endpoint` methods.
- **Env**: `VITE_API_BASE_URL`, `VITE_COMPANY_ADDRESS`; `.env.example` committed, others git-ignored. Fix the malformed `.env.production` scheme.
- Single lockfile (**yarn**); drop the stale `package-lock.json`.

## Permissions note

The prototype designs **granular per-module permissions** (view/edit/none) — the current BE only has `Admin`/`User`. The rebuild will implement a client-side permission model shaped for the granular design, driven by whatever the `users` DTO exposes; if the BE stays binary, it degrades to Admin-sees-all / User-sees-modules. Flagged as a BE follow-up, not a blocker.

## Phases (each = one turn, committed as a resume point)

- **P0 — Reset & scaffold** (Opus): `git rm -r app`, scaffold clean Vite project at `app/`, base config (vite/tsconfig/eslint/prettier), env examples, `nswag.json`, deps, `.gitignore`. Commit.
- **P1 — Foundation** (Opus): design-token theme (MUI, light/dark), providers (Query, Auth, Theme, Currency, i18n, Snackbar), router + `ProtectedRoute`, app shell (collapsible navy sidebar, topbar, ⌘K command palette, currency switch, account footer). Commit.
- **P2 — API layer**: generate the client (needs BE on :8080), `apiClient.ts` wrapper, per-module query/mutation hooks + query keys, shared enum→Czech label maps + status pill helpers. Commit.
- **P3 — Auth & Login**: login screen (split brand panel), auth flow end-to-end. Commit.
- **P4..P12 — Modules** (Sonnet bulk, one per turn, reviewed by Opus): Dashboard · Pivovary (tab bar + pivot ceník) · Klienti (region grouping + address maps) · Objednávky (history-first builder) · Vývozy (order-select + Leaflet route + optimizer + nakládka: 2-stage check, F1/F2, dokládka→stock) · Dovozy (multi-brewery + route + stock write-through) · Sklad (search/filter/grid) · Řidiči (availability calendar) · Vozy · Uživatelé (permission matrix). Each committed.
- **P13 — Verify & docs**: `tsc --noEmit`, `vite build`, lint, component tests for critical flows; update root `CLAUDE.md` + `app/CLAUDE.md`; README. Commit.

## Dependencies / coordination

- **P2 blocks on the backend running locally on :8080** (NSwag reads live Swagger). Until then, P0/P1/P3-shell can proceed against typed stubs, but data wiring waits for the generated client. You'll need to start the BE (`dotnet run --project AleTrack --launch-profile Local`) when we reach P2.

## Model routing

Opus: P0, P1, P2 scaffolding, all reviews. Sonnet: P3–P12 module implementation from this spec + the prototype. Haiku: throwaway lookups if needed.

## Out of scope

Real backend changes (granular permissions, price effective-dates, exchange-rate endpoint wiring beyond current), production deploy config.
