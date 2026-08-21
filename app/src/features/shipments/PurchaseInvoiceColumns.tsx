// The "faktura pivovaru" side of the nakládka table.
//
// One chip per invoice the brewery issues to us, two from the start whether or not
// anything is stored behind them, stacked one to a line inside a single cell. It
// replaces the column pair the table used to spend per invoice: a chip carries its own
// "F1" label, so a fourth invoice costs a line rather than 112px of table width, and
// the cell reads without a column header above it.
//
// The first chip is the remainder — computed, never editable — and the rest are steppers
// capped by `capFor`. Every chip that physically carries pieces gets the three-state
// loading control; the first one does even when it bills nothing, because pieces taken
// out of our own garage ride along on no invoice at all and still have to be loaded.

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Box, ButtonBase, IconButton, InputBase, Stack, TableCell, Tooltip, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
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
import { StatusPill } from 'src/components/common/StatusPill';
import { stepperTracks } from './nakladkaControls';
import { StepperButton } from './StepperButton';

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

/**
 * The value cell of an invoice stepper.
 *
 * Wider than the Zdroj cluster's 22px because this one holds a field, and the theme
 * lifts a field to 16px under a coarse pointer — iOS Safari zooms the whole page for
 * anything smaller.
 */
const INVOICE_VALUE = { value: 26, valueTouch: 34 } as const;

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

/**
 * The chip: label, piece count and loading tick in one pill, tinted with the state it
 * is in — grey while nothing has been dictated, info once it has, success once it has
 * been counted a second time.
 *
 * One pill rather than a number and a control side by side, because on the ramp they
 * are one thing: this many pieces of this product, on this invoice, loaded or not.
 */
const CHIP_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  height: 34,
  pl: '10px',
  pr: '4px',
  maxWidth: '100%',
  borderRadius: 999,
  border: 1,
  // Thumb-sized on the ramp, back to the pointer size once the card is under 500px and
  // Faktury shares the row with Zdroj — see nakladkaControls.
  '@media (pointer: coarse)': {
    height: 44,
    '@container nakladka (max-width: 500px)': { height: 34 },
  },
} as const;

/** The loading tick, and the box a chip carrying nothing yet leaves in its place. */
const TICK_SX = {
  width: 26,
  height: 26,
  flexShrink: 0,
  '@media (pointer: coarse)': {
    width: 34,
    height: 34,
    '@container nakladka (max-width: 500px)': { width: 26, height: 26 },
  },
} as const;

/** The chip's fill: the state's own tint, or the plain surface before it has one. */
function chipFill(t: Theme, tone?: Tone) {
  if (!tone) return t.vars!.palette.brand.surface3;
  return tone === 'success' ? t.vars!.palette.brand.okTint : t.vars!.palette.brand.infoTint;
}

type Tone = 'info' | 'success';

function toneOf(state: LoadingStateName): Tone | undefined {
  return state === 'Checked' ? 'success' : state === 'Dictated' ? 'info' : undefined;
}

/**
 * The invoice split of one nakládka row, as a chip per invoice stacked one to a line.
 *
 * Stacked rather than wrapped: one invoice per line keeps the numbers under each other
 * however many invoices a run has. Each chip lays its number on the same `− value +`
 * tracks (see {@link stepperTracks}), so the computed first column's bare number sits
 * exactly above the editable ones below it.
 */
