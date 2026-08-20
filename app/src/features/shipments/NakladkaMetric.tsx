// One labelled number of a nakládka row on the phone layout.
//
// The stacked layout can't afford a line per number — a product carries up to five
// of them (brewery, garage, stock, and one per brewery invoice) and the list runs to
// thirty-odd products. So each becomes an inline `label value` group instead, and a
// row's numbers sit across the fixed slots below rather than down five lines.
//
// Shared by ShipmentDetail (the sourcing numbers) and PurchaseInvoiceColumns (the
// invoice split), which is why it sits in its own module rather than either of them.

import type { ReactNode } from 'react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';

/** A slot holding a bare labelled number: "Z pivovaru 20", or "F1 40" and its control. */
const SLOT_PLAIN = 88;

/**
 * A slot holding a labelled number between two 28px steppers — "Do garáže − 100 +",
 * the widest label of the run, or an invoice's stepper pair plus its 34px control.
 * Both land a few pixels under this.
 */
const SLOT_STEPPER = 144;

/**
 * The run a row's metric groups sit on, and the whole reason they line up.
 *
 * Every slot reserves the same width on every row, so a given number sits in one
 * column all the way down the list and the ramp can find it without reading the
 * label. What broke before was not the wrapping but the sizing: groups took their
 * content's width, so a product without "Do garáže" put its neighbours' numbers
 * somewhere else entirely and the line wrapped in a different place on every row.
 *
 * The widths are reserved as `minWidth`, not `width`: a label that measures wider
 * than the estimate above then pushes its own slot instead of overlapping the next
 * one — a row slightly out of line beats a row that reads as two numbers run together.
 *
 * Wrapping rather than stretching to fill: a 390px phone fits two slots and a
 * squeezed tablet column three or four, and the leftover belongs in one piece at the
 * right edge. Split across the slots as `1fr` tracks it put a 70px chasm between
 * "Z pivovaru" and the number beside it.
 */
export const METRIC_ROW_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 1.5,
  rowGap: 0.5,
} as const;

/**
 * One slot of {@link METRIC_ROW_SX}, by position in the run. The first holds a bare
 * number — "Z pivovaru", or an invoice's uneditable remainder — and the rest a
 * number between two steppers, in both the sourcing run and the invoice one.
 *
 * Rendered empty for a slot the row has nothing to put in, which is what keeps the
 * slots after it under the same ones on every other row.
 */
export function MetricSlot({ index, children }: { index: number; children?: ReactNode }) {
  return (
    <Box sx={{ flex: '0 0 auto', minWidth: index === 0 ? SLOT_PLAIN : SLOT_STEPPER }}>
      {children}
    </Box>
  );
}

export interface MetricAdjust {
  onAdjust: (delta: number) => void;
  canDecrease: boolean;
  canIncrease: boolean;
  decreaseLabel: string;
  increaseLabel: string;
}

export function NakladkaMetric({
  label, value, tone, adjust,
}: {
  label: string;
  value: number;
  /** Colour of the number; plain for what is merely reported, tinted where edited. */
  tone?: string;
  adjust?: MetricAdjust;
}) {
  const buttonSx = { width: 28, height: 28, color: 'info.main' };

  return (
    <Stack direction="row" alignItems="center" spacing={0.25} sx={{ minWidth: 0 }}>
      {/* Never wrapped: a label folded onto two lines makes its row taller than its
          neighbours and breaks the column of numbers the slots exist to keep straight. */}
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mr: 0.25, whiteSpace: 'nowrap' }}>{label}</Typography>
      {adjust && (
        <IconButton
          size="small"
          onClick={() => adjust.onAdjust(-1)}
          disabled={!adjust.canDecrease}
          aria-label={adjust.decreaseLabel}
          sx={buttonSx}
        >
          <RemoveIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
      <Typography
        sx={{
          fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          // Room for three digits whether or not they are used: a 0 next to a 20 in
          // the column below it otherwise shifts the + button that follows it.
          minWidth: 22, textAlign: 'center',
          color: value > 0 ? tone ?? 'text.primary' : 'text.disabled',
        }}
      >
        {value}
      </Typography>
      {adjust && (
        <IconButton
          size="small"
          onClick={() => adjust.onAdjust(1)}
          disabled={!adjust.canIncrease}
          aria-label={adjust.increaseLabel}
          sx={buttonSx}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Stack>
  );
}
