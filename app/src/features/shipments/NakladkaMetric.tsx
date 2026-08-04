// One labelled number of a nakládka row on the phone layout.
//
// The stacked layout can't afford a line per number — a product carries up to five
// of them (brewery, garage, stock, and one per brewery invoice) and the list runs to
// thirty-odd products. So each becomes an inline `label value` group instead, and a
// row's numbers sit on the shared grid below rather than down five lines.
//
// Shared by ShipmentDetail (the sourcing numbers) and PurchaseInvoiceColumns (the
// invoice split), which is why it sits in its own module rather than either of them.

import { IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';

/**
 * Width of one metric slot on the stacked layout's grid.
 *
 * The widest group is a labelled three-digit number between two 28px steppers
 * ("Do garáže − 100 +"), or an invoice number followed by its 34px loading
 * control — both land just under this.
 */
const METRIC_TRACK = 140;

/**
 * The grid a row's metric groups are placed on, and the whole reason they line up.
 *
 * Flowing them along a wrapping flex line broke down the moment two products
 * carried a different number of groups: the line wrapped in a different place on
 * every row, so no two rows had their numbers in the same column and a stray
 * group dangled alone on a second line. A grid of fixed-width tracks wraps at the
 * same place for every row instead — the track count follows the card width, which
 * every row shares — so a given number sits in one column all the way down the list
 * and the ramp can find it without reading the label.
 *
 * `auto-fill` rather than a fixed count: the same rule has to serve a 390px phone
 * (two tracks) and a squeezed tablet column (three), and `1fr` lets the tracks take
 * the leftover width instead of leaving a ragged gap at the right edge.
 */
export const METRIC_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${METRIC_TRACK}px, 1fr))`,
  alignItems: 'center',
  columnGap: 0.5,
  rowGap: 0.25,
} as const;

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
          neighbours and breaks the run of numbers the grid exists to keep straight. */}
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
