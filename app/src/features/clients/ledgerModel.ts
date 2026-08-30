// What actually happened to an order, laid over what was planned.
//
// The order stays the plan; reality is computed here. Every screen that shows a deviation —
// the order detail, the unload list, the returns and extra-item cards, the client profile and
// the order editor's preview — reads this module, so none of them can drift into showing a
// different number for the same handover.
//
// Kept out of the components for the reason unloadOrder.ts gives for itself: ShipmentDetail and
// OrderEditor are large enough that logic put in them stops being testable.

import type { ClientLedgerEntryDto } from 'src/generated/api-client';
import { ClientLedgerEntryTarget } from 'src/generated/api-client';
import { ledgerTargetName } from 'src/lib/labels';
import { fmtDate } from 'src/lib/format';

/** How a row of the plan fared. */
export type LedgerRowStatus =
  /** The plan happened. */
  | 'unchanged'
  /** A different number of pieces changed hands. */
  | 'changed'
  /** Never planned: taken at the door, or handed back against an order that expected nothing. */
  | 'added'
  /** Planned but nothing arrived. */
  | 'removed';

/** One planned line, as the screen showing it already knows it. */
export interface PlanRow {
  /**
   * How a ledger entry points at this line — see {@link entryLineKey}, which must produce the
   * same string. Getting these two out of step shows every row as unchanged and every entry as
   * an extra row beneath, which is why they live side by side.
   */
  key: string;
  name: string;
  /** Whatever chip the screen already renders beside the name (kind, size, degree).  */
  chip?: string;
  quantity: number;
}

/** A planned line with what the ledger says about it. */
export interface DecoratedRow extends PlanRow {
  status: LedgerRowStatus;
  plannedQuantity: number;
  actualQuantity: number;
  /** The entry behind a decorated row: its note, author and date belong on the row's own tag. */
  entry?: ClientLedgerEntryDto;
}

/**
 * How an entry identifies the line it is about: the line's own id where the order planned one,
 * otherwise the free-text name it was written under.
 */
export function entryLineKey(entry: ClientLedgerEntryDto): string {
  const id =
    entry.orderItemId ??
    entry.supplierGoodItemId ??
    entry.customExtraItemId ??
    entry.orderReturnId;

  if (id) return id;
  if (entry.productId) return `product:${entry.productId}`;
  if (entry.supplierGoodId) return `good:${entry.supplierGoodId}`;
  return `name:${(entry.lineName ?? entry.productName ?? entry.goodName ?? '').trim().toLowerCase()}`;
}

/** Targets that decorate a row of some collection, as opposed to standing on their own. */
const QUANTITY_TARGETS = new Set([
  'ProductQuantity',
  'SupplierGoodQuantity',
  'CustomExtraQuantity',
  'ReturnQuantity',
]);

/** The member names of the four quantity targets, for scoping entries to one collection. */
export type QuantityTargetName =
  | 'ProductQuantity'
  | 'SupplierGoodQuantity'
  | 'CustomExtraQuantity'
  | 'ReturnQuantity';

/**
 * The entries belonging to one collection.
 *
 * {@link applyLedger} appends everything it cannot match to a planned row, so feeding it the
 * whole ledger would drop a returned crate into the items list. Each collection is diffed
 * against its own target.
 */
export function entriesForTarget(
  entries: ClientLedgerEntryDto[],
  target: QuantityTargetName,
): ClientLedgerEntryDto[] {
  return entries.filter((e) => ledgerTargetName(e.target) === target);
}

/** Entries recorded against one order. A standalone debt has no order and is never among them. */
export function entriesForOrder(
  entries: ClientLedgerEntryDto[],
  orderId: string | undefined,
): ClientLedgerEntryDto[] {
  if (!orderId) return [];
  return entries.filter((e) => e.orderId === orderId);
}

/**
 * A planned line in the shape {@link applyLedger} diffs against.
 *
 * The key is the line's own public id, which is exactly what {@link entryLineKey} reads off an
 * entry — going through this helper is what keeps the two from drifting.
 */
