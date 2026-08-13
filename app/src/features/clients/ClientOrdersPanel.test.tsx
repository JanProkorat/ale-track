// What only ClientOrdersPanel decides: that the client's orders come out
// newest-created first, that an empty result reads as an empty state rather
// than an empty table, and that a row opens the order detail carrying the way
// back to this client. The query mock can express loading and failure too — a
// mock that only ever hands back a happy response cannot catch a crash on a
// missing one.

import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import { OrderListItemDto, OrderState, PlanningState } from 'src/generated/api-client';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const refetch = vi.fn();
let queryState: { data: OrderListItemDto[] | undefined; isLoading: boolean; isError: boolean; error?: unknown } =
  { data: [], isLoading: false, isError: false };

vi.mock('src/hooks/useOrders', () => ({
  useClientOrders: () => ({ ...queryState, refetch }),
}));

const { ClientOrdersPanel } = await import('./ClientOrdersPanel');

function order(id: string, createdDate: Date | undefined, over: Partial<OrderListItemDto> = {}): OrderListItemDto {
  return new OrderListItemDto({
    id,
    state: OrderState.New,
    createdDate: createdDate as Date,
    clientId: 'client-1',
    clientName: 'Hospoda U Netopýra',
    planningState: PlanningState.Active,
    ...over,
  });
}

function renderPanel() {
  return render(
    <MuiThemeProvider theme={theme}>
      <ClientOrdersPanel clientId="client-1" />
    </MuiThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  queryState = { data: [], isLoading: false, isError: false };
});

describe('ClientOrdersPanel', () => {
  it('lists the orders newest-created first', () => {
    queryState = {
      data: [
        order('11111111-1111-1111-1111-111111111111', new Date('2026-07-15T08:00:00Z')),
        order('22222222-2222-2222-2222-222222222222', new Date('2026-08-01T08:00:00Z')),
        order('33333333-3333-3333-3333-333333333333', new Date('2026-06-01T08:00:00Z')),
      ],
      isLoading: false,
      isError: false,
    };
    renderPanel();

    const dates = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    expect(dates[0]).toContain('1. 8. 2026');
    expect(dates[1]).toContain('15. 7. 2026');
    expect(dates[2]).toContain('1. 6. 2026');
  });

  it('shows the empty state instead of a table when the client has no orders', () => {
    renderPanel();

    expect(screen.getByText('Žádné objednávky')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('opens a clicked order with the way back to this client, on this tab', () => {
    queryState = {
      data: [order('11111111-1111-1111-1111-111111111111', new Date('2026-07-15T08:00:00Z'))],
      isLoading: false,
      isError: false,
    };
    renderPanel();

    fireEvent.click(screen.getAllByRole('row')[1]);

    expect(navigate).toHaveBeenCalledWith('/orders/11111111-1111-1111-1111-111111111111', {
      state: { backTo: '/clients/client-1?tab=orders', backLabel: 'Zpět na klienta' },
    });
  });

  it('surfaces a failed load instead of rendering an empty table', () => {
    queryState = { data: undefined, isLoading: false, isError: true, error: new Error('boom') };
    renderPanel();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
