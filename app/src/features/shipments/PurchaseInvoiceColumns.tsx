// The "faktura pivovaru" columns of the nakládka table.
//
// One column per invoice the brewery issues to us, two of them from the start
// whether or not anything is stored behind them. The first is the remainder —
// computed, grey, never editable — and the rest are steppers. Kept out of
// ShipmentDetail because they are self-contained: give them a row and the
// invoices, and they render and commit their own cells.
//
// Below the `compact` breakpoint the nakládka is a stacked list rather than a
// table, so the same controls also come in a phone form: the piece counts as
// inline `F1 3` metric groups, the loading states as thumb-sized buttons on the
// row's first line. Same model calls, same commits — only the frame differs.

import { Fragment, useEffect, useState } from 'react';
import { Box, ButtonBase, IconButton, InputBase, Stack, TableCell, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import type {
  OutgoingShipmentLoadingStateDto,
  OutgoingShipmentPurchaseInvoiceDto,
} from 'src/generated/api-client';
import {
  capFor, claimAt, columnsOf, loadingStateAt, nextLoadingState, piecesInColumn, purchasedTotal,
  type LoadingStateName, type PurchasableRow,
} from './purchaseSplitModel';
import { NakladkaMetric } from './NakladkaMetric';

// The two cells of a column group are pulled together rather than each centred in
// its own box: the pieces end on the right of theirs, the state starts on the left
// of its, so the pair reads as one thing under the shared header.
const CELL_SX = { width: 72, minWidth: 72, pr: 0.5 } as const;

/** The state cell of a column group — only as wide as the control in it. */
const STATE_CELL_SX = { width: 40, minWidth: 40, pl: 0.5 } as const;

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
      {/* One header spanning the column's two cells: the pieces and their loading state. */}
      {columnsOf(invoices).map((column) => (
        <TableCell key={column.sequence} align="center" colSpan={2} sx={{ ...HEAD_SX, width: 112, minWidth: 112 }}>
          <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
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

/**
 * Row cells: per column, the pieces and how far they have got through loading.
 *
 * The two numbers a column answers to are not the same question. The piece count is
 * what the invoice bills, so the first column shows only what is bought; the loading
 * state covers what is physically there, which in the first column also includes the
 * pieces taken from our own garage — they ride along on no invoice at all.
 */
export function PurchaseInvoiceRowCells({
  row, invoices, states, editable, onSet, onSetState,
}: {
  row: PurchasableRow;
  invoices: OutgoingShipmentPurchaseInvoiceDto[];
  states: OutgoingShipmentLoadingStateDto[];
  editable: boolean;
  onSet: (sequence: number, quantity: number) => void;
  onSetState: (sequence: number, state: LoadingStateName) => void;
}) {
  const columns = columnsOf(invoices);
  const total = purchasedTotal(row);

  return (
    <>
      {columns.map((column, index) => {
        const claimed = index === 0 ? remainderOf(row, invoices) : claimAt(invoices, column.sequence, row.productId);
        const carries = piecesInColumn(row, invoices, column.sequence) > 0;
        const state = loadingStateAt(states, row.productId, column.sequence);

        return (
          <Fragment key={column.sequence}>
            <TableCell align="right" sx={CELL_SX}>
              {total === 0 ? (
                <Tooltip title="Nekupuje se od pivovaru — celé ze skladu">
                  <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>
                </Tooltip>
              ) : index === 0 ? (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {claimed}
                </Typography>
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
            <TableCell align="left" sx={STATE_CELL_SX}>
              {carries ? (
                <LoadingStateControl
                  state={state}
                  editable={editable}
                  onChange={(next) => onSetState(column.sequence, next)}
                  label={`Nakládka na faktuře ${column.sequence}`}
                />
              ) : (
                <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>
              )}
            </TableCell>
          </Fragment>
        );
      })}
    </>
  );
}

/** Thumb-sized hit area for the stacked layout. */
const TOUCH_TARGET = 34;

/**
 * The same column pair as {@link PurchaseInvoiceRowCells}, as inline `F1 3` groups
 * for the stacked layout — a line each was four lines of mostly zeroes. Each group
 * carries its own loading-state control right after the number, same pairing as
 * the desktop table's two cells per column; a separate row of controls up in the
 * header read as unrelated to the invoice they belonged to and left the header
 * cramped besides. A column carrying nothing yet gets a "—" instead of the control
 * — nothing physically sits there to check off — rather than being skipped, so the
 * row still shows one slot per invoice.
 *
 * The first column is the remainder and never editable, so it is a bare number;
 * it still gets the control, because pieces taken from our own garage ride along
 * on it with no invoice behind them at all and still have to be loaded.
 *
 * Rendered into the row's metric grid (`METRIC_GRID_SX`), one cell per column: a
 * column with nothing to show still spends its cell, or the columns after it would
 * sit a track left of where the same invoice sits on every other row.
 */
export function PurchaseInvoiceRowMetrics({
  row, invoices, states, editable, onSet, onSetState,
}: {
  row: PurchasableRow;
  invoices: OutgoingShipmentPurchaseInvoiceDto[];
  states: OutgoingShipmentLoadingStateDto[];
  editable: boolean;
  onSet: (sequence: number, quantity: number) => void;
  onSetState: (sequence: number, state: LoadingStateName) => void;
}) {
  const columns = columnsOf(invoices);
  const carrying = columns.filter((column) => piecesInColumn(row, invoices, column.sequence) > 0);

  // Nothing physically goes onto any brewery invoice column — the row is served
  // entirely off our own shelf, with nothing left here to bill or to check off.
  if (carrying.length === 0) {
    return null;
  }

  return (
    <>
      {columns.map((column, index) => {
        const claimed = index === 0 ? remainderOf(row, invoices) : claimAt(invoices, column.sequence, row.productId);
        const carries = piecesInColumn(row, invoices, column.sequence) > 0;
        // A later column with nothing in it is worth a stepper only while the row can
        // still be split; read-only it would be a permanent zero taking up the line.
        // Its grid cell stays, so the columns after it keep their place.
        if (index > 0 && claimed === 0 && !editable) {
          return <span key={column.sequence} />;
        }

        return (
          <Stack key={column.sequence} direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
            <NakladkaMetric
              label={`F${column.sequence}`}
              value={claimed}
              tone={index === 0 ? 'text.secondary' : undefined}
              adjust={index > 0 && editable ? {
                onAdjust: (delta) => onSet(
                  column.sequence,
                  Math.max(0, Math.min(claimed + delta, capFor(row, invoices, column.sequence))),
                ),
                canDecrease: claimed > 0,
                canIncrease: claimed < capFor(row, invoices, column.sequence),
                decreaseLabel: `Ubrat kus z faktury ${column.sequence}`,
                increaseLabel: `Přidat kus na fakturu ${column.sequence}`,
              } : undefined}
            />
            {carries ? (
              <LoadingStateControl
                state={loadingStateAt(states, row.productId, column.sequence)}
                editable={editable}
                onChange={(next) => onSetState(column.sequence, next)}
                label={`Nakládka na faktuře ${column.sequence}`}
                size={TOUCH_TARGET}
              />
            ) : (
              <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>
            )}
          </Stack>
        );
      })}
    </>
  );
}

/** Per-invoice totals for the stacked layout's summary bar. */
export function PurchaseInvoiceTotalsLines({
  totals, progress,
}: {
  totals: number[];
  progress: Array<{ dictated: number; checked: number; total: number }>;
}) {
  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
      {totals.map((total, index) => (
        <Stack key={index} direction="row" spacing={0.5} alignItems="baseline">
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>{`F${index + 1}`}</Typography>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{total} ks</Typography>
          <Typography
            sx={{
              fontSize: 11,
              color: (progress[index]?.total ?? 0) > 0 && progress[index]?.checked === progress[index]?.total
                ? 'success.main'
                : 'text.secondary',
            }}
          >
            {progress[index]?.checked ?? 0}/{progress[index]?.total ?? 0}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

const STATE_LABEL: Record<LoadingStateName, string> = {
  NotLoaded: 'Nenaloženo',
  Dictated: 'Nadiktováno',
  Checked: 'Zkontrolováno',
};

/**
 * One control for both loading passes: empty → nadiktováno → zkontrolováno, wrapping
 * back to empty.
 *
 * A pair of checkboxes per column would have doubled the width every new invoice adds,
 * and the two were never independent anyway — nothing is checked before it is loaded.
 */
function LoadingStateControl({
  state, editable, onChange, label, size = 26,
}: {
  state: LoadingStateName;
  editable: boolean;
  onChange: (next: LoadingStateName) => void;
  label: string;
  /** Diameter of the hit area. The stacked layout uses a thumb-sized one. */
  size?: number;
}) {
  const done = state === 'Checked';
  const glyph = Math.round(size * 0.65);
  const icon = state === 'NotLoaded'
    ? <Box sx={{ width: glyph - 4, height: glyph - 4, borderRadius: '4px', border: 2, borderColor: 'text.disabled' }} />
    : done
      ? <DoneAllOutlinedIcon sx={{ fontSize: glyph }} />
      : <RecordVoiceOverOutlinedIcon sx={{ fontSize: glyph }} />;

  return (
    <Tooltip title={editable ? `${STATE_LABEL[state]} — klikněte pro další stav` : STATE_LABEL[state]}>
      <Box component="span">
        <ButtonBase
          disabled={!editable}
          onClick={() => onChange(nextLoadingState(state))}
          aria-label={`${label}: ${STATE_LABEL[state]}`}
          sx={{
            width: size, height: size, borderRadius: '50%',
            color: done ? 'success.main' : state === 'Dictated' ? 'info.main' : 'text.disabled',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {icon}
        </ButtonBase>
      </Box>
    </Tooltip>
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
    <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
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
export function PurchaseInvoiceFooterCells({
  totals, progress, sx,
}: {
  totals: number[];
  /** Loaded/checked out of the pairs that carry pieces, per column. */
  progress: Array<{ dictated: number; checked: number; total: number }>;
  sx: object;
}) {
  return (
    <>
      {totals.map((total, index) => (
        <Fragment key={index}>
          <TableCell align="right" sx={{ ...sx, ...CELL_SX }}>
            <Box component="span" sx={{ color: index === 0 ? 'text.secondary' : 'text.primary' }}>{total} ks</Box>
          </TableCell>
          <TableCell align="left" sx={{ ...sx, ...STATE_CELL_SX }}>
            <Tooltip title={`Nadiktováno ${progress[index]?.dictated ?? 0}/${progress[index]?.total ?? 0}, zkontrolováno ${progress[index]?.checked ?? 0}/${progress[index]?.total ?? 0}`}>
              <Box
                component="span"
                sx={{
                  fontSize: 11,
                  color: (progress[index]?.total ?? 0) > 0 && progress[index]?.checked === progress[index]?.total
                    ? 'success.main'
                    : 'text.secondary',
                }}
              >
                {progress[index]?.checked ?? 0}/{progress[index]?.total ?? 0}
              </Box>
            </Tooltip>
          </TableCell>
        </Fragment>
      ))}
    </>
  );
}