export function planRow(
  key: string | undefined,
  name: string | undefined,
  quantity: number | undefined,
  chip?: string,
): PlanRow {
  return { key: key ?? '', name: name ?? '—', quantity: quantity ?? 0, chip };
}

/** Whether an entry is about a quantity of something, whichever way the target arrives. */
export function isQuantityEntry(entry: ClientLedgerEntryDto): boolean {
  const name = ledgerTargetName(entry.target);
  return name != null && QUANTITY_TARGETS.has(name);
}

/** Whether an entry is about money or is a free-text note — the two with no row of their own. */
export function isFreeEntry(entry: ClientLedgerEntryDto): boolean {
  const name = ledgerTargetName(entry.target);
  return name === 'Money' || name === 'Other';
}

/** Whether an entry records where the goods went. */
export function isAddressEntry(entry: ClientLedgerEntryDto): boolean {
  return ledgerTargetName(entry.target) === 'DeliveryAddress';
}

/** Whether an entry is still open — not settled, whether or not an order is carrying it. */
export function isOpen(entry: ClientLedgerEntryDto): boolean {
  return !entry.resolvedAt;
}

/** Whether an order has promised to settle this entry but has not delivered yet. */
export function isAssigned(entry: ClientLedgerEntryDto): boolean {
  return !entry.resolvedAt && !!entry.resolvedByOrderId;
}

/**
 * The entry that says what changed hands on a line, settled or not.
 *
 * Deliberately blind to resolution: what came off the van is a permanent fact about that
 * handover, while "is it squared with the client" is a different question — the one
 * {@link openEntries} answers. Filtering the display by resolution would put the plan back on
 * screen the moment somebody closed the entry, and the same mistake on the invoice would bill
 * the short-delivered pieces a second time.
 *
 * One entry per line, never a sum: a line can carry a settled entry and a newer open one, and
 * adding both deltas would count the same shortfall twice. The open one is the current truth.
 */
export function deliveredEntryFor(
  entries: ClientLedgerEntryDto[],
  key: string,
): ClientLedgerEntryDto | undefined {
  const candidates = entries.filter((e) => isQuantityEntry(e) && entryLineKey(e) === key);
  if (candidates.length === 0) return undefined;

  return [...candidates].sort((a, b) => {
    const byOpen = Number(!!a.resolvedAt) - Number(!!b.resolvedAt);
    if (byOpen !== 0) return byOpen;
    return dateValue(b.createdAt) - dateValue(a.createdAt);
  })[0];
}

/** The open points: what still has to be done about them. Feeds the client profile and the cart. */
export function openEntries(entries: ClientLedgerEntryDto[]): ClientLedgerEntryDto[] {
  return entries.filter(isOpen);
}

/**
 * Products the client took at the door and that can still be corrected: a product entry with no
 * order line behind it.
 *
 * Only unsettled ones. A settled entry is history to the server — a save carrying the same
 * product would open a second row beside it rather than rewriting it — so the recording form
 * must not offer to edit one. Removing it outright still works from the order's own table, which
 * deletes by id rather than re-saving the line.
 */
export function doorSideAdditions(entries: ClientLedgerEntryDto[]): ClientLedgerEntryDto[] {
  return entries.filter((e) =>
    isQuantityEntry(e)
    && ledgerTargetName(e.target) === 'ProductQuantity'
    && !e.orderItemId
    && !!e.productId
    && isOpen(e)
    && (e.actualQuantity ?? 0) !== (e.plannedQuantity ?? 0));
}

/**
 * Supplier goods handed over with no line on the order, still correctable.
 *
 * The mirror of {@link doorSideAdditions}: keyed by the good rather than the product, and settled
 * ones are left out for the same reason — a save carrying the same good would open a second row
 * beside the stored one instead of rewriting it.
 */
export function doorSideGoods(entries: ClientLedgerEntryDto[]): ClientLedgerEntryDto[] {
  return entries.filter((e) =>
    ledgerTargetName(e.target) === 'SupplierGoodQuantity'
    && !e.supplierGoodItemId
    && !!e.supplierGoodId
    && isOpen(e)
    && (e.actualQuantity ?? 0) !== (e.plannedQuantity ?? 0));
}

