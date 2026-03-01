# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
yarn dev                  # Start dev server (port 3039, uses .env)
yarn dev:local            # Dev with .env.localhost
yarn dev:dev              # Dev with .env.dev
yarn dev:prod             # Dev with .env.production

# Build
yarn build                # Vite build
yarn build:check          # TypeScript check + Vite build

# Testing
yarn test                 # Vitest in watch mode
yarn test:run             # Single run (CI)
yarn test:coverage        # Coverage report (70% thresholds enforced)

# Lint / Format
yarn lint                 # ESLint
yarn lint:fix             # ESLint with auto-fix
yarn fm:fix               # Prettier fix
yarn fix:all              # lint:fix + fm:fix

# API client regeneration
yarn generate-api         # Regenerate src/api/Client.ts from nswag.json
```

## Environment

Copy `.env.example` to `.env` (or `.env.localhost`, `.env.dev`). Required variables:
- `VITE_API_BASE_URL` — backend URL (throws at startup if missing)
- `VITE_COMPANY_ADDRESS` — JSON object with company coordinates (used for route planning)

## Architecture

### Tech Stack
React 19, TypeScript, Vite 6, MUI v7, react-router v7, react-i18next (cs/en/de), Leaflet for maps, dnd-kit for drag-and-drop, Vitest + @testing-library/react for tests.

### Path Alias
`src/...` resolves to `./src/...` in both Vite and Vitest configs.

### API Layer (`src/api/`)
- `Client.ts` — auto-generated NSwag client (do not edit by hand; regenerate via `yarn generate-api`)
- `AuthorizedClient.ts` — extends `Client` with a custom `authorizedFetch` that injects the JWT `Bearer` token from `localStorage` and redirects to `/sign-in` on 401
- `api-error-handler.ts` — `handleApiCall` / `handleApiCallWithDefault`: catch-all wrappers that extract structured error codes from backend responses and surface them via snackbar

### Authentication (`src/context/AuthContext.tsx`)
JWT stored in `localStorage` under key `authToken`. `AuthProvider` decodes the token on mount (clears expired/invalid tokens), exposes `signIn(token)` / `signOut()`. JWT claims use long Microsoft/XML namespaces that are mapped to short keys (`id`, `name`, `role`, etc.).

### Route Protection (`src/routes/sections.tsx`)
`RequireRole` component checks `useAuth()` against a list of `UserRoleType` values. Unauthenticated users are redirected to `/sign-in`; wrong role redirects to `/404`.

### Hook Pattern
`useApiCall()` (`src/hooks/use-api-call.ts`) is the standard way to call the API in components. It wraps `handleApiCall` with the current snackbar and i18n translation function, so error messages are automatically translated and displayed.

```ts
const { executeApiCall, executeApiCallWithDefault } = useApiCall();
const data = await executeApiCall(() => client.getSomething(), 'errors.LOAD_FAILED');
```

### Section Structure
Each domain module under `src/sections/<domain>/` follows this layout:
```
view/          # Main list/overview page component
detail-view/   # Create / detail / update forms
components/    # Domain-specific reusable components (selects, inputs, etc.)
```
Pages under `src/pages/` are thin wrappers that import from the corresponding section.

### Layout Components (`src/layouts/dashboard/`)
- `DashboardContent` — content area wrapper
- `SplitViewLayout` — left panel (e.g. list) + right panel (e.g. detail) + optional right Drawer
- `DetailCardLayout` — single-card detail page layout

### Global Providers (wired in `src/main.tsx`)
`AuthProvider` → `SnackbarProvider` → `EntityStatsProvider` → `LocalizationProvider` (dayjs) → `CurrencyProvider`

### Testing Conventions
- Test files co-located with source files (e.g. `use-api-call.test.ts` next to `use-api-call.ts`)
- Use `src/test/test-utils.tsx` instead of `@testing-library/react` directly — it re-exports everything and provides `renderWithProviders` (wraps with `ThemeProvider`)
- `src/test/setup.ts` mocks `localStorage` and `matchMedia` globally
- Mock dependencies with `vi.mock(...)` at the module level; use `vi.clearAllMocks()` in `beforeEach`
- Environment: `happy-dom`
