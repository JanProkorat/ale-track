// Categorical palette for the Reporty charts.
//
// Both arrays are VALIDATED, not picked by eye — they pass the lightness band, chroma
// floor, adjacent-pair CVD separation (protan/deutan/tritan), normal-vision floor and
// contrast checks against this app's card surfaces (#FFFFFF light, #18222F dark). The
// base hues are Okabe-Ito, which is designed for colour-vision deficiency; the dark
// steps are re-selected for the narrower dark lightness band, not flipped.
//
// Deliberate deviation from the prototype: its TYPE_PALETTE fails those checks (two
// near-grey hues, a protan pair at ΔE 3.0), cycles with % over 24 ProductType values,
// and assigns colour after sorting by volume — so changing the period repainted every
// slice. Colour here follows the ENTITY, never its rank.
//
// In light mode the amber and sky-blue slots sit just under 3:1 against a white card,
// so any chart using them must show its legend labels. Do not hide the legend.
import { useColorScheme } from '@mui/material/styles';
import { ProductType } from 'src/generated/api-client';
import { ptypeLabel } from 'src/lib/labels';

export const REPORT_PALETTE_LIGHT = [
  '#E69F00', // amber
  '#56B4E9', // sky
  '#009E73', // green
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#7C3AED', // purple
  '#CC79A7', // pink — also the shared "Ostatní" slot
] as const;

export const REPORT_PALETTE_DARK = [
  '#C48300',
  '#3E9BD4',
  '#009E73',
  '#2C7FC0',
  '#D55E00',
  '#8B5CF6',
  '#BB6E96',
] as const;

/** The slot index shared by every product type outside the fixed six. */
export const OTHER_SLOT = 6;

/**
 * The six product types that get their own hue. Chosen by catalogue prominence and
 * FIXED — never derived from the data, so a period change cannot repaint a slice.
 * Keyed by the enum's member name, resolved the same way `src/lib/labels.ts`
 * resolves either wire form (numeric in demo data, string in the real API).
 */
const TYPE_SLOTS: Partial<Record<keyof typeof ProductType, number>> = {
  PaleDraftBeer: 0,
  PaleLager: 1,
  DarkLager: 2,
  AmberLager: 3,
  SpecialBeer: 4,
  NonAlcoholicBeer: 5,
};

/** Resolves either wire representation of ProductType to its enum member name. */
function typeName(type: ProductType | string | number): string | undefined {
  if (typeof type === 'number') return ProductType[type] as string | undefined;
  return type;
}

/** The palette for the active colour scheme. */
export function useReportPalette(): readonly string[] {
  const { mode, systemMode } = useColorScheme();
  const resolved = mode === 'system' ? (systemMode ?? 'light') : (mode ?? 'light');
  return resolved === 'dark' ? REPORT_PALETTE_DARK : REPORT_PALETTE_LIGHT;
}

/** Stable slot for a product type; everything unlisted shares the last slot. */
export function typeSlot(type: ProductType | string | number): number {
  const name = typeName(type);
  if (!name) return OTHER_SLOT;
  return TYPE_SLOTS[name as keyof typeof ProductType] ?? OTHER_SLOT;
}

export interface TypeVolumeRow {
  type: ProductType | string | number;
  weightKg: number;
  units: number;
}

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Folds per-type volume into at most seven slices: the six fixed types plus a single
 * merged "Ostatní". Sorted heaviest first with Ostatní pinned last, so the legend reads
 * top-down while the colours stay bound to identity.
 */
export function foldTypes(rows: TypeVolumeRow[], palette: readonly string[]): ChartSlice[] {
  const bySlot = new Map<number, { value: number; label: string }>();

  for (const row of rows) {
    const slot = typeSlot(row.type);
    const label = slot === OTHER_SLOT ? 'Ostatní' : (ptypeLabel(row.type) ?? 'Ostatní');
    const current = bySlot.get(slot);
    bySlot.set(slot, { value: (current?.value ?? 0) + row.weightKg, label: current?.label ?? label });
  }

  return [...bySlot.entries()]
    .map(([slot, v]) => ({ label: v.label, value: v.value, color: palette[slot] }))
    .sort((a, b) => {
      if (a.label === 'Ostatní') return 1;
      if (b.label === 'Ostatní') return -1;
      return b.value - a.value;
    });
}