/**
 * Lays the ledger over a plan: every planned row decorated, plus a row for everything the
 * ledger records that the plan never had.
 *
 * It appends rather than only decorating, which is why it returns a new array instead of a map
 * over the old one. A product taken at the door and a crate of empties handed back against an
 * order that planned no returns are the commonest surprises of the whole feature, and neither
 * has a planned row to hang off.
 */
export function applyLedger(planRows: PlanRow[], entries: ClientLedgerEntryDto[]): DecoratedRow[] {
  const quantityEntries = entries.filter(isQuantityEntry);
  const used = new Set<string>();

  const decorated = planRows.map((row) => {
    const entry = deliveredEntryFor(quantityEntries, row.key);
    if (!entry) {
      return {
        ...row,
        status: 'unchanged' as const,
        plannedQuantity: row.quantity,
        actualQuantity: row.quantity,
      };
    }

    used.add(row.key);

    // The delta is applied to the row's own quantity rather than the entry's actual being taken
    // wholesale: once the run has left, the recording form measures against what was loaded,
    // which a top-up at the ramp can push above what the order says.
    const delta = (entry.actualQuantity ?? 0) - (entry.plannedQuantity ?? 0);
    const actual = Math.max(0, row.quantity + delta);

    return {
      ...row,
      status: rowStatus(row.quantity, actual),
      plannedQuantity: row.quantity,
      actualQuantity: actual,
      entry,
    };
  });

  const appended = quantityEntries
    .filter((e) => !used.has(entryLineKey(e)))
    .filter((e) => (e.actualQuantity ?? 0) !== (e.plannedQuantity ?? 0))
    .map<DecoratedRow>((entry) => ({
      key: entryLineKey(entry),
      name: entry.productName ?? entry.lineName ?? '—',
      quantity: entry.plannedQuantity ?? 0,
      plannedQuantity: entry.plannedQuantity ?? 0,
      actualQuantity: entry.actualQuantity ?? 0,
      status: (entry.plannedQuantity ?? 0) === 0 ? 'added' : rowStatus(entry.plannedQuantity ?? 0, entry.actualQuantity ?? 0),
      entry,
    }));

  return [...decorated, ...appended];
}

function rowStatus(planned: number, actual: number): LedgerRowStatus {
  if (actual === planned) return 'unchanged';
  if (actual === 0) return 'removed';
  if (planned === 0) return 'added';
  return 'changed';
}

/** Which of the four tag colours a deviation carries. Mirrors the prototype's chg-tag tones. */
export type LedgerTone = 'less' | 'more' | 'new' | 'info';

/**
 * What each tone is made of: a foreground from the theme's status colours, and one of the brand
 * tints behind it.
 *
 * Here rather than beside the tag that first used it, because the recording form paints its rows
 * in these tones too — short of the plan reads the same red while it is being typed as it does on
 * the screen afterwards, and one table of pairs is what keeps the two from drifting.
 */
export const TONE_COLOR: Record<LedgerTone, { fg: string; bg: 'critTint' | 'okTint' | 'infoTint' | 'amberTint' }> = {
  less: { fg: 'error.main', bg: 'critTint' },
  more: { fg: 'success.main', bg: 'okTint' },
  new: { fg: 'info.main', bg: 'infoTint' },
  info: { fg: 'warning.dark', bg: 'amberTint' },
};

/**
 * The wording for a decorated row's tag, derived from the sign rather than stored.
 *
 * An event-shaped vocabulary would need a value per scenario; the arithmetic already says
 * everything. Colour must never be the only signal — a colour-blind reader and a printed copy
 * both get nothing but this text — so every changed row carries it.
 *
 * A return moves the other way: pieces come back to us, so "more than planned" is the client
 * handing over extra rather than us delivering extra. Same arithmetic, opposite words.
 */
