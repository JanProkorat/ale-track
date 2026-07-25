// Vratky editing in the order editor. Returns are owned by the order, so this
// is the only place they can be created or changed — the vývoz just displays
// them. Covers the row CRUD, the note round-trip, blank-row dropping on save,
// and that a return edit alone marks the form dirty.

// fireEvent rather than user-event, matching ShipmentInvoicing.test.tsx —
// user-event is not a dependency of this project.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderDto, OrderReturnDto, OrderItemDto, ClientInfoDto } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

const updateMutate = vi.fn();
const createMutate = vi.fn();
let orderResponse: OrderDto | undefined;

vi.mock('src/hooks/useOrders', () => ({
  useOrder: () => ({ data: orderResponse, isLoading: false, isError: false }),
  useClientProductHistory: () => ({ data: [], isLoading: false }),
  useCreateOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateOrder: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

vi.mock('src/hooks/useClients', () => ({
  useClients: () => ({ data: [{ id: 'client-a', name: 'Hospoda A' }], isLoading: false }),
}));

vi.mock('src/hooks/useBreweries', () => ({
  useBreweries: () => ({ data: [], isLoading: false }),
}));

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => (czk == null ? '—' : `${czk} Kč`) }),
}));

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const { OrderEditor } = await import('./OrderEditor');

function order(returns: OrderReturnDto[]): OrderDto {
  return new OrderDto({
    id: 'order-1',
    client: new ClientInfoDto({ id: 'client-a', name: 'Hospoda A' }),
    // Saving requires a non-empty cart, so every fixture carries one item.
    orderItems: [
      new OrderItemDto({ id: 'item-1', orderId: 'order-1', productId: 'prod-1', productName: 'Albrecht 12°', quantity: 2 }),
    ],
    returns,
  });
}

function renderEditor(mode: 'create' | 'edit' = 'edit') {
  // A data router, not MemoryRouter — the editor's unsaved-changes guard uses
  // useBlocker, which only works inside one.
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <MuiThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <OrderEditor mode={mode} orderId="order-1" onDone={vi.fn()} onCancel={vi.fn()} />
          </LocalizationProvider>
        </MuiThemeProvider>
      ),
    },
  ]);
  return render(<RouterProvider router={router} />);
}

/** The Vratky card, located by its heading. */
function returnsCard(): HTMLElement {
  return screen.getByText('Vratky').closest('.MuiCard-root') as HTMLElement;
}

function nameInputs(): HTMLInputElement[] {
  return within(returnsCard()).getAllByPlaceholderText('Např. prázdné sudy 50 l') as HTMLInputElement[];
}

beforeEach(() => {
  updateMutate.mockReset().mockResolvedValue(undefined);
  createMutate.mockReset().mockResolvedValue('new-id');
  orderResponse = order([]);
});

describe('OrderEditor — vratky', () => {
  it('shows the empty state until a row is added', () => {
    renderEditor();

    expect(within(returnsCard()).getByText(/Žádné vratky/)).toBeInTheDocument();

    fireEvent.click(within(returnsCard()).getByRole('button', { name: 'Přidat' }));

    expect(within(returnsCard()).queryByText(/Žádné vratky/)).not.toBeInTheDocument();
    expect(nameInputs()).toHaveLength(1);
  });

  it('loads existing returns including their note', () => {
    orderResponse = order([
      new OrderReturnDto({ id: 'ret-1', name: 'Sud 50 l', quantity: 4, note: 'Vadný ventil' }),
    ]);

    renderEditor();

    expect(nameInputs()[0].value).toBe('Sud 50 l');
    expect((within(returnsCard()).getByPlaceholderText('Poznámka (nepovinné)') as HTMLInputElement).value)
      .toBe('Vadný ventil');
  });

  it('removes a row', () => {
    orderResponse = order([
      new OrderReturnDto({ id: 'ret-1', name: 'Sud 50 l', quantity: 4 }),
      new OrderReturnDto({ id: 'ret-2', name: 'Přepravka', quantity: 2 }),
    ]);

    renderEditor();
    expect(nameInputs()).toHaveLength(2);

    fireEvent.click(within(returnsCard()).getAllByRole('button', { name: 'Odebrat vratku' })[0]);

    const remaining = nameInputs();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].value).toBe('Přepravka');
  });

  it('sends edited rows with their id and note, and drops blank rows', async () => {
    orderResponse = order([
      new OrderReturnDto({ id: 'ret-1', name: 'Sud 50 l', quantity: 4, note: 'Původní' }),
    ]);

    renderEditor();

    fireEvent.change(nameInputs()[0], { target: { value: 'Sud 30 l' } });
    fireEvent.change(within(returnsCard()).getByPlaceholderText('Poznámka (nepovinné)'), {
      target: { value: 'Upravená' },
    });

    // A scratch row the user never filled in must not reach the API.
    fireEvent.click(within(returnsCard()).getByRole('button', { name: 'Přidat' }));

    fireEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    const { returns } = updateMutate.mock.calls[0][0].data;
    expect(returns).toHaveLength(1);
    expect(returns[0].id).toBe('ret-1');
    expect(returns[0].name).toBe('Sud 30 l');
    expect(returns[0].note).toBe('Upravená');
  });

  it('sends a newly added row without an id', async () => {
    renderEditor();

    fireEvent.click(within(returnsCard()).getByRole('button', { name: 'Přidat' }));
    fireEvent.change(nameInputs()[0], { target: { value: 'Láhev 0,5 l' } });

    fireEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());

    const { returns } = updateMutate.mock.calls[0][0].data;
    expect(returns).toHaveLength(1);
    expect(returns[0].id).toBeUndefined();
    expect(returns[0].name).toBe('Láhev 0,5 l');
    expect(returns[0].quantity).toBe(1);
    // An empty note is omitted rather than sent as ''.
    expect(returns[0].note).toBeUndefined();
  });

  it('marks the form dirty when only a return changed', () => {
    orderResponse = order([new OrderReturnDto({ id: 'ret-1', name: 'Sud 50 l', quantity: 4 })]);

    renderEditor();

    // The unsaved-changes baseline covers returns, so editing one alone is enough
    // to enable the save button.
    const save = screen.getByRole('button', { name: /Uložit/i });
    fireEvent.change(nameInputs()[0], { target: { value: 'Sud 30 l' } });

    expect(save).not.toBeDisabled();
  });
});
