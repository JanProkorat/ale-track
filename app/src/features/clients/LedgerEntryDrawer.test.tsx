// The drawer that records what happened. The trap it exists to avoid: prefilling "Skutečně"
// from the plan rather than from what is already stored, which would record the difference a
// second time and double the client's debt.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget, ProductKind } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import type { LedgerDrawerContext } from './LedgerEntryDrawer';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const saveMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('src/hooks/useClientLedger', () => ({
  useSaveClientLedgerEntries: () => ({ mutateAsync: saveMock, isPending: false }),
  useUpdateClientLedgerEntry: () => ({ mutateAsync: updateMock, isPending: false }),
  useDeleteClientLedgerEntry: () => ({ mutateAsync: deleteMock, isPending: false }),
}));

// The product picker is a resource hook like any other, and the mock can express no-data. The
// brewery and kind are what the picker groups by, so a product here carries them.
const productState: {
  data?: Array<{ id: string; name: string; breweryName?: string; kind?: ProductKind; packageSize?: number }>;
} = { data: [] };
vi.mock('src/hooks/useProducts', () => ({ useProducts: () => productState }));

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
  productState.data = [];
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

  it('calls the picker "Přidat produkt navíc"', () => {
    renderDrawer(context());

    expect(screen.getByText('Přidat produkt navíc')).toBeInTheDocument();
  });

  // The catalog is the whole catalog here, so the options carry the headings it groups by.
  it('heads the picker options by brewery and kind', () => {
    productState.data = [
      { id: 'p-9', name: 'Svijanská Desítka', breweryName: 'Svijany', kind: ProductKind.Keg, packageSize: 50 },
    ];
    renderDrawer(context());

    fireEvent.change(screen.getByPlaceholderText('— vyberte —'), { target: { value: 'Desítka' } });

    expect(screen.getByText('Svijany · Sud')).toBeInTheDocument();
    expect(screen.getByText('50 l')).toBeInTheDocument();
  });

  it('records a product taken at the door against the product, not a line', () => {
    productState.data = [{ id: 'p-9', name: 'Světlé 10' }];
    renderDrawer(context());

    fireEvent.change(screen.getByLabelText('Počet navíc'), { target: { value: '4' } });
    // The Combobox is an Autocomplete: type, then pick the option.
    const picker = screen.getByPlaceholderText('— vyberte —');
    fireEvent.change(picker, { target: { value: 'Světlé' } });
    fireEvent.click(screen.getByText('Světlé 10'));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    expect(savedRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: ClientLedgerEntryTarget.ProductQuantity,
        productId: 'p-9',
        plannedQuantity: 0,
        actualQuantity: 4,
      }),
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

  // Picking it again would overwrite the row above rather than add to it, so it is not offered.
  it('drops an already-added product from the picker', () => {
    productState.data = [{ id: 'p-9', name: 'Světlé 10' }, { id: 'p-1', name: 'Tmavé 11' }];
    renderDrawer(context({ entries: [doorSide()] }));

    const picker = screen.getByPlaceholderText('— vyberte —');
    fireEvent.change(picker, { target: { value: 'é 1' } });

    expect(screen.getByText('Tmavé 11')).toBeInTheDocument();
    // The name still appears once — as the editable row above, not as an option.
    expect(screen.getAllByText('Světlé 10')).toHaveLength(1);
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