export function deviationText(row: DecoratedRow): string | undefined {
  const isReturn = ledgerTargetName(row.entry?.target) === 'ReturnQuantity';
  return quantityWords(row.plannedQuantity, row.actualQuantity, isReturn);
}

/**
 * What a line the order never planned is called, in the one place that decides it.
 *
 * The recording form names its own rows too — it has numbers rather than a decorated row to hand
 * to {@link quantityWords} — so the words live here rather than in either caller.
 */
export const ADDED_EXTRA = 'Přidáno extra';

/** The same wording from two bare numbers — see {@link quantityTone} for why it is shared. */
export function quantityWords(planned: number, actual: number, isReturn = false): string | undefined {
  const diff = actual - planned;

  switch (rowStatus(planned, actual)) {
    case 'unchanged':
      return undefined;
    case 'removed':
      return isReturn ? 'Nevráceno' : 'Nevyloženo';
    case 'added':
      return isReturn ? 'Vráceno navíc' : ADDED_EXTRA;
    default:
      if (diff < 0) return `${isReturn ? 'Nevráceno' : 'Nevyloženo'} ${pieces(-diff)}`;
      return `${isReturn ? 'Vráceno navíc' : 'Navíc'} ${pieces(diff)}`;
  }
}

/**
 * The tag's tone.
 *
 * A return never gets the affirmative colour that "delivered extra" earns: it has no good
 * direction — too few and the client still owes empties, too many and we are holding deposits
 * that are not ours — whereas beer over the plan is simply with the client and billed.
 */
export function deviationTone(row: DecoratedRow): LedgerTone | undefined {
  const isReturn = ledgerTargetName(row.entry?.target) === 'ReturnQuantity';
  return quantityTone(row.plannedQuantity, row.actualQuantity, isReturn);
}

/**
 * The same tone from two bare numbers, for the recording form — where the actual is being typed
 * and there is no stored entry to decorate yet.
 *
 * Shared with {@link deviationTone} rather than reimplemented: a form that coloured a shortfall
 * one way and the screen behind it another would teach the reader two vocabularies for one fact.
 */
export function quantityTone(planned: number, actual: number, isReturn = false): LedgerTone | undefined {
  switch (rowStatus(planned, actual)) {
    case 'unchanged':
      return undefined;
    case 'removed':
      return 'less';
    case 'added':
      return 'new';
    default:
      if (actual < planned) return 'less';
      return isReturn ? 'new' : 'more';
  }
}

/**
 * Money read as a direction: who owes whom.
 *
 * A money entry is written at the door, so "Neměl na zaplacení" is what actually happened — the
 * client was short at handover. The totals above the list stay "Klient dluží", because a sum of
 * several such moments is a balance rather than one of them.
 */
export function moneyText(entry: ClientLedgerEntryDto): string {
  return (entry.amount ?? 0) >= 0 ? 'Neměl na zaplacení' : 'Dlužíme klientovi';
}

/**
 * Note, author and date of the entry behind a row, for the tag's tooltip.
 *
 * On the row being looked at rather than in a panel listing every entry at once: a summary card
 * beside struck-through numbers says the same thing twice and makes the reader check two places
 * to learn one.
 */
export function entryTooltip(entry?: ClientLedgerEntryDto): string | undefined {
  if (!entry) return undefined;

  return [entry.note, entry.createdByUserName, fmtDate(entry.createdAt)]
    .filter((part) => part != null && String(part).trim().length > 0)
    .join(' · ');
}

/** How many pieces an entry still says are owed. Zero when the client had more than planned. */
export function owedPieces(entry: ClientLedgerEntryDto): number {
  return Math.max(0, (entry.plannedQuantity ?? 0) - (entry.actualQuantity ?? 0));
}

/**
 * The two numbers behind a quantity entry, as the client profile states them.
 *
 * The evidence under a row whose instruction already carries the delta: "vyzvednout 1 ks obalů"
 * says what to do, this says where the 1 came from. Shared with the profile so the two screens
 * cannot word the same pair differently.
 */
