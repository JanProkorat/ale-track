// Header and card composition of the order detail. The responsive ordering
// itself is CSS (`display: contents` + `order`) and cannot be asserted in
// happy-dom; what is checked here is the DOM these rules operate on, plus the
// header content that replaced the removed Klient card.

import { render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { ClientInfoDto, OrderDto, OrderItemDto, OrderReturnDto, OrderState } from 'src/generated/api-client';
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

/** Card elements in DOM order — the order the CSS `order` rules rearrange. */
function cardTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.MuiCard-root'))
    .map((card) => card.querySelector('p, h6')?.textContent ?? '')
    .filter((t) => ['Položky', 'Vratky', 'Doručení', 'Klient'].includes(t));
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

  it('keeps items before the sidebar cards in the DOM', () => {
    const { container } = renderDetail(order({
      returns: [new OrderReturnDto({ id: 'r1', name: 'Sud', quantity: 4 })],
    }));

    expect(cardTitles(container)).toEqual(['Položky', 'Vratky', 'Doručení']);
  });
});
