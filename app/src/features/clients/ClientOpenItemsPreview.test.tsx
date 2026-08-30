// The open-points preview above the cart, and the shortfall it has to say out loud.

import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { orderNumber } from 'src/lib/format';

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number | null) => (v == null ? '—' : `${v} Kč`) }),
}));

const { ClientOpenItemsPreview } = await import('./ClientOpenItemsPreview');
const { isSettleable, owedPieces } = await import('./ledgerModel');

const PRODUCT = '11111111-1111-1111-1111-111111111111';
const OTHER_ORDER = '22222222-2222-2222-2222-222222222222';
const ORDER = '33333333-3333-3333-3333-333333333333';

function entry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return ClientLedgerEntryDto.fromJS({
    id: `e-${Math.random()}`,
    target: ClientLedgerEntryTarget.ProductQuantity,
    productId: PRODUCT,
    productName: 'Ležák 12',
    plannedQuantity: 10,
    actualQuantity: 7,
    requiresFollowUp: true,
    createdAt: '2026-08-24T10:00:00Z',
    ...over,
  });
}

function renderPreview(
  entries: ClientLedgerEntryDto[],
  inCart: Array<[string, number]> = [],
  onAdd = vi.fn(),
  extra: {
    inGoods?: Array<[string, number]>;
    inReturns?: Array<[string, number]>;
    promised?: string[];
    currentOrderId?: string;
    onAddToGoods?: (entry: ClientLedgerEntryDto) => void;
    onAddToExtras?: (entry: ClientLedgerEntryDto) => void;
    onAddNote?: (entry: ClientLedgerEntryDto) => void;
    onAddToReturns?: (entry: ClientLedgerEntryDto) => void;
    onUnpromise?: (entry: ClientLedgerEntryDto) => void;
  } = {},
) {
  const result = render(
    <MuiThemeProvider theme={theme}>
      <ClientOpenItemsPreview
        entries={entries}
        inCartByEntryId={new Map(inCart)}
        inGoodsByEntryId={new Map(extra.inGoods ?? [])}
        inReturnsByEntryId={new Map(extra.inReturns ?? [])}
        promisedEntryIds={extra.promised}
        currentOrderId={extra.currentOrderId}
        onAddToOrder={onAdd}
        onAddToGoods={extra.onAddToGoods}
        onAddToExtras={extra.onAddToExtras}
        onAddNote={extra.onAddNote}
        onAddToReturns={extra.onAddToReturns}
        onUnpromise={extra.onUnpromise}
      />
    </MuiThemeProvider>,
  );
  return { ...result, onAdd };
}

/** A good off a supplier's price list, owed and with no order line behind it. */
function goodEntry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return entry({
    target: ClientLedgerEntryTarget.SupplierGoodQuantity,
    productId: undefined,
    productName: undefined,
    supplierGoodId: '55555555-5555-5555-5555-555555555555',
    goodName: 'CO₂ láhev',
    plannedQuantity: 3,
    actualQuantity: 1,
    ...over,
  });
}

/** Empties the client kept: a vratka, not a cart line. */
function returnEntry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return entry({
    target: ClientLedgerEntryTarget.ReturnQuantity,
    productId: undefined,
    productName: undefined,
    lineName: 'Basy prázdných',
    plannedQuantity: 5,
    actualQuantity: 4,
    ...over,
  });
}

