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
  ProductKind, ProductListItemDto, ProductType, UpdateOrderResultDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

const updateMutate = vi.fn();
const createMutate = vi.fn();

const PRODUCT = 'prod-owed';

let ledgerResponse: { data?: ClientLedgerEntryDto[]; isLoading: boolean; isError: boolean } = {
  data: [],
  isLoading: false,
  isError: false,
};

vi.mock('src/hooks/useOrders', () => ({
  useOrder: () => ({ data: orderFixture(), isLoading: false, isError: false }),
  useClientProductHistory: () => ({ data: [], isLoading: false }),
  useCreateOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateOrder: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

vi.mock('src/hooks/useClientLedger', () => ({
  useClientLedger: () => ledgerResponse,
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
  useSuppliers: () => ({ data: [], isLoading: false }),
  useSuppliersMany: () => ({ bySupplier: new Map(), loading: new Set() }),
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
      new OrderItemDto({ id: 'item-1', orderId: 'order-1', productId: 'prod-other', productName: 'Světlé 10', quantity: 2 }),
    ],
    returns: [],
    notes: [],
    customExtraItems: [],
  });
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

function renderEditor() {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <MuiThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <OrderEditor mode="edit" orderId="order-1" onDone={vi.fn()} onCancel={vi.fn()} />
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
  ledgerResponse = { data: [], isLoading: false, isError: false };
});

describe('OrderEditor — settling open points', () => {
  it('shows the client\'s open points above the cart', async () => {
    ledgerResponse = { data: [owed()], isLoading: false, isError: false };
    renderEditor();

    await waitFor(() => expect(screen.getByText('Nedořešeno u klienta')).toBeInTheDocument());
    expect(screen.getByText(/dluh 3 ks/)).toBeInTheDocument();
  });

  it('has no preview when the client has nothing open', async () => {
    renderEditor();

    await waitFor(() => expect(screen.getByText('Košík')).toBeInTheDocument());
    expect(screen.queryByText('Nedořešeno u klienta')).not.toBeInTheDocument();
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

  it('does not crash when the ledger cannot be read', async () => {
    ledgerResponse = { data: undefined, isLoading: false, isError: true };

    expect(() => renderEditor()).not.toThrow();
    await waitFor(() => expect(screen.getByText('Košík')).toBeInTheDocument());
  });
});
