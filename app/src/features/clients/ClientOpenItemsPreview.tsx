// The client's open points, above the cart.
//
// Above it, not beside the save button: whoever builds the next order needs to see what is
// outstanding BEFORE they start filling the cart, not after.
//
// Every row says three things — what happened, what has to happen about it, and where it came
// from. It used to say only the last of those for anything the cart could not carry, which on a
// client with a money debt and two crates of empties outstanding read as a list of labels with
// nothing to do about any of them. The instruction comes from `ledgerTodo`, so the shipment's
// recording form, the client profile and this card cannot disagree about what closes a point.

import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ledgerTargetLabel } from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { type ClientLedgerEntryDto } from 'src/generated/api-client';
import {
  billablePieces,
  canBeBilled,
  canGoToCart,
  canGoToExtras,
  canGoToGoods,
  canGoToReturns,
  entryDisplayName,
  entryTooltip,
  groupByOrder,
  isAssigned,
  isOpen,
  isQuantityEntry,
  ledgerTodo,
  moneySummary,
  moneyText,
  owedPieces,
  plannedActualText,
} from './ledgerModel';
import { LedgerTag } from './LedgerDiff';

/** One open point: what it is, what has to happen about it, and what this screen can do. */
function OpenItemRow({
  entry,
  added,
  promised,
  carriedElsewhere,
  onAddToOrder,
  onAddToGoods,
  onAddToExtras,
  onAddToReturns,
  onAddToBill,
  onAddNote,
  onUnpromise,
}: {
  entry: ClientLedgerEntryDto;
  /** How much of it the draft already carries — a cart line or a vratka row. */
  added: number;
  /** Whether this order has taken the point on: promised on save, closed on delivery. */
  promised: boolean;
  /** Whether a different order is bringing it, which is nobody's business but that order's. */
  carriedElsewhere: boolean;
  onAddToOrder: (entry: ClientLedgerEntryDto) => void;
  onAddToGoods?: (entry: ClientLedgerEntryDto) => void;
  onAddToExtras?: (entry: ClientLedgerEntryDto) => void;
  onAddToReturns?: (entry: ClientLedgerEntryDto) => void;
  onAddToBill?: (entry: ClientLedgerEntryDto) => void;
  onAddNote?: (entry: ClientLedgerEntryDto) => void;
  onResolve?: (entry: ClientLedgerEntryDto) => void;
  onUnpromise?: (entry: ClientLedgerEntryDto) => void;
}) {
  const { formatMoney } = useCurrency();
  const todo = ledgerTodo(entry, formatMoney);

  // What this screen can actually do about it. A point already carried — by this order or by
  // another — offers nothing to add: promising it twice is how two orders end up carrying the
  // same three kegs.
  const settled = promised || carriedElsewhere;
  const toCart = !settled && todo.action === 'order' && canGoToCart(entry);
  const toGoods = !settled && todo.action === 'goods' && canGoToGoods(entry)
    && onAddToGoods !== undefined;
  const toExtras = !settled && todo.action === 'extras' && canGoToExtras(entry)
    && onAddToExtras !== undefined;
  const toReturns = !settled && todo.action === 'returns' && canGoToReturns(entry)
    && onAddToReturns !== undefined;
  const toBill = !settled && todo.action === 'bill' && canBeBilled(entry)
    && onAddToBill !== undefined;
  // Nothing a delivery settles by itself — cash to collect, a deposit to give back, a note to
  // act on. The order can still carry it, as a reminder rather than as a line.
  const toNote = !settled && todo.action === 'none' && onAddNote !== undefined;

  // Whether the row still counts what the draft carries: a promised point does, so the shortfall
  // stays visible right up to the save that warns about it.
  const trackable = promised || toCart || toGoods || toExtras || toReturns || toBill;

  // What the row is counting down: pieces owed to the client, or pieces the client owes for.
  const owed = toBill ? billablePieces(entry) : owedPieces(entry);

  const headline = entryDisplayName(entry)
    ?? (entry.amount != null
      ? `${moneyText(entry)} ${formatMoney(Math.abs(entry.amount))}`
      : 'Změna');
  const tracked = trackable;

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* A floor, not a hint: with minWidth 0 the row squeezed the text to a couple of words
            per line and broke "doúčtovat 1 ks" in half rather than letting the tag and the
            button wrap, which is what should give way first. */}
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography noWrap title={headline} sx={{ fontWeight: 700, fontSize: 13.5, minWidth: 0 }}>
              {headline}
            </Typography>
            {/* One group, never shrunk and never wrapped: what the point is about and what state
                it is in belong side by side, and the name is what gives way when the column is
                narrow — the full name is on the title attribute. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
              <LedgerTag
                tone="info"
                label={ledgerTargetLabel(entry.target) ?? '—'}
                title={entryTooltip(entry)}
              />
              {/* The promise, in one wording whether it was made a moment ago or on an earlier
                  save: the server closes the point when this order arrives, not now. */}
              {promised && <LedgerTag tone="new" label="vyřeší tato objednávka" />}
              {/* Somebody else's to bring, and named as such — telling the reader that THIS order
                  settles it would be the double-promise the assignment state exists to prevent. */}
              {carriedElsewhere && <LedgerTag tone="new" label="vyřeší jiná objednávka" />}
            </Box>
          </Stack>

          {/* What to do about it, and the pair the number came from. Resolution is binary, so a
              short top-up closes the whole debt and loses the remainder — saying what is added
              out loud is the only way that cost is visible before it is paid. */}
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {todo.text}
            </Box>
            {tracked && added > 0 && ` · přidáno ${added} ks`}
          </Typography>

          {/* No order number: the group header above says which delivery this came off. */}
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
            {[
              isQuantityEntry(entry) ? plannedActualText(entry) : undefined,
              fmtDate(entry.createdAt),
            ].filter(Boolean).join(' · ')}
          </Typography>
        </Box>

        {/* Only the shortfall. A green "dorovnáno" beside a draft read as "done" while nothing was
            done yet — the point is settled by the delivery, and then it leaves this card entirely,
            which is the only honest final state. */}
        {tracked && added > 0 && added < owed && <LedgerTag tone="less" label={`chybí ${owed - added} ks`} />}

        {toCart && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onAddToOrder(entry)}
            sx={{ fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Přidat do objednávky
          </Button>
        )}

        {toGoods && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onAddToGoods!(entry)}
            sx={{ fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Přidat zboží do objednávky
          </Button>
        )}

        {toBill && (
          <Button
            size="small"
            startIcon={<ReceiptLongOutlinedIcon />}
            onClick={() => onAddToBill!(entry)}
            sx={{ fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Přidat k dofakturaci
          </Button>
        )}

        {/* describeChild, or MUI puts the title on the button as its aria-label and the button
            loses the name it has of its own — "Připomenout". */}
        {toNote && (
          <Tooltip describeChild title="Zapíše to do poznámek objednávky, aby se to vyřešilo při doručení.">
            <Button
              size="small"
              startIcon={<StickyNote2OutlinedIcon />}
              onClick={() => onAddNote!(entry)}
              sx={{ fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Připomenout
            </Button>
          </Tooltip>
        )}

        {toExtras && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onAddToExtras!(entry)}
            sx={{ fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Přidat do položek navíc
          </Button>
        )}

        {toReturns && (
          <Button
            size="small"
            startIcon={<UndoOutlinedIcon />}
            onClick={() => onAddToReturns!(entry)}
            sx={{ fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Přidat do vratek
          </Button>
        )}

        {/* Takes back only the promise. The cart line or vratka row it opened stays — removing
            goods somebody may have meant to keep is not this control's business. */}
        {promised && onUnpromise && (
          <Tooltip title="Vyřadit z objednávky. Přidané kusy v košíku nebo ve vratkách zůstanou.">
            <IconButton
              size="small"
              onClick={() => onUnpromise(entry)}
              aria-label="Vyřadit z objednávky"
              sx={{ color: 'text.disabled', flexShrink: 0 }}
            >
              <UndoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

      </Stack>
    </Box>
  );
}

export function ClientOpenItemsPreview({
  entries,
  /** How many pieces of each settled entry's product the cart currently holds, by entry id. */
  inCartByEntryId,
  /** The same for the supplier-goods lines. */
  inGoodsByEntryId,
  /** The same for the Položky navíc rows. */
  inExtrasByEntryId,
  /** The same for the bill-only lines — pieces the client has and has not paid for. */
  inBillByEntryId,
  /** The same for the vratky rows, so an entry being collected can say how far it got. */
  inReturnsByEntryId,
  promisedEntryIds,
  currentOrderId,
  onAddToOrder,
  onAddToGoods,
  onAddToExtras,
  onAddToReturns,
  onAddToBill,
  onAddNote,
  onUnpromise,
}: {
  entries: ClientLedgerEntryDto[];
  inCartByEntryId: Map<string, number>;
  inGoodsByEntryId?: Map<string, number>;
  inExtrasByEntryId?: Map<string, number>;
  inBillByEntryId?: Map<string, number>;
  inReturnsByEntryId?: Map<string, number>;
  /** The points this draft has taken on, so a promised row says so instead of offering the
   *  button again. */
  promisedEntryIds?: string[];
  /**
   * The order being edited, used for one thing only: telling this order's assignments from
   * another order's.
   *
   * Whether THIS order carries a point is `promisedEntryIds`, which the editor seeds from the
   * order and keeps current. The entry's own assignment can be a save behind — released in the
   * draft but still stored — and without the id such a released point read as somebody else's
   * and offered nothing.
   */
  currentOrderId?: string;
  onAddToOrder: (entry: ClientLedgerEntryDto) => void;
  /** Opens a supplier-good line for a good still owed. Absent where there is no order to put
   *  one in. */
  onAddToGoods?: (entry: ClientLedgerEntryDto) => void;
  /** Opens a Položky navíc row for a shortfall on one — free text and a count, like the list. */
  onAddToExtras?: (entry: ClientLedgerEntryDto) => void;
  /** Opens a vratka row for empties the client still holds. Absent where there is no order
   *  being edited to put one in. */
  onAddToReturns?: (entry: ClientLedgerEntryDto) => void;
  /** Opens a bill-only line for pieces the client already has and has not paid for. */
  onAddToBill?: (entry: ClientLedgerEntryDto) => void;
  /**
   * Writes the point onto the order as a note.
   *
   * For the points no line can carry: money to collect or give back, a deposit, a plain remark.
   * The order reminds whoever delivers it, and the point closes with the delivery.
   */
  onAddNote?: (entry: ClientLedgerEntryDto) => void;
  /** Takes a promise back. Absent where the draft cannot be edited. */
  onUnpromise?: (entry: ClientLedgerEntryDto) => void;
}) {
  const { formatMoney } = useCurrency();

  const open = entries.filter(isOpen);
  if (open.length === 0) return null;

  const money = moneySummary(open);

  return (
    <CollapsibleCard
      title="Nedořešeno u klienta"
      count={open.length}
      icon={<WarningAmberIcon fontSize="small" sx={{ color: 'warning.dark' }} />}
    >
      {(money.owedByClient > 0 || money.owedToClient > 0) && (
        <Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 1.5 }} flexWrap="wrap" useFlexGap>
          {money.owedByClient > 0 && (
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Klient dluží{' '}
              <Box component="span" sx={{ color: 'error.main' }}>{formatMoney(money.owedByClient)}</Box>
            </Typography>
          )}
          {money.owedToClient > 0 && (
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Dlužíme klientovi{' '}
              <Box component="span" sx={{ color: 'info.main' }}>{formatMoney(money.owedToClient)}</Box>
            </Typography>
          )}
        </Stack>
      )}

      {/* By the order the points came off, the way the client's profile groups them: a client
          with two disputed deliveries reads as one pile otherwise, and the order number had to
          be checked line by line. */}
      <Box sx={{ px: 2.5, py: 1 }}>
        {groupByOrder(open).map((group) => (
          <Box key={group.orderId ?? 'no-order'} sx={{ pt: 2, '&:first-of-type': { pt: 0.5 } }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ pb: 0.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary' }}>
                {group.orderId ? `Objednávka ${orderNumber(group.orderId)}` : 'Bez objednávky'}
              </Typography>
              {/* Plain text, not a link: leaving a half-built order to look at another one is
                  not a trade this screen should offer. */}
              {group.shipmentDeliveryDate && (
                <Typography variant="caption" color="text.disabled">
                  vývoz {fmtDate(group.shipmentDeliveryDate)}
                </Typography>
              )}
            </Stack>

            <Box
              sx={{
                pl: 1.25,
                '& > div': { py: 1.25, borderBottom: 1, borderColor: 'divider' },
                '& > div:last-of-type': { borderBottom: 0 },
              }}
            >
              {group.entries.map((entry) => (
                <OpenItemRow
                  key={entry.id}
                  entry={entry}
                  added={inCartByEntryId.get(entry.id ?? '')
                    ?? inGoodsByEntryId?.get(entry.id ?? '')
                    ?? inExtrasByEntryId?.get(entry.id ?? '')
                    ?? inBillByEntryId?.get(entry.id ?? '')
                    ?? inReturnsByEntryId?.get(entry.id ?? '')
                    ?? 0}
                  promised={entry.id != null && (promisedEntryIds ?? []).includes(entry.id)}
                  carriedElsewhere={isAssigned(entry)
                    && entry.resolvedByOrderId !== currentOrderId}
                  onAddToOrder={onAddToOrder}
                  onAddToGoods={onAddToGoods}
                  onAddToExtras={onAddToExtras}
                  onAddToReturns={onAddToReturns}
                  onAddToBill={onAddToBill}
                  onAddNote={onAddNote}
                  onUnpromise={onUnpromise}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>

    </CollapsibleCard>
  );
}
