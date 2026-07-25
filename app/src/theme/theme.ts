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

const radius = 11;

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
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
        paper: { backgroundImage: 'none' },
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
    // Sub-tabs (Info/Ceník/…) — match the prototype's .tabs button (13.5px/700).
    MuiTab: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: '0.84rem', textTransform: 'none', minHeight: 48 },
      },
    },
    MuiCssBaseline: {
      styleOverrides: (t) => ({
        '::selection': { background: alpha(t.palette.primary.main, 0.28) },
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
