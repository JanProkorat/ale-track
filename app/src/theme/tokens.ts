// Design tokens for the AleTrack redesign — amber/beer-forward + navy + slate.
// Raw constants used both to build the MUI theme and directly in components
// (e.g. the fixed-navy sidebar). Keep in sync with the prototype.

export const amber = {
  main: '#F08C00',
  hover: '#D97D00',
  strong: '#B4620A',
  tint: '#FDECD2',
  soft: '#FBF4E8',
} as const;

export const navy = {
  base: '#1E2A3A',
  deep: '#17212E',
  raised: '#28394E',
} as const;

export type BrandTokens = {
  amber: string;
  amberHover: string;
  amberStrong: string;
  amberTint: string;
  amberSoft: string;
  navy: string;
  navyDeep: string;
  navyRaised: string;
  surface3: string;
  ground: string;
  okTint: string;
  infoTint: string;
  warnTint: string;
  critTint: string;
  greyPill: string;
  greyTint: string;
};

export const lightBrand: BrandTokens = {
  amber: '#F08C00',
  amberHover: '#D97D00',
  amberStrong: '#B4620A',
  amberTint: '#FDECD2',
  amberSoft: '#FBF4E8',
  navy: '#1E2A3A',
  navyDeep: '#17212E',
  navyRaised: '#28394E',
  surface3: '#EEF2F7',
  ground: '#EEF1F6',
  okTint: '#DCF3E4',
  infoTint: '#D3EFF6',
  warnTint: '#FBE7CC',
  critTint: '#FBE0DE',
  greyPill: '#5A6675',
  greyTint: '#E7EBF1',
};

export const darkBrand: BrandTokens = {
  amber: '#F5A62A',
  amberHover: '#E5941A',
  amberStrong: '#C77B12',
  amberTint: '#3A2C15',
  amberSoft: '#241B0F',
  navy: '#131C28',
  navyDeep: '#0E1620',
  navyRaised: '#20303F',
  surface3: '#243343',
  ground: '#0D141E',
  okTint: '#123021',
  infoTint: '#0E2C36',
  warnTint: '#33260F',
  critTint: '#361A1A',
  greyPill: '#8291A3',
  greyTint: '#23303F',
};

// Semantic status colors per scheme (main hues).
export const lightStatus = {
  ok: '#15873F',
  info: '#0E7C9B',
  warn: '#B4620A',
  crit: '#C22A2A',
} as const;

export const darkStatus = {
  ok: '#3FBE6B',
  info: '#33B7D6',
  warn: '#E5941A',
  crit: '#F0736B',
} as const;

export const fonts = {
  body: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif`,
  mono: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
} as const;
