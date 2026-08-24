// The inline diff, one place for every screen that shows one: the old value struck through,
// the new one highlighted, and a worded tag beside it.
//
// Two constraints the prototype spells out and this file has to keep:
//
//   1. Colour is never the only signal. A colour-blind reader and a printed copy both get
//      nothing but the tag's text, so every changed row carries one.
//   2. Colours come through theme.vars.palette.* — this app runs MUI cssVars, and reading
//      theme.palette.* inside an sx callback freezes the light value and breaks dark mode.

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { deviationText, deviationTone, entryTooltip, type DecoratedRow, type LedgerTone } from './ledgerModel';

const TONE_COLOR: Record<LedgerTone, { fg: string; bg: 'critTint' | 'okTint' | 'infoTint' | 'amberTint' }> = {
  less: { fg: 'error.main', bg: 'critTint' },
  more: { fg: 'success.main', bg: 'okTint' },
  new: { fg: 'info.main', bg: 'infoTint' },
  info: { fg: 'warning.dark', bg: 'amberTint' },
};

/** The worded tag: what changed, with why/who/when on its tooltip. */
export function LedgerTag({
  tone,
  label,
  title,
  icon,
}: {
  tone: LedgerTone;
  label: string;
  title?: string;
  icon?: ReactNode;
}) {
  const color = TONE_COLOR[tone];

  const tag = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.375,
        px: 0.75,
        py: 0.125,
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        color: color.fg,
        bgcolor: (t) => t.vars!.palette.brand[color.bg],
        '& svg': { fontSize: 12 },
      }}
    >
      {icon}
      {label}
    </Box>
  );

  return title ? <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{title}</Box>}>{tag}</Tooltip> : tag;
}

/** A row's tag, or nothing when the plan happened as planned. */
export function LedgerRowTag({ row }: { row: DecoratedRow }) {
  const tone = deviationTone(row);
  const label = deviationText(row);
  if (!tone || !label) return null;

  return <LedgerTag tone={tone} label={label} title={entryTooltip(row.entry)} />;
}

/** The planned value, struck through. */
export function DiffOld({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{ textDecoration: 'line-through', color: 'text.disabled', fontWeight: 600 }}
    >
      {children}
    </Box>
  );
}

/** The value that actually happened. */
export function DiffNew({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={{ color: 'warning.dark', fontWeight: 800 }}>
      {children}
    </Box>
  );
}

/**
 * A row's quantity, diffed when it changed.
 *
 * A row nothing was planned for shows only what arrived: there is no old value to strike, and a
 * struck-through zero reads as an error rather than as "this was never ordered".
 */
export function QuantityDiff({ row, unit = 'ks' }: { row: DecoratedRow; unit?: string }) {
  if (row.status === 'unchanged') {
    return (
      <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {row.plannedQuantity} {unit}
      </Box>
    );
  }

  if (row.status === 'added') {
    return <DiffNew>{row.actualQuantity} {unit}</DiffNew>;
  }

  return (
    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <DiffOld>{row.plannedQuantity} {unit}</DiffOld>{' '}
      <DiffNew>{row.actualQuantity} {unit}</DiffNew>
    </Box>
  );
}

/** Two lines: where it was meant to go, and where it went. */
export function TextDiff({ before, after }: { before?: string; after?: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" component="div"><DiffOld>{before || '—'}</DiffOld></Typography>
      <Typography variant="body2" component="div"><DiffNew>{after || '—'}</DiffNew></Typography>
    </Stack>
  );
}