export function plannedActualText(entry: ClientLedgerEntryDto): string {
  return `plán ${entry.plannedQuantity ?? 0}, skutečně ${entry.actualQuantity ?? 0}`;
}

/**
 * What an entry's line is called.
 *
 * One helper rather than a fallback chain repeated per screen: a good handed over at the door
 * carries `goodName` and neither of the other two, so a screen that forgot it showed "Položka".
 */
export function entryDisplayName(entry: ClientLedgerEntryDto): string | undefined {
  return entry.productName ?? entry.goodName ?? entry.lineName ?? undefined;
}

/** What happened on an entry's line, in the words the diffs use. Undefined when nothing moved. */
export function entryDeviation(entry: ClientLedgerEntryDto): string | undefined {
  if (!isQuantityEntry(entry)) return undefined;
  return quantityWords(
    entry.plannedQuantity ?? 0,
    entry.actualQuantity ?? 0,
    ledgerTargetName(entry.target) === 'ReturnQuantity',
  );
}

/**
 * Where an entry gets closed: from this order's cart, from its supplier-goods lines, from its
 * vratky, or off the screen entirely.
 */
export type LedgerTodoAction = 'order' | 'goods' | 'extras' | 'returns' | 'bill' | 'none';

/** What still has to happen for an entry to close, and whether this screen can do it. */
export interface LedgerTodo {
  /** The instruction, in the imperative: "dovézt 3 ks", "vybrat 100 Kč". */
  text: string;
  action: LedgerTodoAction;
}

/**
 * What to do about an entry.
 *
 * The lists used to show only what an entry *was* — a name, a tag, a date — which reads as six
 * labels rather than six jobs. Every open point has exactly one next step, and it is derivable:
 * the target says whose problem it is and the sign says which direction it runs in.
 *
 * `action` is only about what this screen can do about it. A shortfall of a known product goes in
 * the cart, unreturned empties go in the vratky, and everything else is an office job — cash
 * taken, a keg written off, pieces billed — which no delivery closes.
 */
export function ledgerTodo(
  entry: ClientLedgerEntryDto,
  formatMoney: (value: number) => string,
): LedgerTodo {
  const acknowledge: LedgerTodo = { text: 'vzít na vědomí', action: 'none' };

  if (entry.amount != null && entry.amount !== 0) {
    return entry.amount > 0
      ? { text: `vybrat ${formatMoney(entry.amount)}`, action: 'none' }
      : { text: `vrátit ${formatMoney(-entry.amount)}`, action: 'none' };
  }

  if (!isQuantityEntry(entry)) return acknowledge;

  const missing = (entry.plannedQuantity ?? 0) - (entry.actualQuantity ?? 0);
  if (missing === 0) return acknowledge;

  if (ledgerTargetName(entry.target) === 'ReturnQuantity') {
    // Empties, so the directions are the other way round from goods: too few back and the client
    // is still holding them, too many and we are sitting on somebody's deposit.
    return missing > 0
      ? { text: `vyzvednout ${pieces(missing)} obalů`, action: 'returns' }
      : { text: `vrátit zálohu za ${pieces(-missing)}`, action: 'none' };
  }

  // Over-delivered: the pieces are with the client and nothing more is owed to them, so what is
  // left is money. A shortfall can be carried by an order, but only of something its lists know:
  // a product goes in the cart, a supplier good in its own lines, a custom extra in neither.
  // A custom extra is free text with a count, so the order carries the shortfall as another row
  // of the same list. Nothing about money here: what an extra costs is not modelled yet.
  if (missing > 0 && ledgerTargetName(entry.target) === 'CustomExtraQuantity') {
    return { text: `dovézt ${pieces(missing)}`, action: 'extras' };
  }

  // Over-delivered: the pieces are with the client, so what is left is money. The next order can
  // carry that as a bill-only line — billed, never loaded — as long as it knows what to price,
  // which is the product or the good.
  if (missing < 0) {
    const billable: LedgerTodoAction = entry.productId != null || entry.supplierGoodId != null
      ? 'bill'
      : 'none';
    return { text: `doúčtovat ${pieces(-missing)}`, action: billable };
  }

  const carrier: LedgerTodoAction = entry.productId != null
    ? 'order'
    : entry.supplierGoodId != null
      ? 'goods'
      : 'none';

  return { text: `dovézt ${pieces(missing)}`, action: carrier };
}

