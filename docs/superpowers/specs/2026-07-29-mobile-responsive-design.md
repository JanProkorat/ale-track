# Mobile responsiveness — design

**Date:** 2026-07-29
**Branch:** `feat/mobile-responsive`
**Scope:** frontend only (`app/`). No backend or API-client change.

## Problem

The app is unusable on a phone. The sidebar is permanently rendered at a fixed
250px (74px collapsed) with `position: sticky; height: 100vh`, and there is **no
`useMediaQuery` anywhere in the codebase** — so it never becomes a drawer. At a
390px viewport it consumes two thirds of the screen.

Everything else is degradation on top of that. The app is already partly
responsive: content grids collapse (`{ xs: '1fr', md: '1.5fr 1fr' }`),
`FormDrawer` goes full-width below `sm`, every table sits in an
`overflowX: auto` container, and `LoginPage` hides its brand panel on `xs`.

### Inventory of what breaks

| # | Problem | Where |
|---|---|---|
| 1 | Sidebar permanent, fixed 250px, never a drawer | `layout/Sidebar.tsx:43`, `AppShell.tsx:49` |
| 2 | Topbar overflows — search pill `minWidth: 190` + currency + bell + theme + hamburger + `px: 2.5` needs ~350px before the flex row crushes; `⌘K` hint is dead weight on touch | `layout/Topbar.tsx:64` |
| 3 | Touch targets below 44px — 11–13.5px type, small `IconButton`s | pervasive |
| 4 | Hardcoded 2-col dialog grids with no `xs` fallback; dialogs not full-bleed on mobile | `DeliveryPlaceDialog.tsx:168,197` |
| 5 | `100vh` rather than `100dvh` — mobile browser chrome overshoots | `Sidebar.tsx:51`, `AppShell.tsx:49`, `index.css:14`, `LoginPage.tsx:64` |
| 6 | Maps fixed at 340px | `RouteMap.tsx:72` |

Lists stay as horizontally-scrolling tables — a deliberate scope decision. All
of them already live inside `overflowX: auto` containers, so they scroll rather
than push the document sideways. (`DataTable` does support `hideOnMobile`, but
only 2 columns in the app use it; widening that use is out of scope here.)

## Design authority

`docs/prototype/aletrack-prototype.html` already specifies the mobile
behaviour, so the shell work is a **port, not a design exercise**:

```
@media (max-width:1080px){ .form-grid{grid-template-columns:1fr;} }
@media (max-width:860px){
  .sidebar{position:fixed;z-index:60;left:0;transform:translateX(-100%);
           transition:transform .25s var(--ease);box-shadow:var(--shadow-lg);}
  .sidebar.mobile-open{transform:none;}
  .sidebar.collapsed{width:var(--sidebar-w);flex-basis:var(--sidebar-w);}
  .page{padding:16px 14px 50px;}
}
@media (max-width:720px){ .cmdk-btn .lbl,.cmdk-btn .cmdk-kbd{display:none;}
  .cmdk-btn{min-width:0;flex:0 0 auto;width:40px;justify-content:center;padding:0;} }
```

Plus a mobile-only hamburger (`data-act="toggle-mobile"`, line 734) distinct
from the desktop collapse toggle, and navigation closing the drawer (line 1015).

## 1 · Breakpoints (`src/theme/theme.ts`)

```ts
breakpoints: {
  values: { xs: 0, sm: 600, compact: 720, mobile: 860, md: 900, lg: 1200, xl: 1536 },
}
```

Two verified facts:

- **Declaration order is free.** `createBreakpoints` sorts values ascending
  itself (`@mui/system/esm/createBreakpoints/createBreakpoints.js:39`).
- **TypeScript needs a module augmentation**, or `sx={{ display: { mobile: 'flex' } }}`
  will not compile:
  ```ts
  declare module '@mui/system' {
    interface BreakpointOverrides { compact: true; mobile: true }
  }
  ```
  `BreakpointOverrides` is the documented extension point
  (`createBreakpoints.d.ts:2`).

Adding keys would normally shift `only()` / `not()` semantics — `only('sm')`
would become 600–719.95 instead of 600–899.95 — but there are **zero** such
calls in `src/`, so nothing changes meaning. Existing `xs` / `sm` / `md` / `lg`
sx values keep their exact current behaviour.

