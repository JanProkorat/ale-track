// Settling a client's open points from the order editor: the top-up, the shortfall the operator
// has to acknowledge, and the ids the save carries.
//
// fireEvent rather than user-event, matching the other editor tests — user-event is not a
// dependency of this project.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientInfoDto, ClientLedgerEntryDto, ClientLedgerEntryTarget, OrderDto, OrderItemDto,
  OrderLineKind, ProductKind, ProductListItemDto, ProductType, UpdateOrderResultDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

const updateMutate = vi.fn();
const createMutate = vi.fn();
const resolveMock = vi.fn();

const PRODUCT = 'prod-owed';
const GOOD = 'good-owed';
const SUPPLIER = {
  id: 'sup-1',
  name: 'Linde Gas',
  goods: [{ id: GOOD, name: 'CO₂ láhev', size: '10 kg', prices: [] }],
};

let ledgerResponse: { data?: ClientLedgerEntryDto[]; isLoading: boolean; isError: boolean } = {
  data: [],
  isLoading: false,
  isError: false,
};

/** The order the editor loads. Overridable, for the cases that start from a saved promise. */
let loadedOrder: OrderDto;

vi.mock('src/hooks/useOrders', () => ({
  useOrder: () => ({ data: loadedOrder, isLoading: false, isError: false }),
  useClientProductHistory: () => ({ data: [], isLoading: false }),
  useCreateOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateOrder: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

vi.mock('src/hooks/useClientLedger', () => ({
  useClientLedger: () => ledgerResponse,
  useSetClientLedgerEntryResolution: () => ({ mutateAsync: resolveMock, isPending: false }),
}));

vi.mock('src/hooks/useClients', () => ({
  useClients: () => ({ data: [{ id: 'client-a', name: 'Hospoda A' }], isLoading: false }),
  useClient: () => ({ data: { name: 'Hospoda A' }, isLoading: false }),
}));

vi.mock('src/hooks/useBreweries', () => ({ useBreweries: () => ({ data: [], isLoading: false }) }));

vi.mock('src/hooks/useProducts', () => ({
  useProducts: () => ({
    data: [
      new ProductListItemDto({
        id: PRODUCT,
        name: 'Ležák 12',
        kind: ProductKind.Keg,
        type: ProductType.PaleLager,
        packageSize: 50,
        priceWithVat: 1200,
      }),
    ],
    isLoading: false,
  }),
}));

vi.mock('src/hooks/useSuppliers', () => ({
  useSuppliers: () => ({ data: [SUPPLIER], isLoading: false }),
  useSuppliersMany: () => ({ bySupplier: new Map([['sup-1', SUPPLIER]]), loading: new Set() }),
}));

vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useClientDeliveryPlaces: () => ({ data: [], isLoading: false }),
  useCreateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk?: number | null) => (czk == null ? '—' : `${czk} Kč`) }),
}));

// Shared, not a fresh spy per call: the save has to be able to say what it undid on the run.
const snackbar = vi.fn();
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: snackbar }) }));

const { OrderEditor } = await import('./OrderEditor');

function orderFixture(): OrderDto {
  return new OrderDto({
    id: 'order-1',
    client: new ClientInfoDto({ id: 'client-a', name: 'Hospoda A' }),
    orderItems: [
      new OrderItemDto({ id: 'item-1', orderId: 'order-1', productId: PRODUCT, productName: 'Ležák 12', quantity: 2 }),
    ],
    returns: [],
    notes: [],
    customExtraItems: [],
  });
}

/** The same order after a save that promised a shortfall: the billed line and the private one. */
function orderCarryingAPrivateLine(): OrderDto {
  const order = orderFixture();
  order.orderItems = [
    ...(order.orderItems ?? []),
    new OrderItemDto({
      id: 'item-private',
      orderId: 'order-1',
      productId: PRODUCT,
      productName: 'Ležák 12',
      quantity: 1,
      lineKind: OrderLineKind.Private,
    }),
  ];
  return order;
}