describe('ClientOpenItemsPreview', () => {
  it('renders nothing when the client has no open points', () => {
    const { container } = renderPreview([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers to top up a quantity that is owed', () => {
    const owedEntry = entry();
    const { onAdd } = renderPreview([owedEntry]);

    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));

    expect(onAdd).toHaveBeenCalledWith(owedEntry);
  });

  // What to do about it, not just what it was — the whole point of the row.
  it('says what has to happen, and the pair the number came from', () => {
    renderPreview([entry({ plannedQuantity: 10, actualQuantity: 7 })]);

    expect(screen.getByText(/dovézt 3 ks/)).toBeInTheDocument();
    expect(screen.getByText(/plán 10, skutečně 7/)).toBeInTheDocument();
  });

  // Resolution is binary: a debt of three settled with two closes whole and loses the third.
  // The cost cannot be prevented, only made visible.
  it('shows the shortfall while the cart does not cover the debt', () => {
    const owedEntry = entry();
    renderPreview([owedEntry], [[owedEntry.id!, 2]]);

    // Two nodes: the instruction is emphasised, the progress beside it is not.
    expect(screen.getByText('dovézt 3 ks')).toBeInTheDocument();
    expect(screen.getByText(/přidáno 2 ks/)).toBeInTheDocument();
    expect(screen.getByText('chybí 1 ks')).toBeInTheDocument();
  });

  // No green "done" on a draft: the point is settled by the delivery, and it leaves this card
  // altogether when it is. All the row owes the reader is the warning while it is short.
  it('stops warning once the cart covers the debt', () => {
    const owedEntry = entry();
    renderPreview([owedEntry], [[owedEntry.id!, 3]]);

    expect(screen.queryByText(/chybí/)).not.toBeInTheDocument();
  });

  // Supplier goods work like the beer, only into the order's own goods lines — and the card has
  // to name them from `goodName`, which is the only name such an entry carries.
  it('offers to bring a supplier good that is still owed', () => {
    const onAddToGoods = vi.fn();
    const owedGood = goodEntry();
    renderPreview([owedGood], [], vi.fn(), { onAddToGoods });

    expect(screen.getByText('CO₂ láhev')).toBeInTheDocument();
    expect(screen.getByText('dovézt 2 ks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Přidat zboží do objednávky/ }));

    expect(onAddToGoods).toHaveBeenCalledWith(owedGood);
  });

  it('tracks how far the goods lines cover it', () => {
    const owedGood = goodEntry();
    renderPreview([owedGood], [], vi.fn(), {
      inGoods: [[owedGood.id!, 1]],
      onAddToGoods: vi.fn(),
    });

    expect(screen.getByText('chybí 1 ks')).toBeInTheDocument();
  });

  // The row that started this: unreturned empties had no action and no instruction, so the card
  // said only that a line called "Položka" existed.
  it('offers to collect empties the client kept', () => {
    const onAddToReturns = vi.fn();
    const kept = returnEntry();
    renderPreview([kept], [], vi.fn(), { onAddToReturns });

    expect(screen.getByText('vyzvednout 1 ks obalů')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Přidat do vratek/ }));

    expect(onAddToReturns).toHaveBeenCalledWith(kept);
  });

  it('tracks how far the vratky cover the empties', () => {
    const kept = returnEntry({ plannedQuantity: 9, actualQuantity: 4 });
    renderPreview([kept], [], vi.fn(), { inReturns: [[kept.id!, 2]], onAddToReturns: vi.fn() });

    expect(screen.getByText('chybí 3 ks')).toBeInTheDocument();
  });

  // Reported: this offered a note, though the order has a list for exactly these.
  it('offers to put a shortfall on a custom extra into the order Položky navíc', () => {
    const onAddToExtras = vi.fn();
    const short = entry({
      target: ClientLedgerEntryTarget.CustomExtraQuantity,
      productId: undefined,
      productName: undefined,
      lineName: 'Tácky',
      plannedQuantity: 7,
      actualQuantity: 6,
    });
    renderPreview([short], [], vi.fn(), { onAddToExtras });

    expect(screen.getByText('dovézt 1 ks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Přidat do položek navíc/ }));

    expect(onAddToExtras).toHaveBeenCalledWith(short);
    // And no reminder beside it: the row is the answer, the remark was the stand-in.
    expect(screen.queryByRole('button', { name: /Připomenout/ })).not.toBeInTheDocument();
  });

  // Money and deposits have nothing to load and nothing to bill, so the order carries the
  // sentence instead of a line.
  it('offers to write a money debt onto the order as a note', () => {
    const onAddNote = vi.fn();
    const debt = entry({
      target: ClientLedgerEntryTarget.Money,
      amount: 100,
      productId: undefined,
      productName: undefined,
      plannedQuantity: undefined,
      actualQuantity: undefined,
    });
    renderPreview([debt], [], vi.fn(), { onAddNote });

    fireEvent.click(screen.getByRole('button', { name: /Připomenout/ }));

    expect(onAddNote).toHaveBeenCalledWith(debt);
  });

  it('offers the same for a deposit to hand back', () => {
    const onAddNote = vi.fn();
    const deposit = returnEntry({ plannedQuantity: 0, actualQuantity: 2 });
    renderPreview([deposit], [], vi.fn(), { onAddNote });

    expect(screen.getByText('vrátit zálohu za 2 ks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Připomenout/ }));

    expect(onAddNote).toHaveBeenCalledWith(deposit);
  });

  // A point a line can carry is carried by that line, not by a remark about it.
  it('offers no note where the order can carry the pieces', () => {
    renderPreview([entry()], [], vi.fn(), { onAddNote: vi.fn() });

    expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Připomenout/ })).not.toBeInTheDocument();
  });

  // Closing a point by hand is the client profile's business. On a row that also offers to carry
  // the point, a second verdict beside it was one control too many.
  it('offers no closing control at all', () => {
    renderPreview([entry({
      target: ClientLedgerEntryTarget.Money,
      amount: 100,
      productId: undefined,
      plannedQuantity: undefined,
      actualQuantity: undefined,
    })]);

    expect(screen.getByText('vybrat 100 Kč')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vyřešit' })).not.toBeInTheDocument();
  });

  it('offers no vratka action on an entry another order is collecting', () => {
    renderPreview([returnEntry({ resolvedByOrderId: OTHER_ORDER })], [], vi.fn(), { onAddToReturns: vi.fn() });

    expect(screen.queryByRole('button', { name: /Přidat do vratek/ })).not.toBeInTheDocument();
  });

  // No delivery event can close it, so it is settled on the client's profile instead.
  it('offers no action on a money row', () => {
    renderPreview([entry({
      target: ClientLedgerEntryTarget.Money,
      amount: 2400,
      productId: undefined,
      productName: undefined,
      plannedQuantity: undefined,
      actualQuantity: undefined,
    })]);

    expect(screen.queryByRole('button', { name: /Přidat do objednávky/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Neměl na zaplacení 2400 Kč/)).toBeInTheDocument();
  });

  it('offers no action on a row another order is already bringing', () => {
    renderPreview([entry({ resolvedByOrderId: OTHER_ORDER })]);

    expect(screen.getByText('vyřeší jiná objednávka')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat do objednávky/ })).not.toBeInTheDocument();
  });

  // A promise saved earlier comes back as an assignment, and the editor seeds it into the same
  // list a fresh promise goes into — so the card reads both the same way and offers the undo.
  it('reads a seeded promise as this order own', () => {
    const carried = entry({ resolvedByOrderId: ORDER });
    renderPreview([carried], [], vi.fn(), {
      promised: [carried.id!],
      onUnpromise: vi.fn(),
    });

    expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vyřadit z objednávky' })).toBeInTheDocument();
  });

  it('offers no action when the client had more than planned rather than less', () => {
    renderPreview([entry({ plannedQuantity: 10, actualQuantity: 12 })]);

    expect(screen.queryByRole('button', { name: /Přidat do objednávky/ })).not.toBeInTheDocument();
  });

  // The click's whole point is the promise: the server closes the point when this order
  // arrives, not now. Before this the row went on offering the button as if nothing happened.
  it('says the draft has taken a point on, and stops offering it', () => {
    const owedEntry = entry();
    renderPreview([owedEntry], [[owedEntry.id!, 3]], vi.fn(), { promised: [owedEntry.id!] });

    expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat do objednávky/ })).not.toBeInTheDocument();
  });

  // Only the promise: pulling goods somebody meant to keep out of the cart is not its business.
  it('takes a promise back without touching the cart', () => {
    const onUnpromise = vi.fn();
    const owedEntry = entry();
    renderPreview([owedEntry], [[owedEntry.id!, 3]], vi.fn(), {
      promised: [owedEntry.id!],
      onUnpromise,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Vyřadit z objednávky' }));

    expect(onUnpromise).toHaveBeenCalledWith(owedEntry);
  });

  // A promised point still counts what the draft carries, so the shortfall stays visible right
  // up to the save that warns about it.
  it('keeps showing the shortfall on a promised point', () => {
    const owedEntry = entry();
    renderPreview([owedEntry], [[owedEntry.id!, 2]], vi.fn(), { promised: [owedEntry.id!] });

    expect(screen.getByText('chybí 1 ks')).toBeInTheDocument();
  });

  // Grouped like the client's profile: the order number is on the header once instead of on
  // every row of it.
  it('groups the points by the order they came off', () => {
    renderPreview([
      entry({ orderId: ORDER, productName: 'Ležák 12' }),
      entry({ orderId: ORDER, productName: 'Světlé 10' }),
      entry({ orderId: OTHER_ORDER, productName: 'Řezané' }),
    ]);

    expect(screen.getByText(`Objednávka ${orderNumber(ORDER)}`)).toBeInTheDocument();
    expect(screen.getByText(`Objednávka ${orderNumber(OTHER_ORDER)}`)).toBeInTheDocument();
  });

  it('dates a group from the run carrying the order', () => {
    renderPreview([entry({ orderId: ORDER, shipmentDeliveryDate: new Date('2026-08-27T06:30:00Z') })]);

    expect(screen.getByText(/vývoz/)).toBeInTheDocument();
  });

  it('collects the standalone debts under their own heading', () => {
    renderPreview([entry({
      orderId: undefined,
      target: ClientLedgerEntryTarget.Money,
      amount: 100,
      productId: undefined,
      plannedQuantity: undefined,
      actualQuantity: undefined,
    })]);

    expect(screen.getByText('Bez objednávky')).toBeInTheDocument();
  });

  it('sums money in both directions separately', () => {
    renderPreview([
      entry({ target: ClientLedgerEntryTarget.Money, amount: 500, plannedQuantity: undefined, actualQuantity: undefined, productId: undefined }),
      entry({ target: ClientLedgerEntryTarget.Money, amount: -300, plannedQuantity: undefined, actualQuantity: undefined, productId: undefined }),
    ]);

    expect(screen.getByText('500 Kč')).toBeInTheDocument();
    expect(screen.getByText('300 Kč')).toBeInTheDocument();
  });
});

describe('owedPieces', () => {
  it('counts what is missing', () => {
    expect(owedPieces(entry({ plannedQuantity: 10, actualQuantity: 7 }))).toBe(3);
  });

  it('is zero when more arrived than planned', () => {
    expect(owedPieces(entry({ plannedQuantity: 10, actualQuantity: 12 }))).toBe(0);
  });
});

describe('isSettleable', () => {
  it('needs a product to add to the cart', () => {
    expect(isSettleable(entry({ productId: undefined }))).toBe(false);
  });

  it('rejects a settled entry', () => {
    expect(isSettleable(entry({ resolvedAt: new Date('2026-08-26T09:00:00Z') }))).toBe(false);
  });
});