## 2 · The shell

**`AppShell.tsx`** — add `mobileOpen` state and
`useMediaQuery(theme.breakpoints.down('mobile'))`. Close the drawer on
`pathname` change, matching prototype line 1015.

**`Sidebar.tsx`** — takes `mobile` / `open` / `onClose`. Below `mobile` it
renders inside `<Drawer variant="temporary">` at the **full 250px**, ignoring
`collapsed` (prototype line 291). At and above `mobile`, the current permanent
`<aside>` is untouched. `100vh` → `100dvh`.

> **Deviation from the prototype:** MUI's temporary Drawer renders a scrim; the
> prototype slides the sidebar over the page with only a shadow. The scrim is
> standard, gives a tap-to-close target, and is what this repo's own
> `FormDrawer` already does. Recorded in a code comment and the commit message.

**`Topbar.tsx`** — the single hamburger dispatches by breakpoint:
`onOpenMobileNav` below `mobile`, the existing `onToggleSidebar` collapse at and
above. The search pill collapses to a 40px icon-only circle below `compact` per
prototype line 334, which removes the `minWidth: 190` that causes the overflow
and drops the meaningless `⌘K` hint on touch. Row padding
`px: 2.5` → `{ xs: 1.5, mobile: 2.5 }`.

## 3 · Page chrome

- **`PageContainer`** → prototype `.page{padding:16px 14px 50px}`:
  `px: { xs: 1.75, mobile: 3.5 }`, `pt: { xs: 2, mobile: 3 }`,
  `pb: { xs: 6.25, mobile: 8 }`.
- **Dialogs** — one central `MuiDialog` paper `styleOverride` making the paper
  full-bleed below `compact`. A per-dialog `fullScreen` prop cannot be
  responsive via `defaultProps` (it is a boolean), and a central override
  reaches every dialog at once. `CommandPalette`'s local paper `sx` still wins
  over `styleOverrides`, keeping its prototype-correct `min(640px, 94vw)` /
  `top: 11vh`.
- **`DeliveryPlaceDialog:168,197`** — `'1fr 1fr'` → `{ xs: '1fr', sm: '1fr 1fr' }`.
  *Deviation:* the prototype collapses `.form-grid` at a 1080px **viewport**,
  but a ≤640px dialog is narrow at any viewport, so a viewport query cannot
  express what is needed. Container width is what matters here.
- **Touch targets** — `MuiIconButton` styleOverride with an
  `@media (pointer: coarse)` bump to a 44px hit area. `MuiTab` already sets
  `minHeight: 48`.
- **`100vh` → `100dvh`** in `Sidebar.tsx:51`, `AppShell.tsx:49`,
  `index.css:14`, `LoginPage.tsx:64`.
- **`RouteMap`** default height `340` → `{ xs: 260, mobile: 340 }`.

## 4 · Overflow sweep

All ten modules get checked equally. The sweep looks for anything **not**
contained by a scroll container — the fix target is horizontal overflow of the
document, not table width. Suspects to confirm rather than assume: the driver
availability calendar (`minWidth: 760`, inside a scroller), the dashboard week
grid (`minWidth: 720`, inside a scroller), the reports charts (fixed 240–280px
heights) and the 200×200 donut.

## What does not change

- The document-level scroll model. `AppShell`'s `flex: '1 0 auto'` carries a
  comment recording a bug that cost real time; nested scroll containers are not
  introduced.
- `theme.vars.palette.*` is used in all new `sx` — never `theme.palette.*`,
  which freezes to the light value under `cssVariables`.
- No backend, DTO, or `api-client.ts` change, so no codegen step.

## Verification

1. `yarn build` — the repo's only command that typechecks *and* bundles.
2. `yarn test:run`.
3. Backend on `:8080`, app on `:3039`, then drive a real browser at
   **390×844** and **360×800** through login → dashboard → all ten module
   lists → one detail → one editor → a `FormDrawer` → a dialog, asserting
   `scrollWidth <= clientWidth` on the document at each stop and screenshotting
   any failure.

A mocked `matchMedia` cannot catch a 400px-wide element quietly overflowing the
body, which is why the real-browser sweep is the primary gate here.