function owed(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return ClientLedgerEntryDto.fromJS({
    id: 'entry-owed',
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

/** A good off a supplier's price list, owed and with no line on the order. */
function keptGood(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return owed({
    id: 'entry-good',
    target: ClientLedgerEntryTarget.SupplierGoodQuantity,
    productId: undefined,
    productName: undefined,
    supplierGoodId: GOOD,
    goodName: 'CO₂ láhev',
    plannedQuantity: 3,
    actualQuantity: 1,
    ...over,
  });
}

/** Empties the client kept: closed from the vratky, not the cart. */
function keptEmpties(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
  return owed({
    id: 'entry-returns',
    target: ClientLedgerEntryTarget.ReturnQuantity,
    productId: undefined,
    productName: undefined,
    lineName: 'Basy prázdných',
    plannedQuantity: 5,
    actualQuantity: 4,
    ...over,
  });
}

function renderEditor() {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <MuiThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <OrderEditor
              mode="edit"
              orderId="order-1"
              onDone={vi.fn()}
              onCancel={vi.fn()}
            />
          </LocalizationProvider>
        </MuiThemeProvider>
      ),
    },
  ]);
  return render(<RouterProvider router={router} />);
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: /Uložit/ }));
}

/**
 * The cart's minus button for the topped-up line.
 *
 * By index rather than by name: every cart row labels its control just "Ubrat". The owed line is
 * appended after the order's own, so it is the last one.
 */
function decrementOwedLine() {
  const cart = screen.getByText('Košík').closest('.MuiCard-root') as HTMLElement;
  const buttons = within(cart).getAllByLabelText('Ubrat');
  fireEvent.click(buttons[buttons.length - 1]);
}

beforeEach(() => {
  updateMutate.mockReset().mockResolvedValue(UpdateOrderResultDto.fromJS({}));
  snackbar.mockReset();
  createMutate.mockReset().mockResolvedValue('order-1');
  resolveMock.mockReset().mockResolvedValue('ok');
  loadedOrder = orderFixture();
  ledgerResponse = { data: [], isLoading: false, isError: false };
});

