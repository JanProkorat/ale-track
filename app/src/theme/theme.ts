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
    MuiCard: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 16,
          border: `1px solid ${t.palette.divider}`,
          backgroundImage: 'none',
        }),
      },
      defaultProps: { elevation: 0 },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme: t }) => ({
          backgroundColor: t.palette.brand.navy,
          fontSize: 12,
        }),
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
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
