// Header and card composition of the order detail: which date the header shows
// at each stage, and which cards exist now that Klient and Doručení are gone.

import { render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { ClientInfoDto, OrderCustomExtraItemDto, OrderDeliveryAddressDto, OrderDto, OrderItemDto, OrderNoteDto, OrderReturnDto, OrderState } from 'src/generated/api-client';
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
    customExtraItems: [],
    ...over,
  });
}

function renderDetail(o: OrderDto, backLabel?: string) {
  return render(
    <MuiThemeProvider theme={theme}>
      <OrderDetail order={o} editable onBack={vi.fn()} backLabel={backLabel} onEdit={vi.fn()} onDelete={vi.fn()} />
    </MuiThemeProvider>,
  );
}

describe('OrderDetail — the back arrow', () => {
  it('goes back to the orders list by default', () => {
    renderDetail(order());

    expect(screen.getByRole('button', { name: 'Zpět na objednávky' })).toBeInTheDocument();
  });

  // An order opened from a vývoz's order overview returns there, so the arrow
  // has to say so — on a phone its label is the only cue for where Back leads.
  it('names the caller screen when one was passed', () => {
    renderDetail(order(), 'Zpět na vývoz');

    expect(screen.getByRole('button', { name: 'Zpět na vývoz' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zpět na objednávky' })).not.toBeInTheDocument();
  });
});

/** Titles of the page's cards, in DOM order. */
function cardTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.MuiCard-root'))
    .map((card) => card.querySelector('p, h6')?.textContent ?? '')
    .filter((t) => ['Položky', 'Vratky', 'Položky navíc', 'Poznámky', 'Doručení', 'Klient'].includes(t));
}

/** The two-column grid wrapping the items card and the sidebar. */
function grid(container: HTMLElement): HTMLElement {
  const itemsCard = Array.from(container.querySelectorAll('.MuiCard-root'))
    .find((c) => c.textContent?.startsWith('Položky'));
  return itemsCard!.parentElement as HTMLElement;
}

/** The emotion rules emitted for the grid, so the responsive column template
 *  (which happy-dom does not resolve) can still be asserted. */
function gridCss(container: HTMLElement): string {
  const cls = Array.from(grid(container).classList).find((c) => c.startsWith('css-'));
  if (!cls) return '';
  const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
  const at = css.indexOf(`.${cls}{`);
  return at === -1 ? '' : css.slice(at, at + 800);
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

    const header = screen.getByTestId('detail-header');
    expect(within(header).getByText(/Doručit nejpozději/)).toBeInTheDocument();
    expect(within(header).queryByText(/Vytvořeno/)).not.toBeInTheDocument();
    expect(within(header).getByText('31. 7. 2026')).toBeInTheDocument();
  });

  it('shows the actual delivery date once delivered, in place of the deadline', () => {
    renderDetail(order({
      state: OrderState.Finished,
      requiredDeliveryDate: new Date('2026-07-31T00:00:00Z'),
      actualDeliveryDate: new Date('2026-08-02T00:00:00Z'),
    }));

    const header = screen.getByTestId('detail-header');
    expect(within(header).getByText(/Doručeno/)).toBeInTheDocument();
    expect(within(header).getByText('2. 8. 2026')).toBeInTheDocument();
    expect(within(header).queryByText(/Doručit nejpozději/)).not.toBeInTheDocument();
    expect(within(header).queryByText('31. 7. 2026')).not.toBeInTheDocument();
  });

  it('falls back to the creation date when no term is set', () => {
    renderDetail(order({ requiredDeliveryDate: undefined }));

    const header = screen.getByTestId('detail-header');
    expect(within(header).getByText(/Vytvořeno/)).toBeInTheDocument();
    expect(within(header).queryByText(/Doručit nejpozději/)).not.toBeInTheDocument();
  });

  it('no longer renders the redundant Klient card', () => {
    const { container } = renderDetail(order());

    expect(cardTitles(container)).not.toContain('Klient');
    // The name is still on the page — in the header.
    expect(screen.getByText('Zitavsky klient')).toBeInTheDocument();
  });

  it('renders items, then vratky, extras and poznámky — and no Doručení card', () => {
    const { container } = renderDetail(order({
      returns: [new OrderReturnDto({ id: 'r1', name: 'Sud', quantity: 4 })],
      customExtraItems: [new OrderCustomExtraItemDto({ id: 'x1', description: 'Tácky', quantity: 100 })],
      notes: [new OrderNoteDto({ id: 'n1', text: 'Dovézt dopoledne' })],
    }));

    expect(cardTitles(container)).toEqual(['Položky', 'Vratky', 'Položky navíc', 'Poznámky']);
  });

  it('lists custom extras and hides the card when there are none', () => {
    renderDetail(order({ customExtraItems: [new OrderCustomExtraItemDto({ id: 'x1', description: 'Tácky', quantity: 100 })] }));
    expect(screen.getByText('Tácky')).toBeInTheDocument();
    expect(screen.getByText('100 ks')).toBeInTheDocument();

    const { container } = renderDetail(order({ customExtraItems: [] }));
    expect(cardTitles(container)).not.toContain('Položky navíc');
  });

  it('counts extras toward the sidebar, so the grid keeps two columns', () => {
    const { container } = renderDetail(order({
      customExtraItems: [new OrderCustomExtraItemDto({ id: 'x1', description: 'Tácky', quantity: 100 })],
    }));

    expect(gridCss(container)).toContain('1.5fr 1fr');
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

  it('drops the sidebar column entirely when it would be empty', () => {
    const { container } = renderDetail(order({ returns: [], notes: [] }));

    // Only the items card remains, it is the grid's sole child (no empty
    // sibling holding a column open), and the md two-column rule is gone so it
    // spans the full width instead of leaving dead space beside it.
    expect(cardTitles(container)).toEqual(['Položky']);
    expect(grid(container).children).toHaveLength(1);
    expect(gridCss(container)).not.toContain('1.5fr');
  });

  it('keeps the two-column grid as soon as one sidebar card has content', () => {
    const { container } = renderDetail(order({
      notes: [new OrderNoteDto({ id: 'n1', text: 'Dovézt dopoledne' })],
    }));

    expect(grid(container).children).toHaveLength(2);
    expect(gridCss(container)).toContain('1.5fr 1fr');
  });

  it('shows the billing address for the Official kind', () => {
    renderDetail(order({
      deliveryAddress: {
        kind: 'Official',
        address: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' },
      } as unknown as OrderDeliveryAddressDto,
    }));
    expect(screen.getByText(/Hlavní 1/)).toBeInTheDocument();
  });

  it('shows the place name and driver note for a delivery place', () => {
    renderDetail(order({
      deliveryAddress: {
        kind: 'DeliveryPlace',
        placeName: 'Letní zahrádka',
        placeNote: 'Vjezd zezadu',
        address: { latitude: 50.7, longitude: 15.05 },
      } as unknown as OrderDeliveryAddressDto,
    }));
    expect(screen.getByText('Letní zahrádka')).toBeInTheDocument();
    expect(screen.getByText('Vjezd zezadu')).toBeInTheDocument();
  });
});
