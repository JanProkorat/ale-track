// The orders list. Two clients are allowed to share a name, so a row that shows the name
// alone cannot say which of them an order belongs to — the trading name travels with it,
// and the client search matches it.

// fireEvent rather than user-event — not a dependency of this project.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { OrderListItemDto, OrderState } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

/** Two orders of two same-named clients, plus one whose client has no trading name. */
const orders = [
  new OrderListItemDto({
    id: 'ord-1', state: OrderState.New, clientId: 'cl-gastro',
    clientName: 'Hospoda Na Rohu', clientBusinessName: 'Na Rohu gastro s.r.o.',
  } as never),
  new OrderListItemDto({
    id: 'ord-2', state: OrderState.New, clientId: 'cl-family',
    clientName: 'Hospoda Na Rohu', clientBusinessName: 'Jan Vrána',
  } as never),
  new OrderListItemDto({
    id: 'ord-3', state: OrderState.New, clientId: 'cl-kapr', clientName: 'Pivnice U Kapra',
  } as never),
];

vi.mock('src/hooks/useOrders', () => ({
  useOrders: () => ({ data: orders, isPending: false, isError: false }),
  useOrder: () => ({ data: undefined, isPending: false, isError: false }),
  useDeleteOrder: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({ canEdit: () => true, canSee: () => true, can: () => true }),
}));

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const { OrdersPage } = await import('./OrdersPage');

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/orders']}>
      <MuiThemeProvider theme={theme}>
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
        </Routes>
      </MuiThemeProvider>
    </MemoryRouter>,
  );
}

describe('OrdersPage rows', () => {
  it('names the trading entity under the client', () => {
    renderList();

    // Both rows read "Hospoda Na Rohu"; only the second line separates them.
    expect(screen.getAllByText('Hospoda Na Rohu')).toHaveLength(2);
    expect(screen.getByText('Na Rohu gastro s.r.o.')).toBeInTheDocument();
    expect(screen.getByText('Jan Vrána')).toBeInTheDocument();
  });

  it('leaves the line off a client that has no trading name', () => {
    renderList();

    // No stray dash or blank line for the third row — it just shows the name.
    expect(screen.getByText('Pivnice U Kapra')).toBeInTheDocument();
  });

  it('narrows the list by trading name, not just by client name', async () => {
    renderList();

    fireEvent.change(screen.getByPlaceholderText(/Hledat/i), { target: { value: 'vrána' } });

    // SearchField debounces, so the filter has not run yet — asserting now would pass
    // whether or not the trading name is matched at all.
    await waitFor(() => expect(screen.getAllByText('Hospoda Na Rohu')).toHaveLength(1));
    expect(screen.getByText('Jan Vrána')).toBeInTheDocument();
    expect(screen.queryByText('Pivnice U Kapra')).not.toBeInTheDocument();
  });
});