/**
 * Whether an entry can be topped up from an order's cart: a quantity of a known product that is
 * genuinely owed, and that no other order has already promised to bring.
 */
export function canGoToCart(entry: ClientLedgerEntryDto): boolean {
  return isOpen(entry) && isQuantityEntry(entry)
    && entry.productId != null && owedPieces(entry) > 0;
}

export function isSettleable(entry: ClientLedgerEntryDto): boolean {
  return canGoToCart(entry) && !isAssigned(entry);
}

/**
 * The point as a sentence for an order's note.
 *
 * For everything no delivery settles by itself — cash to collect, a deposit to hand back, pieces
 * to bill — the order carries a reminder instead of a line. The wording is {@link ledgerTodo}'s,
 * so the note and the card cannot say different things about the same point.
 */
export function ledgerNoteText(
  entry: ClientLedgerEntryDto,
  formatMoney: (value: number) => string,
): string {
  const todo = ledgerTodo(entry, formatMoney).text;
  const sentence = todo.charAt(0).toUpperCase() + todo.slice(1);
  const name = entryDisplayName(entry);

  return name ? `${sentence} — ${name}` : sentence;
}

/** How many pieces the client has and has not been billed for. Zero when nothing is owed. */
export function billablePieces(entry: ClientLedgerEntryDto): number {
  return Math.max(0, (entry.actualQuantity ?? 0) - (entry.plannedQuantity ?? 0));
}

/**
 * Whether the pieces can be put on an order to be billed: a quantity of something the catalog
 * can price, that the client has more of than was planned, and that no order is already carrying.
 */
export function canBeBilled(entry: ClientLedgerEntryDto): boolean {
  return isOpen(entry) && isQuantityEntry(entry)
    && ledgerTargetName(entry.target) !== 'ReturnQuantity'
    && (entry.productId != null || entry.supplierGoodId != null)
    && billablePieces(entry) > 0;
}

export function isBillable(entry: ClientLedgerEntryDto): boolean {
  return canBeBilled(entry) && !isAssigned(entry);
}

/**
 * Whether a supplier good can be topped up from an order's own goods lines.
 *
 * Its own predicate for the reason {@link isReturnSettleable} has one: the row it becomes is a
 * supplier-good line priced off the supplier's list, not a cart line priced off the client's.
 */
export function canGoToGoods(entry: ClientLedgerEntryDto): boolean {
  return isOpen(entry)
    && ledgerTargetName(entry.target) === 'SupplierGoodQuantity'
    && entry.supplierGoodId != null
    && owedPieces(entry) > 0;
}

export function isGoodSettleable(entry: ClientLedgerEntryDto): boolean {
  return canGoToGoods(entry) && !isAssigned(entry);
}

export function canGoToExtras(entry: ClientLedgerEntryDto): boolean {
  return isOpen(entry)
    && ledgerTargetName(entry.target) === 'CustomExtraQuantity'
    && owedPieces(entry) > 0;
}

/**
 * Whether a shortfall on a custom extra can be put on an order's own Položky navíc.
 *
 * Its own predicate for the reason the others have one: the row it becomes is free text and a
 * count, with no product and no price list behind it.
 */
export function isExtraSettleable(entry: ClientLedgerEntryDto): boolean {
  return canGoToExtras(entry) && !isAssigned(entry);
}

/**
 * Whether an entry can be collected on the next run: empties the client did not hand back.
 *
 * Its own predicate rather than a branch of {@link isSettleable}, because the row it becomes is
 * a vratka and not a cart line — there is no product to price, only a name and a count.
 */
export function canGoToReturns(entry: ClientLedgerEntryDto): boolean {
  return isOpen(entry)
    && ledgerTargetName(entry.target) === 'ReturnQuantity'
    && owedPieces(entry) > 0;
}

