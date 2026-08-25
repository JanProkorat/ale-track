// The drawer that records what happened. The trap it exists to avoid: prefilling "Skutečně"
// from the plan rather than from what is already stored, which would record the difference a
// second time and double the client's debt.

import {
  fireEvent, render, screen, waitFor, waitForElementToBeRemoved,
} from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientLedgerEntryDto, ClientLedgerEntryTarget, GroupedProductHistoryDto, ProductKind,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import type { LedgerDrawerContext } from './LedgerEntryDrawer';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
// The catalog prices its rows, and money goes through the display currency.
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number | null) => (v == null ? '—' : `${v} Kč`) }),
}));

const saveMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('src/hooks/useClientLedger', () => ({
  useSaveClientLedgerEntries: () => ({ mutateAsync: saveMock, isPending: false }),
  useUpdateClientLedgerEntry: () => ({ mutateAsync: updateMock, isPending: false }),
  useDeleteClientLedgerEntry: () => ({ mutateAsync: deleteMock, isPending: false }),
}));

// The catalog behind "Přidat produkt navíc". A resource hook like any other, and the mock can
// express no-data: the drawer renders before it arrives.
const catalogState: { data?: GroupedProductHistoryDto; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};
vi.mock('src/hooks/useOrders', () => ({ useClientProductHistory: () => catalogState }));
// The catalog marks each brewery with its colour; the hook rides on the brewery list.
vi.mock('src/hooks/useBreweries', () => ({
  useBreweryColors: () => (id?: string) => (id === 'b-1' ? '#F08C00' : undefined),
}));

/** One brewery, one product, one size — the smallest thing the catalog can show. */
function catalogOf(...items: Array<{ id: string; name: string; priceWithVat?: number; packageSize?: number }>) {
  return GroupedProductHistoryDto.fromJS({
    recent: [],
    breweries: [{
      breweryId: 'b-1',
      breweryName: 'Svijany',
      kinds: [{
        kind: ProductKind.Keg,
        packageSizes: [{ size: 50, items: items.map((i) => ({ kind: ProductKind.Keg, packageSize: 50, ...i })) }],
      }],
    }],
  });
}

const { LedgerEntryDrawer } = await import('./LedgerEntryDrawer');

const ITEM = '11111111-1111-1111-1111-111111111111';
const ORDER = '33333333-3333-3333-3333-333333333333';

function entry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return ClientLedgerEntryDto.fromJS({
    id: `e-${Math.random()}`,
    orderId: ORDER,
    target: ClientLedgerEntryTarget.ProductQuantity,
    requiresFollowUp: false,
    createdAt: '2026-08-24T10:00:00Z',
    ...over,
  });
}

function context(over: Partial<LedgerDrawerContext> = {}): LedgerDrawerContext {
  return {
    clientId: 'client-a',
    clientName: 'U Zeleného stromu',
    orderId: ORDER,
    orderLabel: 'OBJ-0001 · Rozváží se',
    items: [{ key: ITEM, name: 'Ležák 12', quantity: 10 }],
    returns: [],
    extras: [],
    goods: [],
    entries: [],
    ...over,
  };
}

function renderDrawer(ctx: LedgerDrawerContext) {
  return render(
    <MuiThemeProvider theme={theme}>
      <LedgerEntryDrawer open context={ctx} onClose={vi.fn()} />
    </MuiThemeProvider>,
  );
}

function actualInput(name: string, label = 'Skutečně'): HTMLInputElement {
  return screen.getByLabelText(`${name} — ${label}`) as HTMLInputElement;
}

/** The rows of the single save call. */
function savedRows() {
  expect(saveMock).toHaveBeenCalledTimes(1);
  return saveMock.mock.calls[0][0].data.rows;
}

beforeEach(() => {
  saveMock.mockReset().mockResolvedValue('ok');
  updateMock.mockReset().mockResolvedValue('ok');
  deleteMock.mockReset().mockResolvedValue('ok');
  catalogState.data = undefined;
  catalogState.isLoading = false;
});

