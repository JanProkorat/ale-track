// One labelled number of a nakládka row on the phone layout.
//
// The stacked layout can't afford a line per number — a product carries up to five
// of them (brewery, garage, stock, and one per brewery invoice) and the list runs to
// thirty-odd products. So each becomes an inline `label value` group instead, and a
// row's numbers flow across one wrapping line rather than down five.
//
// Shared by ShipmentDetail (the sourcing numbers) and PurchaseInvoiceColumns (the
// invoice split), which is why it sits in its own module rather than either of them.

import type { ReactNode } from 'react';
import { IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';

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
    <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mr: 0.25 }}>{label}</Typography>
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
          minWidth: 14, textAlign: 'center',
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

/** Separates the sourcing numbers from the invoice split on a metric line. */
export function MetricDivider(): ReactNode {
  return (
    <Typography aria-hidden sx={{ fontSize: 13, color: 'text.disabled', alignSelf: 'center' }}>·</Typography>
  );
}
