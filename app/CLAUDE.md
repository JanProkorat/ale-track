# CLAUDE.md — frontend (`app/`)

Guidance for the React app. The repo-root `CLAUDE.md` covers the monorepo and
the backend; this file covers everything under `app/` and does not repeat it.

**Stack:** React 19, Vite 6 (SWC), TypeScript, MUI 7, TanStack Query 5,
react-router-dom, notistack, dayjs. Package manager is **yarn** — there is no
`package-lock.json`, and CI once failed for months because a workflow assumed
there was.

## Commands

```bash
yarn dev            # dev server on :3039 (host: true)
yarn dev:local      # same, with --mode localhost (.env.localhost)
yarn build          # tsc --noEmit && vite build  ← typecheck lives here
yarn typecheck      # tsc --noEmit alone
yarn lint           # eslint src/**/*.{ts,tsx}
yarn test           # vitest watch
yarn test:run       # vitest run (what CI runs)
yarn generate-api   # NSwag — needs the backend running on :8080
```

`yarn build` is the only command that typechecks *and* bundles, so it is the one
to run before declaring frontend work done. CI currently runs `test:run` only
(see issue #13), so a type or lint error will not be caught for you.

## The generated API client

`src/generated/api-client.ts` is **generated from the backend's OpenAPI document**
and must never be hand-edited. Regenerating requires the backend running locally:

```bash
# backend first: cd api/AleTrack && dotnet run --project AleTrack --launch-profile Local
cd app && yarn generate-api
```

A backend DTO change and its frontend consumption **belong in the same commit** —
regeneration is a breaking change, so splitting them leaves the app uncompilable
in between.

### `src/api/apiClient.ts` — why it is not just `new Client()`

Three things live here and are easy to break by accident:

- **Token state and silent refresh.** `AuthProvider` pushes tokens in via
  `setApiTokens`. A 401 triggers one deduped refresh against `/ale-track/refresh`
  and replays the request; if the refresh fails, `onAuthFailed` signs the user out.
- **The NSwag dictionary-query-param fix.** Generated `*List*` endpoints serialize
  a filter dictionary as `Parameters=[object Object]`. The client is wrapped in a
  `Proxy` that stashes the plain-object argument per call and the fetch layer
  rebuilds the query as `Parameters[key]=value`. DTOs are class instances, so the
  detection (`constructor === Object`) skips them. This is call-scoped and relies
  on the method building its URL synchronously.
- **The singleton.** Modules never import `Client` directly — they go through
  `useDataSource()` (`src/api/dataSource.ts`), a thin accessor returning `api`.

`src/api/errors.ts` exposes `apiErrorMessage(err, fallback?)`, which maps
`ApiException` status codes to Czech messages and reads `message`/`detail` off a
JSON body when present. Use it for every user-facing error — never render a raw
error.

## Data fetching

One hook module per resource in `src/hooks/` (`useOrders`, `useShipments`, …),
built on TanStack Query. Query keys come from the central factory in
`src/api/queryKeys.ts` — `resource(root)` gives `.all` / `.list(params)` /
`.detail(id)`, with hand-written keys for nested resources. Always take keys from
`qk`; ad-hoc arrays break invalidation silently.

Client defaults (`src/providers/QueryProvider.tsx`): `staleTime` 30 s, `retry` 1,
no refetch on window focus.

Convention for mutations: invalidate `qk.<resource>.all` plus the specific
`detail(id)` on success. Where the server recomputes state on read (the shipment
invoice split does), invalidate rather than patching the cache locally.

`QueryBoundary` (`src/components/common/QueryBoundary.tsx`) renders
loading / error / empty / data for a query result so every module behaves the
same. Prefer it over hand-rolled `isLoading` ladders.

**Hooks must not run on data that may be missing.** Split the component: an outer
one that handles the query states and an inner one that receives `data` as a plain
prop. A `useMemo` above an `if (!data) return` guard will crash, and the `data!`
assertion needed to compile it hides the mistake from `tsc`.

## Auth and permissions

`src/auth/AuthProvider.tsx` exposes `useAuth()`: `user`, `isAuthenticated`,
`signIn(userName, password, remember)`, `signOut`, `canSee(module)`,
`canEdit(module)`, `can(capability)`.

`remember` decides the store: `localStorage` persists across browser restarts,
`sessionStorage` only for the tab.

Permissions are per-module `'none' | 'view' | 'edit'` over the ten `MODULE_KEYS`
in `src/auth/permissions.ts`. Gate **both** the route and the controls:
`ProtectedRoute` handles access, and screens take `editable = canEdit('module')`
and hide or disable actions with it. Never rely on the backend alone to hide an
action the user cannot perform.

`can(capability)` gates a named slice of content that cuts across the module ×
permission matrix — hiding the Fakturace card from a driver, say, without
touching their `shipments` permission. Capabilities are declared in
`src/auth/capabilityRegistry.ts` and resolved from the `cap` claims on the
access token, so a role's visibility takes effect on the user's next sign-in
or token refresh, not live. Role-level visibility is edited at `/users/roles`.
A capability with `guardsData: true` is enforced by its endpoint too — a
driver gets a 403 from the API, not just a hidden card; `guardsData: false`
is UI-only decluttering with nothing backing it server-side.

## Screen structure

Routing is URL-driven and one page component serves all four states of a module:

```
/shipments            → list
/shipments/new        → <ShipmentsPage view="create" />
/shipments/:id        → detail
/shipments/:id/edit   → <ShipmentsPage view="edit" />
```

So `ShipmentsPage` reads `useParams().id` and the `view` prop and renders the
list, `ShipmentDetail`, or `ShipmentEditor`. Paths come from `src/routes/paths.ts`;
`src/routes/editorNav.ts` has `backOrReplace` for leaving an editor.

Feature code lives in `src/features/<module>/`, with the page, detail, editor and
any module-only helpers together. Shared UI is in `src/components/common/`:
`DataTable`, `FormDrawer`, `PageHeader`/`PageContainer`, `StatusPill`,
`EmptyState`, `Combobox`, `SearchField`, `SegControl`, `ConfirmDialog`,
`RouteMap`/`PointMap`, `UnsavedChangesGuard`.

When a feature file grows past roughly 500 lines, split the pure shaping logic
into a sibling module (see `shipmentInvoiceModel.ts` next to
`ShipmentInvoicing.tsx`). It keeps the component readable and makes the risky
parts testable without a rendering harness.

## Language and labels

**The UI is Czech; the code is English.** Comments, identifiers and commit
messages in English, every user-visible string in Czech.

Never render a raw enum. `src/lib/labels.ts` maps every backend enum to Czech via
the `L` table plus helpers (`kindLabel`, `shipStateName`, `orderStateName`, …).
`src/lib/format.ts` has `num`, `fmtDate`, `fmtLiters`, `plural(n, one, few, many)`
for Czech pluralisation, and the `orderNumber`/`shipmentNumber`/`deliveryNumber`
display-number helpers. `src/lib/enums.ts` builds `Combobox` options from numeric
enums.

Money is **not** formatted locally: `useCurrency().formatMoney(czk)` from
`src/providers/CurrencyProvider.tsx` converts a CZK-base amount into the active
display currency using the live EUR rate.

## Theme and MUI traps

`src/theme/theme.ts` uses `cssVariables: { colorSchemeSelector: 'data-theme' }`
with light and dark schemes; brand tokens are in `src/theme/tokens.ts` and reach
`sx` as `theme.vars.palette.brand.*` (`surface2`, `amberTint`, `infoTint`,
`okTint`, `critTint`, `greyTint`, `navy`, …). Primary is amber.

Three traps that have each cost real time:

1. **Use `theme.vars.palette.*`, not `theme.palette.*`, inside `sx` callbacks.**
   Under `cssVariables` the latter freezes to the light value and produces white
   borders in dark mode.
2. **MUI tints dark-mode `Paper` by elevation.** A Dialog sits at elevation 24,
   enough to wash `background.paper` well off the design token. The theme clears
   it for `MuiCard` and `MuiDialog`; if you introduce another elevated surface,
   set `backgroundImage: 'none'`.
3. **The page scrolls at the document level.** `AppShell`'s main uses
   `flex: '1 0 auto'` so it sizes to content; `flex-basis: 0` next to the 100vh
   sidebar killed page scroll once, and nested scroll containers inside a screen
   have caused the same class of bug. Let long content grow the document.

Chart colours for the Reporty module come from `src/features/reports/reportPalette.ts`,
whose light and dark arrays are validated for colour-vision deficiency and contrast
against the real card surfaces. Assign them by entity identity — never cycle with `%`
and never assign after sorting by value, or changing a filter repaints every series.
Status colours (shipment state, the on-time gauge) come from the theme's status tokens,
never from that palette.

Dialogs are styled centrally (`MuiDialog`, `MuiDialogTitle`, `MuiDialogContent`,
`MuiDialogActions`) to match the prototype's modal — flat surface, divider under
the head and above the foot. Do not re-add local padding or border `sx` to a
dialog; partial overrides fight the theme and produce lopsided spacing.

## Prototype fidelity

`docs/prototype/aletrack-prototype.html` is the approved design. Module screens
are meant to be **precise ports of it, not reinterpretations** — match layout,
wording, chips and spacing, and when the prototype and MUI defaults disagree, the
prototype wins.

Where a port has to deviate because the real data model differs from the
prototype's simplification, say so in the code comment and the commit message.

## Testing

Vitest + happy-dom + Testing Library, globals on, setup in `src/test/setup.ts`.
Tests sit next to what they test (`shipmentInvoiceModel.test.ts`).

- **`@testing-library/user-event` is not a dependency.** Use `fireEvent`. MUI
  `Select` opens on `fireEvent.mouseDown`, not `click`.
- Prefer testing extracted pure logic directly; reserve component tests for what
  only the component decides (conditional chrome, dialogs, disabled states).
- `vi.mock` the resource hook rather than standing up a QueryClient. **Make the
  mock able to express loading, error and no-data** — a mock that always returns
  a happy response cannot catch a crash on a missing one, which is exactly how a
  page-level crash shipped once.
- Content inside `Collapse` stays mounted while it animates out. Assert removal
  with `waitForElementToBeRemoved`, not a bare `queryBy`.
- Verify a test earns its place by breaking the thing it guards and watching it
  fail. Several rules here were confirmed that way.

## Environment

`VITE_API_BASE_URL` (no trailing slash — the client appends `ale-track/`) is the
only required env var. Copy `env.example` to `.env`; `.env*` files are git-ignored
and this is a **public repository** — keep real values out of tracked files.

The company address is no longer a frontend env var — it lives in backend
configuration and reaches the frontend via the shipment start-points endpoint
(`useShipmentStartPoints()` in `src/hooks/useShipments.ts`, the entry whose
`kind` is `Company`).

Dev server port **3039** is hardcoded in `vite.config.ts`; the backend is expected
on **8080**. `src/` resolves via the `src/…` alias, configured in both
`vite.config.ts` and `vitest.config.ts`.
