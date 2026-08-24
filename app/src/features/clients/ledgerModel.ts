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
  return `name:${(entry.lineName ?? entry.productName ?? '').trim().toLowerCase()}`;
}

/** Targets that decorate a row of some collection, as opposed to standing on their own. */
const QUANTITY_TARGETS = new Set([
  'ProductQuantity',
  'SupplierGoodQuantity',
  'CustomExtraQuantity',
  'ReturnQuantity',
]);

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

/**
 * The wording for a decorated row's tag, derived from the sign rather than stored.
 *
 * An event-shaped vocabulary would need a value per scenario; the arithmetic already says
 * everything, and colour must never be the only signal — a colour-blind reader and a printed
 * copy both get only this text.
 */
export function deviationText(row: DecoratedRow): string | undefined {
  const diff = row.actualQuantity - row.plannedQuantity;

  switch (row.status) {
    case 'unchanged':
      return undefined;
    case 'removed':
      return 'Nevyloženo';
    case 'added':
      return 'Přidáno na místě';
    default:
      return diff > 0
        ? `O ${pieces(diff)} víc`
        : `Chybí ${pieces(-diff)}`;
  }
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