export function isReturnSettleable(entry: ClientLedgerEntryDto): boolean {
  return canGoToReturns(entry) && !isAssigned(entry);
}

/** The name a vratka row takes when one is opened from an entry. */
export function returnLineName(entry: ClientLedgerEntryDto): string {
  return (entry.lineName ?? entry.productName ?? 'Vratka').trim();
}

/** The same for a Položky navíc row. */
export function extraLineName(entry: ClientLedgerEntryDto): string {
  return (entryDisplayName(entry) ?? 'Položka navíc').trim();
}

/**
 * How a free-text row and an entry are matched up: the name, folded the way {@link entryLineKey}
 * folds it. Shared by the vratky and the extras — neither has an id until it is saved.
 */
export function lineNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Money owed in both directions, summed separately. */
export interface MoneySummary {
  /** What the client owes us. Always positive. */
  owedByClient: number;
  /** What we owe the client. Always positive. */
  owedToClient: number;
}

/**
 * Adds up the money entries, the two directions apart.
 *
 * Deliberately not netted: "you owe me 500 and I owe you 500" is two things to settle, not
 * nothing. Netting them would show a client with two open disputes as square.
 */
export function moneySummary(entries: ClientLedgerEntryDto[]): MoneySummary {
  let owedByClient = 0;
  let owedToClient = 0;

  for (const entry of entries) {
    const amount = entry.amount ?? 0;
    if (amount > 0) owedByClient += amount;
    else if (amount < 0) owedToClient += -amount;
  }

  return { owedByClient, owedToClient };
}

/** Piece count, the unit the whole app counts goods in. */
function pieces(n: number): string {
  return `${n} ks`;
}

function dateValue(d?: Date | string): number {
  if (!d) return 0;
  const value = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isNaN(value) ? 0 : value;
}

/** Targets whose entries belong on the order's Peníze a poznámky card. */
export function freeEntries(entries: ClientLedgerEntryDto[]): ClientLedgerEntryDto[] {
  return entries.filter(isFreeEntry);
}

/** The address entry of an order, if the delivery moved. */
export function addressEntry(entries: ClientLedgerEntryDto[]): ClientLedgerEntryDto | undefined {
  return entries.filter(isAddressEntry).sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))[0];
}

/** Whether a target is one the recording drawer offers a quantity pair for. */
export function isQuantityTarget(target?: ClientLedgerEntryTarget | string | number): boolean {
  const name = ledgerTargetName(target);
  return name != null && QUANTITY_TARGETS.has(name);
}

/** The entries recorded against one order, or the ones recorded against no order at all. */
export interface LedgerOrderGroup {
  /** Undefined for the standalone debts — the group the order button cannot link anywhere. */
  orderId?: string;
  /** When the run carrying the order goes out. Undefined while no run has it. */
  shipmentDeliveryDate?: Date;
  entries: ClientLedgerEntryDto[];
}

/**
 * The ledger split into one block per order, newest first.
 *
 * A flat newest-first list interleaves orders, so a client with two disputed deliveries reads as
 * one undifferentiated pile and the order number has to be checked line by line. Groups are
 * ordered by their newest entry — the same "what just happened comes first" the rows keep among
 * themselves — so the standalone debts sort by date with everything else rather than being
 * parked at one end.
 */
export function groupByOrder(entries: ClientLedgerEntryDto[]): LedgerOrderGroup[] {
  const groups = new Map<string, LedgerOrderGroup>();

  for (const entry of entries) {
    const key = entry.orderId ?? '';
    const group = groups.get(key) ?? { orderId: entry.orderId, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    group.entries.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
    // Every entry of one order reads the same run, so the first that has it speaks for the group.
    group.shipmentDeliveryDate = group.entries.find((e) => e.shipmentDeliveryDate != null)
      ?.shipmentDeliveryDate;
  }

  return [...groups.values()].sort(
    (a, b) => dateValue(b.entries[0]?.createdAt) - dateValue(a.entries[0]?.createdAt),
  );
}
