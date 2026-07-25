// Header and card composition of the order detail: which date the header shows
// at each stage, and which cards exist now that Klient and Doručení are gone.

import { render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { ClientInfoDto, OrderDto, OrderItemDto, OrderNoteDto, OrderReturnDto, OrderState } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/hooks/useReminders', () => ({
  useSetOrderItemReminderState: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { OrderDetail } = await import('./OrderDetail');

function order(over: Partial<OrderDto> = {}): OrderDto {
  return new OrderDto({
    id: '4cf0eb00-0000-0000-0000-000000000000',
    client: new ClientInfoDto({ id: 'client-a', name: 'Zitavsky klient' }),
    state: OrderState.New,
    createdDate: new Date('2025-10-04T00:00:00Z'),
    orderItems: [
      new OrderItemDto({ id: 'item-1', orderId: 'o1', productId: 'p1', productName: 'Svijanela Herbal Cola', quantity: 1 }),
    ],
    returns: [],
    notes: [],
    ...over,
  });
}

function renderDetail(o: OrderDto) {
  return render(
    <MuiThemeProvider theme={theme}>
      <OrderDetail order={o} editable onBack={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />
    </MuiThemeProvider>,
  );
}

/** Titles of the page's cards, in DOM order. */
function cardTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.MuiCard-root'))
    .map((card) => card.querySelector('p, h6')?.textContent ?? '')
    .filter((t) => ['Položky', 'Vratky', 'Poznámky', 'Doručení', 'Klient'].includes(t));
}

describe('OrderDetail', () => {
  it('puts the client name on the order-number line', () => {
    renderDetail(order());

    const heading = screen.getByRole('heading', { level: 1 });
    // Same flex row, so they share a parent.
    expect(within(heading.parentElement!).getByText('Zitavsky klient')).toBeInTheDocument();
  });

  it('shows the deadline instead of the creation date', () => {
    renderDetail(order({ requiredDeliveryDate: new Date('2026-07-31T00:00:00Z') }));

    const header = screen.getByRole('heading', { level: 1 }).closest('div')!.parentElement!;
    expect(within(header).getByText(/Doručit nejpozději:/)).toBeInTheDocument();
    expect(within(header).queryByText(/Vytvořeno:/)).not.toBeInTheDocument();
    expect(within(header).getByText('31. 7. 2026')).toBeInTheDocument();
  });

  it('shows the actual delivery date once delivered, in place of the deadline', () => {
    renderDetail(order({
      state: OrderState.Finished,
      requiredDeliveryDate: new Date('2026-07-31T00:00:00Z'),
      actualDeliveryDate: new Date('2026-08-02T00:00:00Z'),
    }));

    const header = screen.getByRole('heading', { level: 1 }).closest('div')!.parentElement!;
    expect(within(header).getByText(/Doručeno:/)).toBeInTheDocument();
    expect(within(header).getByText('2. 8. 2026')).toBeInTheDocument();
    expect(within(header).queryByText(/Doručit nejpozději:/)).not.toBeInTheDocument();
    expect(within(header).queryByText('31. 7. 2026')).not.toBeInTheDocument();
  });

  it('falls back to the creation date when no term is set', () => {
    renderDetail(order({ requiredDeliveryDate: undefined }));

    const header = screen.getByRole('heading', { level: 1 }).closest('div')!.parentElement!;
    expect(within(header).getByText(/Vytvořeno:/)).toBeInTheDocument();
    expect(within(header).queryByText(/Doručit nejpozději:/)).not.toBeInTheDocument();
  });

  it('no longer renders the redundant Klient card', () => {
    const { container } = renderDetail(order());

    expect(cardTitles(container)).not.toContain('Klient');
    // The name is still on the page — in the header.
    expect(screen.getByText('Zitavsky klient')).toBeInTheDocument();
  });

  it('renders items, then vratky, then poznámky — and no Doručení card', () => {
    const { container } = renderDetail(order({
      returns: [new OrderReturnDto({ id: 'r1', name: 'Sud', quantity: 4 })],
      notes: [new OrderNoteDto({ id: 'n1', text: 'Dovézt dopoledne' })],
    }));

    expect(cardTitles(container)).toEqual(['Položky', 'Vratky', 'Poznámky']);
  });

  it('lists every note, keeping line breaks', () => {
    renderDetail(order({
      notes: [
        new OrderNoteDto({ id: 'n1', text: 'Dovézt dopoledne' }),
        new OrderNoteDto({ id: 'n2', text: 'Volat na vrátnici' }),
      ],
    }));

    expect(screen.getByText('Dovézt dopoledne')).toBeInTheDocument();
    expect(screen.getByText('Volat na vrátnici')).toBeInTheDocument();
    expect(screen.getByText('Dovézt dopoledne')).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('hides the Poznámky card when the order has none', () => {
    const { container } = renderDetail(order({ notes: [] }));

    expect(cardTitles(container)).not.toContain('Poznámky');
  });
});
