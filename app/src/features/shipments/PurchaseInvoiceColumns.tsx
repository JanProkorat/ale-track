// The "faktura pivovaru" columns of the nakládka table.
//
// One column per invoice the brewery issues to us, two of them from the start
// whether or not anything is stored behind them. The first is the remainder —
// computed, grey, never editable — and the rest are steppers. Kept out of
// ShipmentDetail because they are self-contained: give them a row and the
// invoices, and they render and commit their own cells.

import { useEffect, useState } from 'react';
import { Box, IconButton, InputBase, Stack, TableCell, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import type { OutgoingShipmentPurchaseInvoiceDto } from 'src/generated/api-client';
import { capFor, claimAt, columnsOf, purchasedTotal, type PurchasableRow } from './purchaseSplitModel';

const CELL_SX = { width: 84, minWidth: 84 } as const;

const HEAD_SX = {
  fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' as const,
  letterSpacing: '0.03em', borderBottom: 'none', whiteSpace: 'nowrap' as const,
};

/** Header cell per column: "F1", "F2"… plus a delete on the stored ones past the first. */
export function PurchaseInvoiceHeaderCells({
  invoices, editable, onDelete,
}: {
  invoices: OutgoingShipmentPurchaseInvoiceDto[];
  editable: boolean;
  onDelete: (invoiceId: string) => void;
}) {
  return (
    <>
      {columnsOf(invoices).map((column) => (
        <TableCell key={column.sequence} align="right" sx={{ ...HEAD_SX, ...CELL_SX }}>
          <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
            <Tooltip title={`Faktura pivovaru ${column.sequence}`}>
              <span>{`F${column.sequence}`}</span>
            </Tooltip>
            {/* Only a materialised invoice can be deleted; an empty extra column has
                nothing behind it to remove. */}
            {editable && column.sequence > 1 && column.id && (
              <IconButton
                size="small"
                onClick={() => onDelete(column.id!)}
                aria-label={`Smazat fakturu ${column.sequence}`}
                sx={{ width: 18, height: 18 }}
              >
                <CloseIcon sx={{ fontSize: 13 }} />
              </IconButton>
            )}
          </Stack>
        </TableCell>
      ))}
    </>
  );
}

/** Row cells: the computed remainder, then one stepper per further column. */
export function PurchaseInvoiceRowCells({
  row, invoices, editable, onSet,
}: {
  row: PurchasableRow;
  invoices: OutgoingShipmentPurchaseInvoiceDto[];
  editable: boolean;
  onSet: (sequence: number, quantity: number) => void;
}) {
  const columns = columnsOf(invoices);
  const total = purchasedTotal(row);

  return (
    <>
      <TableCell align="right" sx={CELL_SX}>
        {total === 0 ? (
          <Tooltip title="Nekupuje se od pivovaru — celé ze skladu">
            <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>
          </Tooltip>
        ) : (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
            {remainderOf(row, invoices)}
          </Typography>
        )}
      </TableCell>
      {columns.slice(1).map((column) => {
        const claimed = claimAt(invoices, column.sequence, row.productId);
        return (
          <TableCell key={column.sequence} align="right" sx={CELL_SX}>
            {total === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>
            ) : editable ? (
              <QuantityStepper
                value={claimed}
                max={capFor(row, invoices, column.sequence)}
                onCommit={(quantity) => onSet(column.sequence, quantity)}
                label={`Kusy na faktuře ${column.sequence}`}
              />
            ) : (
              <Typography sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{claimed}</Typography>
            )}
          </TableCell>
        );
      })}
    </>
  );
}

function remainderOf(row: PurchasableRow, invoices: OutgoingShipmentPurchaseInvoiceDto[]): number {
  const claimed = columnsOf(invoices)
    .slice(1)
    .reduce((sum, column) => sum + claimAt(invoices, column.sequence, row.productId), 0);

  return Math.max(0, purchasedTotal(row) - claimed);
}

/**
 * A piece count for one invoice: `− n +`, with the number itself typable.
 *
 * The buttons match the "ze skladu" control next door and handle the common case of
 * nudging by one or two; the field stays editable because moving 24 pieces should
 * not be 24 clicks. Typing commits on blur or Enter rather than per keystroke —
 * every keystroke would be a request, and an intermediate value would be clamped
 * against the wrong remainder on the way through.
 */
function QuantityStepper({
  value, max, onCommit, label,
}: {
  value: number;
  max: number;
  onCommit: (quantity: number) => void;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  function commit(next: number) {
    const clamped = Math.max(0, Math.min(next, max));
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  }

  return (
    <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
      <IconButton
        size="small"
        onClick={() => commit(value - 1)}
        disabled={value <= 0}
        aria-label={`${label} — ubrat`}
        sx={{ width: 18, height: 18 }}
      >
        <RemoveIcon sx={{ fontSize: 13 }} />
      </IconButton>
      <InputBase
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(parseInt(text, 10) || 0)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        inputProps={{
          'aria-label': label,
          inputMode: 'numeric',
          style: { textAlign: 'center', fontSize: 13, padding: 0, fontVariantNumeric: 'tabular-nums' },
        }}
        sx={{ width: 28 }}
      />
      <IconButton
        size="small"
        onClick={() => commit(value + 1)}
        disabled={value >= max}
        aria-label={`${label} — přidat`}
        sx={{ width: 18, height: 18 }}
      >
        <AddIcon sx={{ fontSize: 13 }} />
      </IconButton>
    </Stack>
  );
}

/** Footer cells: what each column adds up to across the whole nakládka. */
export function PurchaseInvoiceFooterCells({ totals, sx }: { totals: number[]; sx: object }) {
  return (
    <>
      {totals.map((total, index) => (
        <TableCell key={index} align="right" sx={{ ...sx, ...CELL_SX }}>
          <Box component="span" sx={{ color: index === 0 ? 'text.secondary' : 'text.primary' }}>{total} ks</Box>
        </TableCell>
      ))}
    </>
  );
}
