// The "faktura pivovaru" columns of the nakládka table.
//
// One column per invoice the brewery issues to us. The first is the remainder —
// computed, grey, never editable — and the rest are number inputs. Kept out of
// ShipmentDetail because they are self-contained: give them a row and the
// invoices, and they render and commit their own cells.

import { useEffect, useState } from 'react';
import { Box, IconButton, Stack, TableCell, TextField, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import type { OutgoingShipmentPurchaseInvoiceDto } from 'src/generated/api-client';
import { capFor, claimOf, orderedInvoices, purchasedTotal, type PurchasableRow } from './purchaseSplitModel';

const CELL_SX = { width: 96, minWidth: 96 } as const;

const HEAD_SX = {
  fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' as const,
  letterSpacing: '0.03em', borderBottom: 'none',
};

/** Header cell per invoice: its number, the brewery's own number, and a delete on 2+. */
export function PurchaseInvoiceHeaderCells({
  invoices, editable, onLabel, onDelete,
}: {
  invoices: OutgoingShipmentPurchaseInvoiceDto[];
  editable: boolean;
  onLabel: (invoiceId: string, label: string) => void;
  onDelete: (invoiceId: string) => void;
}) {
  return (
    <>
      {orderedInvoices(invoices).map((invoice, index) => (
        <TableCell key={invoice.id} align="right" sx={{ ...HEAD_SX, ...CELL_SX }}>
          <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
            <span>{`Faktura ${invoice.sequence ?? index + 1}`}</span>
            {editable && index > 0 && (
              <IconButton
                size="small"
                onClick={() => onDelete(invoice.id!)}
                aria-label={`Smazat fakturu ${invoice.sequence ?? index + 1}`}
                sx={{ width: 18, height: 18 }}
              >
                <CloseIcon sx={{ fontSize: 13 }} />
              </IconButton>
            )}
          </Stack>
          <InvoiceLabel invoice={invoice} editable={editable} onCommit={onLabel} />
        </TableCell>
      ))}
    </>
  );
}

/** The brewery's own invoice number. Free text, optional, committed on blur. */
function InvoiceLabel({
  invoice, editable, onCommit,
}: {
  invoice: OutgoingShipmentPurchaseInvoiceDto;
  editable: boolean;
  onCommit: (invoiceId: string, label: string) => void;
}) {
  const [value, setValue] = useState(invoice.label ?? '');
  useEffect(() => { setValue(invoice.label ?? ''); }, [invoice.label]);

  if (!editable) {
    return invoice.label
      ? <Typography sx={{ fontSize: 10.5, fontWeight: 600, textTransform: 'none' }}>{invoice.label}</Typography>
      : null;
  }

  return (
    <TextField
      variant="standard"
      placeholder="č. faktury"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if ((invoice.label ?? '') !== value) onCommit(invoice.id!, value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      slotProps={{ htmlInput: { maxLength: 30, style: { textAlign: 'right', fontSize: 11, textTransform: 'none' } } }}
      sx={{ mt: 0.25, '& .MuiInput-underline:before': { borderBottomStyle: 'dotted' } }}
      fullWidth
    />
  );
}

/** Row cells: the computed remainder, then one input per further invoice. */
export function PurchaseInvoiceRowCells({
  row, invoices, editable, onSet,
}: {
  row: PurchasableRow;
  invoices: OutgoingShipmentPurchaseInvoiceDto[];
  editable: boolean;
  onSet: (invoiceId: string, quantity: number) => void;
}) {
  const ordered = orderedInvoices(invoices);
  const total = purchasedTotal(row);
  const claims = ordered.slice(1).map((invoice) => claimOf(invoice, row.productId));
  const remainder = Math.max(0, total - claims.reduce((a, b) => a + b, 0));

  return (
    <>
      <TableCell align="right" sx={CELL_SX}>
        {total === 0 ? (
          <Tooltip title="Nekupuje se od pivovaru — celé ze skladu">
            <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>
          </Tooltip>
        ) : (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
            {remainder}
          </Typography>
        )}
      </TableCell>
      {ordered.slice(1).map((invoice, index) => (
        <TableCell key={invoice.id} align="right" sx={CELL_SX}>
          {total === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>
          ) : editable ? (
            <QuantityInput
              value={claims[index]}
              max={capFor(row, invoices, invoice.id!)}
              onCommit={(quantity) => onSet(invoice.id!, quantity)}
              label={`Kusy na faktuře ${invoice.sequence ?? index + 2}`}
            />
          ) : (
            <Typography sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{claims[index]}</Typography>
          )}
        </TableCell>
      ))}
    </>
  );
}

/**
 * A piece count for one invoice. Commits on blur or Enter, never mid-typing —
 * every keystroke would be a request, and an intermediate value would be clamped
 * against the wrong remainder on the way through.
 */
function QuantityInput({
  value, max, onCommit, label,
}: {
  value: number;
  max: number;
  onCommit: (quantity: number) => void;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  function commit() {
    const parsed = Math.max(0, Math.min(parseInt(text, 10) || 0, max));
    setText(String(parsed));
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <TextField
      type="number"
      size="small"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      slotProps={{ htmlInput: { min: 0, max, 'aria-label': label, style: { textAlign: 'right', fontSize: 13, padding: '4px 6px' } } }}
      sx={{ width: 68 }}
    />
  );
}

/** Footer cells: what each invoice adds up to across the whole nakládka. */
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