describe('OrderEditor — settling open points', () => {
  it('shows the client\'s open points above the cart', async () => {
    ledgerResponse = { data: [owed()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByText('Nedořešeno u klienta')).toBeInTheDocument());
    expect(screen.getByText(/dovézt 3 ks/)).toBeInTheDocument();
  });

  it('has no preview when the client has nothing open', async () => {
    renderEditor();

    await waitFor(() => expect(screen.getByText('Košík')).toBeInTheDocument());
    expect(screen.queryByText('Nedořešeno u klienta')).not.toBeInTheDocument();
  });

  // Reported: the client was billed for four and got three, so the missing piece must not be
  // billed a second time. The shortfall is only recorded once the run's invoicing is filed, which
  // is exactly when the money has already been taken.
  it('carries a shortfall as a private line, billed to nobody', async () => {
    ledgerResponse = {
      data: [owed({ plannedQuantity: 4, actualQuantity: 3 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));

    const cart = screen.getByText('Košík').closest('.MuiCard-root') as HTMLElement;
    expect(within(cart).getByText('Soukromě')).toBeInTheDocument();

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const items = updateMutate.mock.calls[0][0].data.orderItems;

    // Two lines for one product: the two the client ordered and pays for, and the one they were
    // already charged for and never got.
    expect(items.filter((i: { productId: string }) => i.productId === PRODUCT)
      .map((i: { lineKind: number, quantity: number }) => [i.lineKind, i.quantity]))
      .toEqual([[OrderLineKind.Normal, 2], [OrderLineKind.Private, 1]]);
  });

  // Raising the ordered line to max(ordered, owed) shipped what was ordered and billed it — the
  // missing piece never actually left the warehouse.
  it('does not fold the shortfall into the line the client ordered', async () => {
    ledgerResponse = {
      data: [owed({ plannedQuantity: 4, actualQuantity: 3 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const items = updateMutate.mock.calls[0][0].data.orderItems;
    const ordered = items.find((i: { lineKind: number }) => i.lineKind === OrderLineKind.Normal);

    // The ordered line is untouched: the free piece rides beside it, not inside it.
    expect(ordered.quantity).toBe(2);
  });

  // A supplier good owed from an earlier run was billed on that run too.
  it('carries an owed supplier good as a private line', async () => {
    ledgerResponse = { data: [keptGood()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat zboží do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat zboží do objednávky/ }));

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.supplierGoodItems).toEqual([
      expect.objectContaining({ supplierGoodId: GOOD, quantity: 2, lineKind: OrderLineKind.Private }),
    ]);
  });

  // Promising is not delivering: the id travels with the save, and the server closes the entry
  // only once the order actually arrives.
  it('sends the promised entry ids on save', async () => {
    ledgerResponse = { data: [owed()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));

    // The whole debt landed in the cart, so there is nothing to ask about.
    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual(['entry-owed']);
  });

  // ---------------------------------------------------------------------------------
  // What the save undid on the run. It is somebody else's work — a Fakturace row checked off, a
  // line counted into the van — so the editor says so instead of leaving them to find out.
  // ---------------------------------------------------------------------------------

  it('says what the save undid on the run', async () => {
    updateMutate.mockResolvedValue(UpdateOrderResultDto.fromJS({
      invoicingUnmarked: true,
      loadingChecksCleared: 2,
    }));
    renderEditor();

    await waitFor(() => expect(screen.getByText('Košík')).toBeInTheDocument());
    save();

    await waitFor(() => expect(snackbar).toHaveBeenCalledWith(
      expect.stringContaining('fakturace už není označená jako hotová'),
      { variant: 'warning' },
    ));
    expect(snackbar.mock.calls.at(-1)![0]).toContain('u 2 položek padla kontrola nakládky');
  });

  // The run-wide reset says the stronger thing: the product goes back to unloaded, which is why
  // the ticks that came with it are not spelled out beside it.
  it('names the run-wide reset instead of the ticks it came with', async () => {
    updateMutate.mockResolvedValue(UpdateOrderResultDto.fromJS({
      loadingChecksCleared: 2,
      loadingProductsReset: 1,
    }));
    renderEditor();

    await waitFor(() => expect(screen.getByText('Košík')).toBeInTheDocument());
    save();

    await waitFor(() => expect(snackbar).toHaveBeenCalledWith(
      expect.stringContaining('nakládka se u 1 produktu vrátila na nenaloženo'),
      { variant: 'warning' },
    ));
    expect(snackbar.mock.calls.at(-1)![0]).not.toContain('padla kontrola nakládky');
  });

  it('says nothing extra when the save undid nothing', async () => {
    renderEditor();

    await waitFor(() => expect(screen.getByText('Košík')).toBeInTheDocument());
    save();

    await waitFor(() => expect(snackbar).toHaveBeenCalledWith('Objednávka uložena.', { variant: 'success' }));
    expect(snackbar).not.toHaveBeenCalledWith(expect.anything(), { variant: 'warning' });
  });

  it('adds the owed quantity to the cart', async () => {
    ledgerResponse = { data: [owed()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));

    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const items = updateMutate.mock.calls[0][0].data.orderItems;
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: PRODUCT, quantity: 3 }),
    ]));
  });

  // Binary resolution: a debt of three settled with two closes whole and loses the third, so the
  // save has to ask rather than swallow it.
  it('asks before saving a promise the cart does not cover', async () => {
    ledgerResponse = { data: [owed()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));

    // Take one back out, leaving two of the three.
    decrementOwedLine();

    save();

    await waitFor(() => expect(screen.getByText('Dluh není dorovnaný')).toBeInTheDocument());
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('saves anyway once the shortfall is acknowledged', async () => {
    ledgerResponse = { data: [owed()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));
    decrementOwedLine();
    save();

    await waitFor(() => expect(screen.getByText('Dluh není dorovnaný')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Uložit i tak' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual(['entry-owed']);
  });

  // The promise is the state between open and closed: the row says which order took it on, and
  // the button is gone so nobody promises it twice.
  it('marks a point the draft has taken on, and lets the promise go again', async () => {
    ledgerResponse = { data: [owed()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));

    expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat do objednávky/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vyřadit z objednávky' }));

    // Back to being simply open, and the save carries nothing.
    expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument();
    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual([]);
  });

  // ---------------------------------------------------------------------------------
  // The two points a delivery cannot top up from the cart: empties the client kept, and
  // everything that is office work. Both used to be dead rows.
  // ---------------------------------------------------------------------------------

  it('opens a vratka row for empties the client kept, and promises the entry', async () => {
    ledgerResponse = { data: [keptEmpties()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do vratek/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do vratek/ }));

    // The row lands in Vratky under the entry's own name, filled with what is still owed.
    const vratky = screen.getByText('Vratky').closest('.MuiCard-root') as HTMLElement;
    expect(within(vratky).getByDisplayValue('Basy prázdných')).toBeInTheDocument();

    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.settledLedgerEntryIds).toEqual(['entry-returns']);
    expect(data.returns).toEqual([expect.objectContaining({ name: 'Basy prázdných', quantity: 1 })]);
  });

  // Binary either way: a vratka promised for 5 and opened for 4 loses the fifth exactly as a
  // cart line would, so the same warning has to cover it.
  it('asks before saving a promised vratka the rows do not cover', async () => {
    ledgerResponse = { data: [keptEmpties({ plannedQuantity: 9, actualQuantity: 4 })], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do vratek/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do vratek/ }));

    const vratky = screen.getByText('Vratky').closest('.MuiCard-root') as HTMLElement;
    const qty = within(vratky).getByDisplayValue('5');
    fireEvent.change(qty, { target: { value: '3' } });

    save();

    await waitFor(() => expect(screen.getByText('Dluh není dorovnaný')).toBeInTheDocument());
    expect(updateMutate).not.toHaveBeenCalled();
  });

  // Supplier goods go on the order's own goods lines, not in the cart: there is no client price
  // to resolve, only the supplier's.
  it('puts an owed supplier good on the order goods lines, and promises the entry', async () => {
    ledgerResponse = { data: [keptGood()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat zboží do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat zboží do objednávky/ }));

    expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument();

    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.settledLedgerEntryIds).toEqual(['entry-good']);
    expect(data.supplierGoodItems).toEqual([
      expect.objectContaining({ supplierGoodId: GOOD, quantity: 2 }),
    ]);
  });

  // The other half of the door-side case: the client took pieces nobody planned, so the money is
  // outstanding rather than the goods. The next order carries it as a bill-only line.
  it('puts pieces the client already took on the order as a bill-only line', async () => {
    ledgerResponse = {
      data: [owed({ id: 'entry-extra', plannedQuantity: 0, actualQuantity: 2 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByText('doúčtovat 2 ks')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat k dofakturaci/ }));

    expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument();

    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const items = updateMutate.mock.calls[0][0].data.orderItems;
    const billed = items.filter((i: { lineKind: number }) => i.lineKind === OrderLineKind.BillOnly);
    expect(billed).toEqual([
      expect.objectContaining({ productId: PRODUCT, quantity: 2, lineKind: OrderLineKind.BillOnly }),
    ]);
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual(['entry-extra']);
  });

  // The pieces must not be loaded, so they cannot ride on the ordinary line for that product.
  it('keeps the bill-only pieces on a line of their own', async () => {
    ledgerResponse = {
      data: [owed({ id: 'entry-extra', plannedQuantity: 0, actualQuantity: 2 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat k dofakturaci/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat k dofakturaci/ }));

    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const items = updateMutate.mock.calls[0][0].data.orderItems;
    // The order's own line for this product plus the bill-only one beside it: one instruction to
    // load two pieces, one instruction to bill two more.
    const forProduct = items.filter((i: { productId: string }) => i.productId === PRODUCT);
    expect(forProduct).toHaveLength(2);
    expect(forProduct.map((i: { lineKind: number, quantity: number }) => [i.lineKind, i.quantity]))
      .toEqual([[OrderLineKind.Normal, 2], [OrderLineKind.BillOnly, 2]]);
  });

  // ---------------------------------------------------------------------------------
  // Undo, both ways. The promise and the row it opened are one act, so taking either back has to
  // take the other with it — a promise left standing closes the point on delivery with nothing
  // delivered for it.
  // ---------------------------------------------------------------------------------

  it('takes the vratka row back out when the promise is undone', async () => {
    ledgerResponse = { data: [keptEmpties()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do vratek/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do vratek/ }));

    const vratky = () => screen.getByText('Vratky').closest('.MuiCard-root') as HTMLElement;
    expect(within(vratky()).getByDisplayValue('Basy prázdných')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vyřadit z objednávky' }));

    expect(within(vratky()).queryByDisplayValue('Basy prázdných')).not.toBeInTheDocument();

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.settledLedgerEntryIds).toEqual([]);
    expect(data.returns).toEqual([]);
  });

  it('takes the cart line back out when the promise is undone', async () => {
    ledgerResponse = { data: [owed({ id: 'entry-owed' })], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do objednávky/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vyřadit z objednávky' }));

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.settledLedgerEntryIds).toEqual([]);
    // Back to the order's own line at its own count, not to nothing: the product was in the
    // cart for its own sake before the top-up.
    expect(data.orderItems).toEqual([
      expect.objectContaining({ productId: PRODUCT, quantity: 2 }),
    ]);
  });

  // The other direction: pulling the row out by hand means the order is not settling that point.
  it('drops the promise when the vratka row is removed by hand', async () => {
    ledgerResponse = { data: [keptEmpties()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do vratek/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do vratek/ }));

    const vratky = screen.getByText('Vratky').closest('.MuiCard-root') as HTMLElement;
    fireEvent.click(within(vratky).getByRole('button', { name: 'Odebrat vratku' }));

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual([]);
  });

  it('drops the promise when the bill-only line is removed by hand', async () => {
    ledgerResponse = {
      data: [owed({ id: 'entry-extra', plannedQuantity: 0, actualQuantity: 2 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat k dofakturaci/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat k dofakturaci/ }));

    // The bill-only row is the one appended after the order's own, so its Odebrat is the last.
    const cart = screen.getByText('Košík').closest('.MuiCard-root') as HTMLElement;
    const removes = within(cart).getAllByLabelText('Odebrat');
    fireEvent.click(removes[removes.length - 1]);

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.settledLedgerEntryIds).toEqual([]);
    expect(data.orderItems.filter((i: { lineKind: number }) => i.lineKind === OrderLineKind.BillOnly))
      .toEqual([]);
  });

  it('drops the promise when a promised supplier good is removed by hand', async () => {
    ledgerResponse = { data: [keptGood()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat zboží do objednávky/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat zboží do objednávky/ }));

    const cart = screen.getByText('Košík').closest('.MuiCard-root') as HTMLElement;
    const removes = within(cart).getAllByLabelText('Odebrat');
    fireEvent.click(removes[removes.length - 1]);

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.settledLedgerEntryIds).toEqual([]);
    expect(data.supplierGoodItems).toEqual([]);
  });

  // Reported: a row added through a change, then retyped by hand, left the change claiming the
  // order still settles it. The promise was about a row of that kind — retyping it makes the row
  // the operator's own.
  it('releases the point when the row it settled is retyped', async () => {
    ledgerResponse = {
      data: [owed({ id: 'entry-extra', plannedQuantity: 0, actualQuantity: 2 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat k dofakturaci/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat k dofakturaci/ }));
    expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument();

    // The bill-only row is appended after the order's own, so its kind control is the last one.
    const cart = screen.getByText('Košík').closest('.MuiCard-root') as HTMLElement;
    const kindButtons = within(cart).getAllByRole('button', { name: /Druh položky/ });
    fireEvent.click(kindButtons[kindButtons.length - 1]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Normální/ }));

    expect(screen.queryByText('vyřeší tato objednávka')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Přidat k dofakturaci/ })).toBeInTheDocument();

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual([]);
  });

  // ---------------------------------------------------------------------------------
  // Points no line can carry: cash to collect, a deposit to hand back. The order takes the
  // sentence instead, and closes the point when it arrives.
  // ---------------------------------------------------------------------------------

  it('opens a Položky navíc row for a shortfall on one, and promises the entry', async () => {
    ledgerResponse = {
      data: [owed({
        id: 'entry-extra-short',
        target: ClientLedgerEntryTarget.CustomExtraQuantity,
        productId: undefined,
        productName: undefined,
        lineName: 'Tácky',
        plannedQuantity: 7,
        actualQuantity: 6,
      })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do položek navíc/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do položek navíc/ }));

    const extrasCard = screen.getByText('Položky navíc').closest('.MuiCard-root') as HTMLElement;
    expect(within(extrasCard).getByDisplayValue('Tácky')).toBeInTheDocument();

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.customExtraItems).toEqual([
      expect.objectContaining({ description: 'Tácky', quantity: 1 }),
    ]);
    expect(data.settledLedgerEntryIds).toEqual(['entry-extra-short']);
  });

  it('drops the promise when that Položky navíc row is removed by hand', async () => {
    ledgerResponse = {
      data: [owed({
        id: 'entry-extra-short',
        target: ClientLedgerEntryTarget.CustomExtraQuantity,
        productId: undefined,
        productName: undefined,
        lineName: 'Tácky',
        plannedQuantity: 7,
        actualQuantity: 6,
      })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Přidat do položek navíc/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Přidat do položek navíc/ }));

    const extrasCard = screen.getByText('Položky navíc').closest('.MuiCard-root') as HTMLElement;
    fireEvent.click(within(extrasCard).getByRole('button', { name: 'Odebrat položku navíc' }));

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual([]);
  });

  it('writes a money debt onto the order as a note, and promises it', async () => {
    ledgerResponse = {
      data: [owed({
        id: 'entry-money',
        target: ClientLedgerEntryTarget.Money,
        amount: 100,
        productId: undefined,
        productName: undefined,
        plannedQuantity: undefined,
        actualQuantity: undefined,
      })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Připomenout/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Připomenout/ }));

    expect(screen.getByDisplayValue('Vybrat 100 Kč')).toBeInTheDocument();
    expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument();

    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.notes).toEqual([expect.objectContaining({ text: 'Vybrat 100 Kč' })]);
    expect(data.settledLedgerEntryIds).toEqual(['entry-money']);
    // No line of any kind: there is nothing to load and nothing to bill.
    expect(data.orderItems).toEqual([expect.objectContaining({ productId: PRODUCT, quantity: 2 })]);
  });

  it('takes the note back out when the promise is undone', async () => {
    ledgerResponse = {
      data: [keptEmpties({ id: 'entry-deposit', plannedQuantity: 0, actualQuantity: 2 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Připomenout/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Připomenout/ }));
    expect(screen.getByDisplayValue('Vrátit zálohu za 2 ks — Basy prázdných')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vyřadit z objednávky' }));

    expect(screen.queryByDisplayValue('Vrátit zálohu za 2 ks — Basy prázdných')).not.toBeInTheDocument();

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.notes).toEqual([]);
    expect(data.settledLedgerEntryIds).toEqual([]);
  });

  it('drops the promise when the note is removed by hand', async () => {
    ledgerResponse = {
      data: [keptEmpties({ id: 'entry-deposit', plannedQuantity: 0, actualQuantity: 2 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /Připomenout/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Připomenout/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Odebrat poznámku' }));

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual([]);
  });

  // ---------------------------------------------------------------------------------
  // Reopening an order that already carries promises. The save posts the promised ids as the
  // authoritative set, so a draft that starts empty releases every promise the order made.
  // ---------------------------------------------------------------------------------

  it('keeps the promises the order arrived with when nothing is touched', async () => {
    ledgerResponse = {
      data: [owed({ id: 'entry-carried', resolvedByOrderId: 'order-1' })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument());
    save();

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.settledLedgerEntryIds).toEqual(['entry-carried']);
  });

  it('releases a promise the order arrived with when it is undone', async () => {
    loadedOrder = orderCarryingAPrivateLine();
    ledgerResponse = {
      data: [owed({ id: 'entry-carried', resolvedByOrderId: 'order-1', plannedQuantity: 3, actualQuantity: 2 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Vyřadit z objednávky' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Vyřadit z objednávky' }));

    expect(screen.queryByText('vyřeší tato objednávka')).not.toBeInTheDocument();

    save();
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const data = updateMutate.mock.calls[0][0].data;
    expect(data.settledLedgerEntryIds).toEqual([]);
    // The free line goes with the promise; the billed line the client ordered stays.
    expect(data.orderItems).toEqual([
      expect.objectContaining({ productId: PRODUCT, quantity: 2, lineKind: OrderLineKind.Normal }),
    ]);
  });

  // Reported: after a save and a reopen, pulling the row out by hand left the point promised.
  it('releases a promise the order arrived with when its row is removed by hand', async () => {
    loadedOrder = orderCarryingAPrivateLine();
    ledgerResponse = {
      data: [owed({ id: 'entry-carried', resolvedByOrderId: 'order-1', plannedQuantity: 3, actualQuantity: 2 })],
      isLoading: false,
      isError: false,
    };
    renderEditor();

    await waitFor(() => expect(screen.getByText('vyřeší tato objednávka')).toBeInTheDocument());

    // The free line the earlier save opened is the second one for that product, so its Odebrat
    // is the last in the cart.
    const cart = screen.getByText('Košík').closest('.MuiCard-root') as HTMLElement;
    const removes = within(cart).getAllByRole('button', { name: 'Odebrat' });
    fireEvent.click(removes[removes.length - 1]);

    expect(screen.queryByText('vyřeší tato objednávka')).not.toBeInTheDocument();
    // And the card offers to put it back, which is what "not promised any more" means here.
    expect(screen.getByRole('button', { name: /Přidat do objednávky/ })).toBeInTheDocument();
  });

  it('does not crash when the ledger cannot be read', async () => {
    ledgerResponse = { data: undefined, isLoading: false, isError: true };

    expect(() => renderEditor()).not.toThrow();
    await waitFor(() => expect(screen.getByText('Košík')).toBeInTheDocument());
  });
});