export function PurchaseInvoiceChips({
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

  // Nothing goes onto any brewery invoice — nothing here to bill or to check off. Still a
  // pill rather than a bare dash, so the cell reads as an empty slot in the same language
  // as the chips on every row around it.
  if (carrying.length === 0) {
    return (
      <Box
        sx={{
          ...CHIP_SX, borderStyle: 'dashed', borderColor: 'divider', color: 'text.disabled',
          pr: '10px', fontSize: 12.5,
        }}
      >
        —
      </Box>
    );
  }

  return (
    <Stack spacing={0.875} alignItems="flex-start">
      {columns.map((column, index) => {
        const claimed = index === 0 ? remainderOf(row, invoices) : claimAt(invoices, column.sequence, row.productId);
        const carries = piecesInColumn(row, invoices, column.sequence) > 0;
        const cap = capFor(row, invoices, column.sequence);
        const stepper = index > 0 && editable;

        // A later column holding nothing is worth a chip only while the row can still be
        // split; read-only it would be a permanent zero taking up a line.
        if (index > 0 && claimed === 0 && !editable) {
          return null;
        }

        const state = loadingStateAt(states, row.productId, column.sequence);
        const tone = toneOf(state);

        return (
          <Box
            key={column.sequence}
            sx={{
              ...CHIP_SX,
              // Tinted with the state's own colour; the border goes with it so the chip
              // reads as one filled thing rather than a filled thing inside a box.
              borderColor: tone ? 'transparent' : 'divider',
              bgcolor: (t) => chipFill(t, tone),
            }}
          >
            <Typography
              sx={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap',
                // Tabular so F1 and F2 measure the same and the numbers after them line up.
                fontVariantNumeric: 'tabular-nums',
                color: tone ? `${tone}.main` : 'text.secondary',
              }}
            >
              F{column.sequence}
            </Typography>
            {stepper ? (
              <QuantityStepper
                value={claimed}
                max={cap}
                onCommit={(quantity) => onSet(column.sequence, quantity)}
                label={`Kusy na faktuře ${column.sequence}`}
              />
            ) : (
              // The same three tracks the steppers use, with the button cells left empty —
              // what keeps the remainder's number above theirs instead of beside its label.
              <StepperCells>
                <span />
                <Typography
                  sx={{
                    fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    textAlign: 'center',
                    color: tone ? `${tone}.main` : 'text.primary',
                  }}
                >
                  {claimed}
                </Typography>
                <span />
              </StepperCells>
            )}
            {carries ? (
              <LoadingStateControl
                state={state}
                editable={editable}
                onChange={(next) => onSetState(column.sequence, next)}
                label={`Nakládka na faktuře ${column.sequence}`}
              />
            ) : (
              // A column with nothing in it yet keeps the tick's place — nothing physically
              // sits there to check off, and letting the pill shrink would put the chips
              // below it at a different width.
              <Box sx={{ ...TICK_SX, display: 'grid', placeItems: 'center', color: 'text.disabled', fontSize: 12.5 }}>
                —
              </Box>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

/**
 * Per-invoice totals and loading progress, for the table's summary bar.
 *
 * Also where an invoice is deleted from. It used to hang off the column header, and the
 * table no longer has one per invoice — the split moved into the row's chips. This is the
 * only other place that still names every invoice once, which is what a per-invoice
 * action needs; on a chip it would have read as deleting that row's pieces.
 */
export function PurchaseInvoiceTotalsLines({
  totals, progress, invoices, editable, onDelete,
}: {
  totals: number[];
  progress: Array<{ dictated: number; checked: number; total: number }>;
  /** Only needed for the delete: which columns are stored, and under what id. */
  invoices?: OutgoingShipmentPurchaseInvoiceDto[];
  editable?: boolean;
  onDelete?: (invoiceId: string) => void;
}) {
  const columns = invoices ? columnsOf(invoices) : [];

  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
      {totals.map((total, index) => {
        const column = columns[index];
        // Only a materialised invoice past the first can go; an empty extra column has
        // nothing behind it to remove.
        const deletable = editable && onDelete && column && column.sequence > 1 && column.id;

        const checked = progress[index]?.checked ?? 0;
        const of = progress[index]?.total ?? 0;
        // Green only once every pair carrying pieces has been counted a second time —
        // the bar is read to answer "is this invoice done", so a partial count is not it.
        const done = of > 0 && checked === of;

        return (
          <Stack key={index} direction="row" spacing={0.25} alignItems="center">
            <StatusPill tone={done ? 'ok' : 'grey'} label={`F${index + 1} ${total} ks · ${checked}/${of}`} />
            {deletable && (
              <IconButton
                size="small"
                onClick={() => onDelete(column.id!)}
                aria-label={`Smazat fakturu ${column.sequence}`}
                sx={{ width: 20, height: 20, alignSelf: 'center' }}
              >
                <CloseIcon sx={{ fontSize: 13 }} />
              </IconButton>
            )}
          </Stack>
        );
      })}
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
 *
 * Filled once it has a state rather than merely re-coloured: it sits inside a chip that
 * is itself tinted with the same state, and a tinted glyph on a tinted pill reads as
 * decoration instead of the row's most-pressed control.
 */
function LoadingStateControl({
  state, editable, onChange, label,
}: {
  state: LoadingStateName;
  editable: boolean;
  onChange: (next: LoadingStateName) => void;
  label: string;
}) {
  const tone = toneOf(state);
  const icon = state === 'Checked'
    ? <DoneAllOutlinedIcon sx={{ fontSize: 15 }} />
    : state === 'Dictated'
      ? <RecordVoiceOverOutlinedIcon sx={{ fontSize: 14 }} />
      : <Box sx={{ width: 11, height: 11, borderRadius: '3px', border: 2, borderColor: 'currentColor' }} />;

  return (
    <Tooltip title={editable ? `${STATE_LABEL[state]} — klikněte pro další stav` : STATE_LABEL[state]}>
      <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
        <ButtonBase
          disabled={!editable}
          onClick={() => onChange(nextLoadingState(state))}
          aria-label={`${label}: ${STATE_LABEL[state]}`}
          sx={{
            ...TICK_SX,
            borderRadius: '50%',
            border: 1,
            borderColor: tone ? `${tone}.main` : 'divider',
            bgcolor: tone ? `${tone}.main` : 'background.paper',
            color: tone ? 'common.white' : 'text.disabled',
            '&:hover': tone ? undefined : {
              borderColor: 'primary.main',
              color: (t: Theme) => t.vars!.palette.brand.amberStrong,
            },
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

/** The `− value +` block every chip's number sits on, stepper or not. */
function StepperCells({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'inline-grid', alignItems: 'center', columnGap: '1px', ...stepperTracks(INVOICE_VALUE) }}>
      {children}
    </Box>
  );
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
    <StepperCells>
      <StepperButton
        sign={-1}
        onClick={() => commit(value - 1)}
        disabled={value <= 0}
        label={`${label} — ubrat`}
      />
      <InputBase
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(parseInt(text, 10) || 0)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        inputProps={{ 'aria-label': label, inputMode: 'numeric' }}
        // The size lives on the root so the field inherits it — the theme lifts the input
        // itself to 16px under a coarse pointer, and an inline size here would beat that
        // rule and hand iOS Safari a reason to zoom the page on focus.
        sx={{
          fontSize: 13,
          fontWeight: 700,
          minWidth: 0,
          '& input': { textAlign: 'center', p: 0, fontVariantNumeric: 'tabular-nums' },
        }}
      />
      <StepperButton
        sign={1}
        onClick={() => commit(value + 1)}
        disabled={value >= max}
        label={`${label} — přidat`}
      />
    </StepperCells>
  );
}