describe('LedgerEntryDrawer', () => {
  it('prefills the actual column from the plan when nothing is recorded yet', () => {
    renderDrawer(context());

    expect(actualInput('Ležák 12').value).toBe('10');
  });

  // The trap. Reopening after "unloaded 7 of 10" must show 7, not 10 — showing the plan would
  // record the −3 again and leave the client owing six kegs.
  it('prefills the actual column from what is already stored', () => {
    renderDrawer(context({
      entries: [entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7 })],
    }));

    expect(actualInput('Ležák 12').value).toBe('7');
  });

  it('prefills from the open entry rather than a settled one', () => {
    renderDrawer(context({
      entries: [
        entry({
          orderItemId: ITEM,
          plannedQuantity: 10,
          actualQuantity: 7,
          resolvedAt: new Date('2026-08-26T09:00:00Z'),
          createdAt: new Date('2026-08-26T08:00:00Z'),
        }),
        entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 4, createdAt: new Date('2026-08-24T12:00:00Z') }),
      ],
    }));

    expect(actualInput('Ležák 12').value).toBe('4');
  });

  it('sends every planned line, so a line back at its plan deletes its deviation', () => {
    renderDrawer(context({
      entries: [entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7 })],
    }));

    fireEvent.change(actualInput('Ležák 12'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    const rows = savedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 10 });
  });

  it('records a short delivery against the line it happened on', () => {
    renderDrawer(context());

    fireEvent.change(actualInput('Ležák 12'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(savedRows()[0]).toMatchObject({
      target: ClientLedgerEntryTarget.ProductQuantity,
      orderItemId: ITEM,
      plannedQuantity: 10,
      actualQuantity: 7,
    });
  });

  // ---------------------------------------------------------------------------------
  // Which rows are marked. The amber says "this no longer matches the plan", so the operator can
  // see what they have typed without reading every number back.
  // ---------------------------------------------------------------------------------

  /** The row carrying a field, which is the element the mark sits on. */
  const rowOf = (name: string, label = 'Skutečně') => actualInput(name, label).closest('[data-tone]');

  it('leaves a row alone while it still matches the plan', () => {
    renderDrawer(context());

    expect(rowOf('Ležák 12')).toHaveAttribute('data-changed', 'false');
  });

  it('marks a row that no longer matches its plan', () => {
    renderDrawer(context());

    fireEvent.change(actualInput('Ležák 12'), { target: { value: '7' } });

    expect(rowOf('Ležák 12')).toHaveAttribute('data-changed', 'true');
  });

  // The tones are the ones the screens behind this form use, so short of the plan is the same red
  // in both places. And the words go with the colour, which a colour-blind reader cannot see.
  it('colours a shortfall as a shortfall, and says so', () => {
    renderDrawer(context());

    fireEvent.change(actualInput('Ležák 12'), { target: { value: '7' } });

    expect(rowOf('Ležák 12')).toHaveAttribute('data-tone', 'less');
    expect(screen.getByText('Nevyloženo 3 ks')).toBeInTheDocument();
  });

  it('colours over-delivery the other way', () => {
    renderDrawer(context());

    fireEvent.change(actualInput('Ležák 12'), { target: { value: '12' } });

    expect(rowOf('Ležák 12')).toHaveAttribute('data-tone', 'more');
    expect(screen.getByText('Navíc 2 ks')).toBeInTheDocument();
  });

  // A return has no good direction — too few and the client owes empties, too many and we hold
  // deposits that are not ours — so it never gets the affirmative colour.
  it('never calls an over-return an improvement', () => {
    renderDrawer(context({ returns: [{ key: 'r-1', name: 'Sud', quantity: 5 }] }));

    fireEvent.change(actualInput('Sud', 'Vráceno'), { target: { value: '7' } });

    expect(rowOf('Sud', 'Vráceno')).toHaveAttribute('data-tone', 'new');
    // The words count pieces, as they do on the screens behind the form; the plan column is
    // where the returns' own unit shows.
    expect(screen.getByText('Vráceno navíc 2 ks')).toBeInTheDocument();
  });

  it('unmarks it again when the number goes back', () => {
    renderDrawer(context({
      entries: [entry({ orderItemId: ITEM, plannedQuantity: 10, actualQuantity: 7 })],
    }));
    expect(rowOf('Ležák 12')).toHaveAttribute('data-changed', 'true');

    fireEvent.change(actualInput('Ležák 12'), { target: { value: '10' } });

    expect(rowOf('Ležák 12')).toHaveAttribute('data-changed', 'false');
  });

  // Hiding the section when nothing was planned would leave the commonest surprise of the whole
  // feature with nowhere to be written down.
  it('offers the vratky section even when the order planned none', () => {
    renderDrawer(context({ returns: [] }));

    expect(screen.getByText('Vratky')).toBeInTheDocument();
    expect(screen.getByLabelText('Přidat vratku, kterou objednávka neplánovala')).toBeInTheDocument();
  });

  it('records empties handed over against an order that planned none', () => {
    renderDrawer(context());

    fireEvent.change(screen.getByLabelText('Přidat vratku, kterou objednávka neplánovala'), {
      target: { value: 'Basy prázdných' },
    });
    fireEvent.change(screen.getByLabelText('Přidat vratku, kterou objednávka neplánovala — počet'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(savedRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: ClientLedgerEntryTarget.ReturnQuantity,
        lineName: 'Basy prázdných',
        plannedQuantity: 0,
        actualQuantity: 4,
      }),
    ]));
  });

  // ---------------------------------------------------------------------------------
  // Adding a product from the catalog. It is the order editor's own catalog, brewery panels and
  // all — the dropdown it replaced listed the entire catalog flat, which nobody could read.
  // ---------------------------------------------------------------------------------

  it('calls the section "Přidat produkt navíc"', () => {
    renderDrawer(context());

    expect(screen.getByText('Přidat produkt navíc')).toBeInTheDocument();
  });

  // Closed, or the catalog buries Vratky and the money under it.
  it('starts the brewery panels closed', () => {
    catalogState.data = catalogOf({ id: 'p-9', name: 'Svijanská Desítka', priceWithVat: 1860 });
    renderDrawer(context());

    expect(screen.getByText('Svijany')).toBeInTheDocument();
    expect(screen.queryByText('Svijanská Desítka')).not.toBeInTheDocument();
  });

  // The panel animates shut, so its rows outlive the click that closed it — a bare queryBy here
  // would pass or fail depending on how fast the machine ran the transition.
  it('folds a brewery away again', async () => {
    catalogState.data = catalogOf({ id: 'p-9', name: 'Svijanská Desítka', priceWithVat: 1860 });
    renderDrawer(context());

    fireEvent.click(screen.getByText('Svijany'));
    const row = screen.getByText('Svijanská Desítka');
    fireEvent.click(screen.getByText('Svijany'));

    await waitForElementToBeRemoved(row);
  });

  it('shows the product, its size and the client price once its brewery is opened', () => {
    catalogState.data = catalogOf({ id: 'p-9', name: 'Svijanská Desítka', priceWithVat: 1860 });
    renderDrawer(context());

    fireEvent.click(screen.getByText('Svijany'));

    expect(screen.getByText('Svijanská Desítka')).toBeInTheDocument();
    expect(screen.getByText('50 l')).toBeInTheDocument();
    expect(screen.getByText('1860 Kč')).toBeInTheDocument();
  });

  it('records a product taken at the door against the product, not a line', () => {
    catalogState.data = catalogOf({ id: 'p-9', name: 'Světlé 10' });
    renderDrawer(context());

    fireEvent.click(screen.getByText('Svijany'));
    fireEvent.click(screen.getByRole('button', { name: 'Přidat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(savedRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: ClientLedgerEntryTarget.ProductQuantity,
        productId: 'p-9',
        plannedQuantity: 0,
        actualQuantity: 1,
      }),
    ]));
  });

  it('counts up with the catalog\'s own control', () => {
    catalogState.data = catalogOf({ id: 'p-9', name: 'Světlé 10' });
    renderDrawer(context());

    fireEvent.click(screen.getByText('Svijany'));
    fireEvent.click(screen.getByRole('button', { name: 'Přidat' }));
    // Now a +/− pair, one of which reads "Přidat" too — the row's is the one inside the panel.
    fireEvent.click(screen.getAllByRole('button', { name: 'Přidat' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(savedRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: 'p-9', actualQuantity: 2 }),
    ]));
  });

  // Taking more of a product the order plans is an over-delivery on that line, recorded in the
  // Skutečně column. Offering it here too would write a second entry for one product.
  it('leaves out a product the order already plans', () => {
    catalogState.data = catalogOf(
      { id: 'p-1', name: 'Ležák 12' },
      { id: 'p-9', name: 'Světlé 10' },
    );
    renderDrawer(context({ itemProductIds: ['p-1'] }));

    fireEvent.click(screen.getByText('Svijany'));

    expect(screen.getByText('Světlé 10')).toBeInTheDocument();
    // Only the row of the planned line above, not a catalog row of its own.
    expect(screen.getAllByText('Ležák 12')).toHaveLength(1);
  });

  it('says nothing about a catalog that has not arrived', () => {
    renderDrawer(context());

    expect(screen.getByText('Žádné produkty')).toBeInTheDocument();
  });

  // Nothing is stored yet, so there is nothing for a zero to delete — the row just goes.
  it('drops a just-picked product outright when it is taken off again', () => {
    catalogState.data = catalogOf({ id: 'p-9', name: 'Světlé 10' });
    renderDrawer(context());

    fireEvent.click(screen.getByText('Svijany'));
    fireEvent.click(screen.getByRole('button', { name: 'Přidat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Odebrat Světlé 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(screen.queryByLabelText('Světlé 10 — vzato na místě')).not.toBeInTheDocument();
    // The planned line still goes, as every save does; the product does not.
    expect(savedRows()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: 'p-9' }),
    ]));
  });

  // ---------------------------------------------------------------------------------
  // Correcting one that was already added. The form that wrote a mistyped quantity is the one
  // place it has to be fixable — until this existed, the drawer built its tables from the
  // order's lines alone, so an addition it had made itself was invisible on reopening.
  // ---------------------------------------------------------------------------------

  function doorSide(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
    return entry({
      productId: 'p-9',
      productName: 'Světlé 10',
      plannedQuantity: 0,
      actualQuantity: 4,
      ...over,
    });
  }

  it('lists a product added at the door, with what was recorded', () => {
    renderDrawer(context({ entries: [doorSide()] }));

    expect(actualInput('Světlé 10', 'vzato na místě').value).toBe('4');
  });

  // Not a section of its own below the table: the operator reads one list of what the client
  // ended up with, so the row sits among the order's own lines.
  it('puts it in the same table as the order\'s lines', () => {
    renderDrawer(context({ entries: [doorSide()] }));

    const planned = rowOf('Ležák 12');
    const doorSideRow = rowOf('Světlé 10', 'vzato na místě');

    expect(doorSideRow).toHaveAttribute('data-tone', 'new');
    expect(doorSideRow?.parentElement).toBe(planned?.parentElement);
  });

  it('corrects it against the product, so the server rewrites the entry it wrote', () => {
    renderDrawer(context({ entries: [doorSide()] }));

    fireEvent.change(actualInput('Světlé 10', 'vzato na místě'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(savedRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: ClientLedgerEntryTarget.ProductQuantity,
        productId: 'p-9',
        plannedQuantity: 0,
        actualQuantity: 2,
      }),
    ]));
  });

  // Zero is how the server is told a line is back at its plan, which deletes the stored entry —
  // the same mechanism that undoes a shortfall on a planned line.
  it('takes it off by zeroing it', () => {
    renderDrawer(context({ entries: [doorSide()] }));

    fireEvent.click(screen.getByRole('button', { name: 'Odebrat Světlé 10' }));
    expect(actualInput('Světlé 10', 'vzato na místě').value).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(savedRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: 'p-9', plannedQuantity: 0, actualQuantity: 0 }),
    ]));
  });

  // The catalog is not a separate world from the list above it: a product already taken shows
  // its count on its own row, which is the one thing a hidden option could never do.
  it('shows what is already taken on the catalog row itself', () => {
    catalogState.data = catalogOf({ id: 'p-9', name: 'Světlé 10' });
    renderDrawer(context({ entries: [doorSide()] }));

    fireEvent.click(screen.getByText('Svijany'));

    // 4 from the entry, shown on the row's own +/− control — which is there instead of the
    // bare "Přidat" button an untaken product gets.
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ubrat' })).toBeInTheDocument();
  });

  // A settled entry is history to the server: a save carrying the same product would open a
  // second row beside it instead of rewriting it.
  it('leaves a settled addition alone', () => {
    renderDrawer(context({
      entries: [doorSide({ resolvedAt: new Date('2026-08-26T09:00:00Z') })],
    }));

    expect(screen.queryByLabelText('Světlé 10 — vzato na místě')).not.toBeInTheDocument();
  });

  it('records money with the sign the operator typed', () => {
    renderDrawer(context());

    fireEvent.change(screen.getByLabelText(/Rozdíl v Kč/), { target: { value: '-500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(savedRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: ClientLedgerEntryTarget.Money, amount: -500 }),
    ]));
  });

  // Money is the one free row the drawer owns rather than appends: re-saving must correct the
  // debt, not open a second one beside it.
  // Awaited: the money call happens after the batch save resolves, so a bare click has not
  // reached it yet.
  it('corrects an existing money entry instead of appending another', async () => {
    const money = entry({ target: ClientLedgerEntryTarget.Money, amount: 2400, requiresFollowUp: true });
    renderDrawer(context({ entries: [money] }));

    expect((screen.getByLabelText(/Rozdíl v Kč/) as HTMLInputElement).value).toBe('2400');

    fireEvent.change(screen.getByLabelText(/Rozdíl v Kč/), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0]).toMatchObject({ id: money.id });
    expect(saveMock.mock.calls[0]?.[0].data.rows ?? []).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ target: ClientLedgerEntryTarget.Money })]),
    );
  });

  it('drops the money entry when the amount is cleared', async () => {
    const money = entry({ target: ClientLedgerEntryTarget.Money, amount: 2400, requiresFollowUp: true });
    renderDrawer(context({ entries: [money] }));

    fireEvent.change(screen.getByLabelText(/Rozdíl v Kč/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
    expect(deleteMock.mock.calls[0][0]).toMatchObject({ id: money.id });
  });

  // On a client profile there is no delivery to diff, so the quantity tables have nothing to
  // show and the drawer is only a way to open a standalone debt.
  it('offers only free rows with no order in context', () => {
    renderDrawer(context({ orderId: undefined, orderLabel: undefined, items: [] }));

    expect(screen.queryByText('Položky')).not.toBeInTheDocument();
    expect(screen.queryByText('Vratky')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Rozdíl v Kč/)).toBeInTheDocument();
  });

  it('shows the automatic address record read-only', () => {
    renderDrawer(context({
      entries: [entry({
        target: ClientLedgerEntryTarget.DeliveryAddress,
        plannedText: 'Dlouhá 1',
        actualText: 'Krátká 2',
      })],
    }));

    expect(screen.getByText('Dlouhá 1')).toBeInTheDocument();
    expect(screen.getByText('Krátká 2')).toBeInTheDocument();
    expect(screen.getByText(/Zapsáno automaticky/)).toBeInTheDocument();
  });

  // The payload has to survive being serialized, which is the one thing recording the mutation
  // argument does not prove. SaveClientLedgerEntriesDto.toJSON() calls toJSON() on every row, so
  // a row built as a plain object literal throws "item.toJSON is not a function" — and every
  // assertion above passed while it did, because they only ever read the object's fields.
  it('sends rows the generated client can serialize', () => {
    renderDrawer(context());

    fireEvent.change(actualInput('Ležák 12'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    const payload = saveMock.mock.calls[0][0].data;
    expect(() => payload.toJSON()).not.toThrow();
    expect(payload.toJSON().rows[0]).toMatchObject({ plannedQuantity: 10, actualQuantity: 7 });
  });

  it('records nothing at all when the operator changes nothing', () => {
    renderDrawer(context({ items: [], returns: [], extras: [], goods: [] }));

    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(saveMock).not.toHaveBeenCalled();
  });
});
