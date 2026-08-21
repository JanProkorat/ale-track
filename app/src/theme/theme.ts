import { createTheme, alpha } from '@mui/material/styles';
import {
  fonts,
  lightBrand,
  darkBrand,
  lightStatus,
  darkStatus,
  type BrandTokens,
} from './tokens';

// Augment MUI's palette with our brand tokens so components can read
// theme.palette.brand.* and stay theme-aware (light/dark).
declare module '@mui/material/styles' {
  interface Palette {
    brand: BrandTokens;
  }
  interface PaletteOptions {
    brand?: BrandTokens;
  }
}

// The prototype's responsive breakpoints don't line up with MUI's defaults, and
// prototype fidelity wins. Declaring them as extra named keys keeps every
// existing xs/sm/md/lg value in the app meaning exactly what it means today.
// Without this augmentation `sx={{ display: { mobile: 'flex' } }}` won't compile.
declare module '@mui/system' {
  interface BreakpointOverrides {
    compact: true;
    mobile: true;
  }
}

const radius = 11;

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
  // compact/mobile come from the prototype's @media blocks: 720px collapses the
  // search pill to an icon, 860px turns the sidebar into a slide-in drawer.
  // Declaration order is free — createBreakpoints sorts values ascending itself.
  breakpoints: {
    values: { xs: 0, sm: 600, compact: 720, mobile: 860, md: 900, lg: 1200, xl: 1536 },
  },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: lightBrand.amber, dark: lightBrand.amberHover, contrastText: '#3a2402' },
        secondary: { main: '#0E7C9B', contrastText: '#ffffff' },
        success: { main: lightStatus.ok },
        info: { main: lightStatus.info },
        warning: { main: lightStatus.warn },
        error: { main: lightStatus.crit },
        background: { default: lightBrand.ground, paper: '#FFFFFF' },
        text: { primary: '#1C2733', secondary: '#54606F', disabled: '#8791A0' },
        divider: '#E1E6EE',
        brand: lightBrand,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: darkBrand.amber, dark: darkBrand.amberHover, contrastText: '#241300' },
        secondary: { main: '#33B7D6', contrastText: '#08222b' },
        success: { main: darkStatus.ok },
        info: { main: darkStatus.info },
        warning: { main: darkStatus.warn },
        error: { main: darkStatus.crit },
        background: { default: darkBrand.ground, paper: '#18222F' },
        text: { primary: '#E7EDF4', secondary: '#9DAABB', disabled: '#6C7A8C' },
        divider: '#2A3A4C',
        brand: darkBrand,
      },
    },
  },
  shape: { borderRadius: radius },
  typography: {
    fontFamily: fonts.body,
    // The prototype's base body size is 14px (MUI defaults body1 to 16px) —
    // match it so text isn't ~14% larger than the design everywhere.
    fontSize: 14,
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    h1: { fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontWeight: 800, letterSpacing: '-0.02em' },
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
    // Dialogs follow the prototype's .modal / .modal-head / .modal-body / .modal-foot:
    // flat --surface with a divider under the head and above the foot.
    MuiDialog: {
      styleOverrides: {
        // MUI tints dark-mode Paper by elevation, and a Dialog sits at 24 — enough to
        // wash background.paper out well away from the prototype's --surface. Same
        // reason MuiCard already clears it.
        paper: ({ theme: t }) => ({
          backgroundImage: 'none',
          // MUI already caps a maxWidth="sm" paper at calc(100% - 64px) on narrow
          // screens, which leaves a 326px dialog on a 390px phone. Go full-bleed
          // instead. Height stays content-driven so a small ConfirmDialog doesn't
          // become a full-screen sheet — hence this rather than the fullScreen
          // prop, which is a boolean and so can't be made responsive here.
          [t.breakpoints.down('compact')]: {
            margin: 0,
            width: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: 0,
          },
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '18px 22px',
          fontSize: 17,
          borderBottom: `1px solid ${t.vars.palette.divider}`,
        }),
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: 22,
          // MUI zeroes the top padding when a title precedes the content, which assumed
          // the two were visually joined. They are separated by a divider now.
          '.MuiDialogTitle-root + &': { paddingTop: 22 },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          gap: 10,
          padding: '16px 22px',
          borderTop: `1px solid ${t.vars.palette.divider}`,
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 16,
          // theme.vars.* is scheme-reactive under cssVariables; theme.palette.*
          // would freeze to the light value and give white borders in dark mode.
          border: `1px solid ${t.vars.palette.divider}`,
          backgroundImage: 'none',
        }),
      },
      defaultProps: { elevation: 0 },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme: t }) => ({
          backgroundColor: t.vars.palette.brand.navy,
          fontSize: 12,
        }),
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiIconButton: {
      styleOverrides: {
        root: {
          // A size="small" IconButton is a 30px target; touch needs 44px. Keyed on
          // pointer rather than viewport width so a desktop mouse keeps the
          // prototype's tighter chrome even in a narrow window.
          '@media (pointer: coarse)': { minWidth: 44, minHeight: 44 },
        },
      },
    },
    // iOS Safari force-zooms the viewport when a focused form control's font-size is
    // under 16px, which the prototype's 14px body size makes every field. Bump the
    // control itself on touch only, so pointer devices keep the design's 14px. Keyed
    // on pointer rather than viewport width for the same reason MuiIconButton is.
    MuiInputBase: {
      styleOverrides: {
        input: {
          '@media (pointer: coarse)': { fontSize: 16 },
        },
      },
    },
    // Sub-tabs (Info/Ceník/…) — match the prototype's .tabs button (13.5px/700).
    MuiTab: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: '0.84rem', textTransform: 'none', minHeight: 48 },
      },
    },
    MuiCssBaseline: {
      styleOverrides: (t) => ({
        '::selection': { background: alpha(t.palette.primary.main, 0.28) },
        // iOS Safari zooms the viewport on a double-tap, and two quick taps on a control —
        // switching tabs, nudging a quantity — read as exactly that. `manipulation` opts out
        // of the double-tap gesture only; pinch-zoom still works, unlike a maximum-scale or
        // user-scalable viewport lock, which would fail WCAG 1.4.4.
        //
        // Deliberately NOT [role="button"]: dnd-kit spreads that role onto its drag handles,
        // which set `touch-action: none` because without it the browser's own touch scrolling
        // wins and the drag never starts. Both are one class of specificity, so the winner
        // would come down to injection order — a silent way to break touch reordering.
        // MuiButtonBase-root covers every MUI clickable, whatever element it renders as.
        'button, a, label, summary, input, select, textarea, .MuiButtonBase-root': {
          touchAction: 'manipulation',
        },
        '*::-webkit-scrollbar': { width: 11, height: 11 },
        '*::-webkit-scrollbar-thumb': {
          background: alpha(t.palette.text.disabled, 0.5),
          borderRadius: 99,
          border: '3px solid transparent',
          backgroundClip: 'content-box',
        },
      }),
    },
  },
});
