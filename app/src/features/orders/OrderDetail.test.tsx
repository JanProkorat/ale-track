// Header and card composition of the order detail: which date the header shows
// at each stage, and which cards exist now that Klient and Doručení are gone.

import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientLedgerEntryDto, ClientLedgerEntryTarget, ClientInfoDto, OrderCustomExtraItemDto, OrderDeliveryAddressDto, OrderDto, OrderItemDto, OrderNoteDto, OrderOutgoingShipmentDto, OrderReturnDto, OrderState, OrderSupplierGoodItemDto, OutgoingShipmentState, SupplierChargeKind } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/hooks/useReminders', () => ({
  useSetOrderItemReminderState: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number | null) => (v == null ? '—' : `${v} Kč`) }),
}));

// The ledger is a resource hook, so it is mocked rather than backed by a QueryClient — and the
// mock can express loading, error and no-data, because a mock that always answers happily
// cannot catch a crash on missing data.
const ledgerState: {
  data?: ClientLedgerEntryDto[];
  isLoading: boolean;
  isError: boolean;
} = { data: [], isLoading: false, isError: false };

// The recording drawer is mounted by the detail, so its mutation hooks are part of the same
// module and have to be mocked alongside the read.
vi.mock('src/hooks/useClientLedger', () => ({
  useClientLedger: () => ledgerState,
  useSaveClientLedgerEntries: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateClientLedgerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteClientLedgerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetClientLedgerEntryResolution: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useProducts', () => ({ useProducts: () => ({ data: [] }) }));

function setLedger(entries?: ClientLedgerEntryDto[], over: Partial<typeof ledgerState> = {}) {
  ledgerState.data = entries;
  ledgerState.isLoading = over.isLoading ?? false;
  ledgerState.isError = over.isError ?? false;
}

beforeEach(() => setLedger([]));

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

function shipment(over: Partial<OrderOutgoingShipmentDto> = {}): OrderOutgoingShipmentDto {
  return new OrderOutgoingShipmentDto({
    id: 'ship-0000-0000-0000-00002a',
    name: 'Severní trasa',
    state: OutgoingShipmentState.InTransit,
    deliveryDate: new Date('2026-08-12T00:00:00Z'),
    stopOrder: 3,
    stopCount: 7,
    vehicleName: '3A2 1234',
    driverNames: ['Jan Novák'],
    ...over,
  });
}

function renderDetail(o: OrderDto, backLabel?: string, onOpenShipment?: (id: string) => void) {
  return render(
    <MuiThemeProvider theme={theme}>
      <OrderDetail
        order={o}
        editable
        onBack={vi.fn()}
        backLabel={backLabel}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenShipment={onOpenShipment}
      />
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
    .filter((t) => ['Položky', 'Vratky', 'Položky navíc', 'Poznámky', 'Doručení', 'Klient', 'Vývoz'].includes(t));
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

  // The client-price mark is item-level: an order in progress can freely mix
  // lines a client price applies to with lines that still ride the ceník, and
  // once the whole order has been loaded onto a run every line drops the mark
  // regardless, because the snapshot never recorded that day's ceník price.
  it('shows the client-price mark on a still-composing line and drops it once loaded', () => {
    renderDetail(order({
      orderItems: [
        new OrderItemDto({
          id: 'item-1', orderId: 'o1', productId: 'p1', productName: 'Composing item',
          quantity: 2, unitPriceWithVat: 1190, listPriceWithVat: 1290,
        }),
        new OrderItemDto({
          id: 'item-2', orderId: 'o1', productId: 'p2', productName: 'Loaded item',
          quantity: 3, unitPriceWithVat: 980, listPriceWithVat: undefined,
        }),
      ],
    }));

    // Still composing: the client's price and the ceník price both render,
    // the ceník one struck through — and only one line has the mark at all,
    // which `getByTestId` (as opposed to `getAllByTestId`) already asserts.
    expect(screen.getByText('1190 Kč')).toBeInTheDocument();
    expect(screen.getByTestId('list-price')).toHaveTextContent('1290 Kč');

    // Loaded: the frozen unit price renders alone — no ceník price beside it,
    // because the order has no live ceník price to compare it against.
    expect(screen.getByText('980 Kč')).toBeInTheDocument();
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

  it('shows the shipment card and header chip when the order is on a vývoz', () => {
    const { container } = renderDetail(order({ outgoingShipment: shipment() }), undefined, vi.fn());

    expect(cardTitles(container)).toContain('Vývoz');
    expect(screen.getByText('Severní trasa')).toBeInTheDocument();
    expect(screen.getByText(/12\. 8\. 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Jan Novák · 3A2 1234/)).toBeInTheDocument();
    expect(screen.getByText('Zastávka 3 z 7')).toBeInTheDocument();
    // The chip repeats the run number in the header, where the rest of the
    // order's identity sits.
    const header = screen.getByTestId('detail-header');
    expect(within(header).getByText('Vývoz #00002A')).toBeInTheDocument();
  });

  it('opens the vývoz from both the card button and the header chip', () => {
    const onOpenShipment = vi.fn();
    renderDetail(order({ outgoingShipment: shipment() }), undefined, onOpenShipment);

    fireEvent.click(screen.getByRole('button', { name: 'Otevřít vývoz' }));
    fireEvent.click(within(screen.getByTestId('detail-header')).getByText('Vývoz #00002A'));

    expect(onOpenShipment).toHaveBeenCalledTimes(2);
    expect(onOpenShipment).toHaveBeenNthCalledWith(1, 'ship-0000-0000-0000-00002a');
    expect(onOpenShipment).toHaveBeenNthCalledWith(2, 'ship-0000-0000-0000-00002a');
  });

  it('says nothing about vývozy when the order is not planned onto one', () => {
    const { container } = renderDetail(order({ outgoingShipment: undefined }), undefined, vi.fn());

    expect(cardTitles(container)).not.toContain('Vývoz');
    expect(screen.queryByRole('button', { name: 'Otevřít vývoz' })).not.toBeInTheDocument();
  });

  // The page leaves the handler out for a user who cannot see the Vývozy
  // module, and that is what hides the link — not a separate flag.
  it('hides card and chip when the user may not open vývozy', () => {
    const { container } = renderDetail(order({ outgoingShipment: shipment() }));

    expect(cardTitles(container)).not.toContain('Vývoz');
    expect(screen.queryByText('Severní trasa')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('detail-header')).queryByText(/Vývoz #/)).not.toBeInTheDocument();
  });

  it('counts the shipment toward the sidebar, so the grid keeps two columns', () => {
    const { container } = renderDetail(order({ outgoingShipment: shipment() }), undefined, vi.fn());

    expect(gridCss(container)).toContain('1.5fr 1fr');
  });

  it('tolerates a run with no date and no crew assigned yet', () => {
    renderDetail(
      order({ outgoingShipment: shipment({ deliveryDate: undefined, driverNames: [], vehicleName: undefined }) }),
      undefined,
      vi.fn(),
    );

    expect(screen.getByText('termín neurčen')).toBeInTheDocument();
    expect(screen.getByText('Zastávka 3 z 7')).toBeInTheDocument();
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

// Supplier-good lines share the Polozky card with the beer, priced off the good's own
// list. They are the only order content the nakladka never shows, so the order detail
// is where they have to be visible.
describe('OrderDetail — supplier goods', () => {
  const goodLine = (over: Partial<OrderSupplierGoodItemDto> = {}) => new OrderSupplierGoodItemDto({
    id: 'line-1',
    supplierGoodId: 'g-co2',
    quantity: 2,
    goodName: 'CO₂ láhev',
    goodSize: '10 kg',
    supplierName: 'Linde Gas',
    unitPriceWithVat: 450,
    chargeKind: SupplierChargeKind.Fill,
    ...over,
  });

  function itemsCard(): HTMLElement {
    return screen.getByText('Položky').closest('.MuiCard-root') as HTMLElement;
  }

  it('lists a good beside the beer, with its supplier, size, charge kind and line total', () => {
    renderDetail(order({ supplierGoodItems: [goodLine()] }));

    const card = within(itemsCard());
    expect(card.getByText('CO₂ láhev')).toBeInTheDocument();
    expect(card.getByText('Svijanela Herbal Cola')).toBeInTheDocument();
    expect(card.getByText('Linde Gas · 10 kg · Plnění')).toBeInTheDocument();
    // 2 x 450, on the line and again on Celkem — the beer line here carries no price, so the
    // order's total is this one good.
    expect(card.getAllByText('900 Kč')).toHaveLength(2);
  });

  it('counts good lines in the card count alongside the products', () => {
    renderDetail(order({ supplierGoodItems: [goodLine(), goodLine({ id: 'line-2', supplierGoodId: 'g-n2', goodName: 'Dusík láhev' })] }));

    // one product + two goods
    expect(within(itemsCard()).getByText('3')).toBeInTheDocument();
  });

  it('renders an order that is nothing but supplier goods, without the empty-items message', () => {
    renderDetail(order({ orderItems: [], supplierGoodItems: [goodLine()] }));

    expect(within(itemsCard()).getByText('CO₂ láhev')).toBeInTheDocument();
    expect(screen.queryByText('Objednávka nemá žádné položky.')).not.toBeInTheDocument();
  });

  it('still reports an empty order when it has neither products nor goods', () => {
    renderDetail(order({ orderItems: [], supplierGoodItems: [] }));

    expect(screen.getByText('Objednávka nemá žádné položky.')).toBeInTheDocument();
  });

  it('shows a line note when the good carries one', () => {
    renderDetail(order({ supplierGoodItems: [goodLine({ note: 'Výměnou za prázdné' })] }));

    expect(within(itemsCard()).getByText('Výměnou za prázdné')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------
// The inline diff. The order stays the plan; what the ledger records is laid over it.
// ---------------------------------------------------------------------------------

describe('OrderDetail — deviations', () => {
  const ORDER_ID = '4cf0eb00-0000-0000-0000-000000000000';

  function ledgerEntry(over: Partial<ClientLedgerEntryDto> = {}): ClientLedgerEntryDto {
    return ClientLedgerEntryDto.fromJS({
      id: `entry-${Math.random()}`,
      orderId: ORDER_ID,
      target: ClientLedgerEntryTarget.ProductQuantity,
      requiresFollowUp: false,
      createdAt: '2026-08-24T10:00:00Z',
      ...over,
    });
  }

  function itemsCard(): HTMLElement {
    return screen.getByText('Položky').closest('.MuiCard-root') as HTMLElement;
  }

  it('strikes the planned quantity through and highlights what arrived', () => {
    setLedger([ledgerEntry({ orderItemId: 'item-1', plannedQuantity: 1, actualQuantity: 0 })]);
    renderDetail(order());

    const card = within(itemsCard());
    expect(card.getByText('Nevyloženo')).toBeInTheDocument();
    expect(card.getByText('1 ks')).toBeInTheDocument();
    expect(card.getByText('0 ks')).toBeInTheDocument();
  });

  // Colour cannot be the only signal: a colour-blind reader and a printed copy get the words.
  it('words every changed row, not just colours it', () => {
    setLedger([ledgerEntry({ orderItemId: 'item-1', plannedQuantity: 10, actualQuantity: 7 })]);
    renderDetail(order({
      orderItems: [new OrderItemDto({ id: 'item-1', orderId: 'o1', productId: 'p1', productName: 'Ležák', quantity: 10 })],
    }));

    expect(within(itemsCard()).getByText('Nevyloženo 3 ks')).toBeInTheDocument();
  });

  it('appends a product the client took at the door', () => {
    setLedger([ledgerEntry({
      productId: 'p9',
      productName: 'Světlé 10',
      plannedQuantity: 0,
      actualQuantity: 4,
    })]);
    renderDetail(order());

    const card = within(itemsCard());
    expect(card.getByText('Světlé 10')).toBeInTheDocument();
    expect(card.getByText('Přidáno na místě')).toBeInTheDocument();
  });

  it('shows a return handed over against an order that planned none', () => {
    setLedger([ledgerEntry({
      target: ClientLedgerEntryTarget.ReturnQuantity,
      lineName: 'Basy prázdných',
      plannedQuantity: 0,
      actualQuantity: 4,
    })]);
    renderDetail(order());

    const card = within(screen.getByText('Vratky').closest('.MuiCard-root') as HTMLElement);
    expect(card.getByText('Basy prázdných')).toBeInTheDocument();
    expect(card.getByText('Vráceno navíc')).toBeInTheDocument();
  });

  it('totals what was delivered, with the plan struck through beside it', () => {
    setLedger([ledgerEntry({ orderItemId: 'item-1', plannedQuantity: 10, actualQuantity: 7 })]);
    renderDetail(order({
      orderItems: [new OrderItemDto({
        id: 'item-1', orderId: 'o1', productId: 'p1', productName: 'Ležák', quantity: 10, unitPriceWithVat: 100,
      })],
    }));

    const card = within(itemsCard());
    expect(card.getByText('Celkem')).toBeInTheDocument();
    expect(card.getByText('1000 Kč')).toBeInTheDocument();
    expect(card.getAllByText('700 Kč').length).toBeGreaterThan(0);
  });

  it('shows one total when nothing deviated', () => {
    renderDetail(order({
      orderItems: [new OrderItemDto({
        id: 'item-1', orderId: 'o1', productId: 'p1', productName: 'Ležák', quantity: 10, unitPriceWithVat: 100,
      })],
    }));

    expect(within(itemsCard()).queryByText('Nevyloženo')).not.toBeInTheDocument();
    expect(within(itemsCard()).getAllByText('1000 Kč')).toHaveLength(2);
  });

  it('diffs the delivery address where it went, not in a second banner', () => {
    setLedger([ledgerEntry({
      target: ClientLedgerEntryTarget.DeliveryAddress,
      plannedText: 'Dlouhá 1, 46001 Liberec',
      actualText: 'Krátká 2, 46002 Liberec',
    })]);
    renderDetail(order());

    expect(screen.getByText('Dlouhá 1, 46001 Liberec')).toBeInTheDocument();
    expect(screen.getByText('Krátká 2, 46002 Liberec')).toBeInTheDocument();
  });

  // Money and a bare note are the only deviations with no row of their own, so they are the
  // only thing the card holds — and an order without them must not grow an empty card.
  it('shows money and notes in their own card', () => {
    setLedger([
      ledgerEntry({ target: ClientLedgerEntryTarget.Money, amount: 2400, requiresFollowUp: true }),
    ]);
    renderDetail(order());

    const card = within(screen.getByText('Peníze a poznámky').closest('.MuiCard-root') as HTMLElement);
    expect(card.getByText('Klient dluží')).toBeInTheDocument();
    expect(card.getByText('2400 Kč')).toBeInTheDocument();
  });

  it('has no money card on an order whose deviations are all quantities', () => {
    setLedger([ledgerEntry({ orderItemId: 'item-1', plannedQuantity: 1, actualQuantity: 0 })]);
    renderDetail(order());

    expect(screen.queryByText('Peníze a poznámky')).not.toBeInTheDocument();
  });

  it('leaves the rows alone while the ledger is still loading', () => {
    setLedger(undefined, { isLoading: true });
    renderDetail(order());

    expect(within(itemsCard()).getByText('1 ks')).toBeInTheDocument();
    expect(within(itemsCard()).queryByText('Nevyloženo')).not.toBeInTheDocument();
  });

  it('renders the plan when the ledger cannot be read', () => {
    setLedger(undefined, { isError: true });
    renderDetail(order());

    expect(within(itemsCard()).getByText('Svijanela Herbal Cola')).toBeInTheDocument();
  });

  // Settling the debt is a different question from what came off the van. Filtering the display
  // by resolution would put the plan back on screen the moment somebody closed the entry.
  it('keeps showing a settled deviation', () => {
    setLedger([ledgerEntry({
      orderItemId: 'item-1',
      plannedQuantity: 1,
      actualQuantity: 0,
      resolvedAt: new Date('2026-08-26T09:00:00Z'),
    })]);
    renderDetail(order());

    expect(within(itemsCard()).getByText('Nevyloženo')).toBeInTheDocument();
  });

  it('ignores deviations recorded against another order', () => {
    setLedger([ledgerEntry({
      orderId: 'some-other-order',
      orderItemId: 'item-1',
      plannedQuantity: 1,
      actualQuantity: 0,
    })]);
    renderDetail(order());

    expect(within(itemsCard()).queryByText('Nevyloženo')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------
// Recording is opened by finished paperwork, not by the order's state.
//
// State said "the van has left", which is a different question: at Naloženo the papers need not
// be done, and this screen would then offer Upravit — editing the plan — under finished paperwork
// while the run's Vykládka already offered recording.
// ---------------------------------------------------------------------------------

describe('OrderDetail — when a change can be recorded', () => {
  function renderWithLedgerRights(o: OrderDto) {
    return render(
      <MuiThemeProvider theme={theme}>
        <OrderDetail
          order={o}
          editable
          canRecordDeviation
          onBack={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </MuiThemeProvider>,
    );
  }

  const record = () => screen.queryByRole('button', { name: 'Zaznamenat změnu' });

  it('offers it once the invoice row is finished', () => {
    renderWithLedgerRights(order({ isInvoiceReady: true }));

    expect(record()).toBeInTheDocument();
  });

  // Short on the face, full phrase as the accessible name: "Změna" beside "Upravit" is terse
  // enough that a screen reader should still hear the verb.
  it('reads just "Změna" while still announcing the whole action', () => {
    renderWithLedgerRights(order({ isInvoiceReady: true }));

    const button = record()!;
    expect(button).toHaveTextContent('Změna');
    expect(button).not.toHaveTextContent('Zaznamenat');
    expect(button).toHaveAccessibleName('Zaznamenat změnu');
  });

  it('does not offer it while the paperwork is unfinished', () => {
    renderWithLedgerRights(order({ isInvoiceReady: false }));

    expect(record()).not.toBeInTheDocument();
  });

  // The window that made the old rule wrong: papers done, order still only planned.
  it('offers it on a planned order whose row is already finished', () => {
    renderWithLedgerRights(order({ state: OrderState.Planning, isInvoiceReady: true }));

    expect(record()).toBeInTheDocument();
  });

  // And its mirror: delivered, but nobody has closed the row yet.
  it('withholds it on a delivered order whose row is unfinished', () => {
    renderWithLedgerRights(order({ state: OrderState.Finished, isInvoiceReady: false }));

    expect(record()).not.toBeInTheDocument();
  });

  it('never offers it to a user who may not write a client\'s ledger', () => {
    render(
      <MuiThemeProvider theme={theme}>
        <OrderDetail
          order={order({ isInvoiceReady: true })}
          editable
          onBack={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </MuiThemeProvider>,
    );

    expect(record()).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------
// The chip that explains the record button. It sits in the Vývoz card beside the run's own
// state: where the goods are, and whether the paper is closed.
// ---------------------------------------------------------------------------------

describe('OrderDetail — the finished-invoice chip', () => {
  const onRun = (isInvoiceReady: boolean) =>
    order({ outgoingShipment: shipment(), isInvoiceReady });

  /** The Vývoz card, which is where the chip belongs. */
  const shipmentCard = () =>
    within(screen.getByText('Vývoz').closest('.MuiCard-root') as HTMLElement);

  it('sits in the Vývoz card, beside the run\'s state', () => {
    renderDetail(onRun(true), undefined, vi.fn());

    const card = shipmentCard();
    expect(card.getByText('Faktura hotová')).toBeInTheDocument();
    // The run's own state pill is its neighbour.
    expect(card.getByText('Na cestě')).toBeInTheDocument();
  });

  it('says nothing while the paperwork is unfinished', () => {
    renderDetail(onRun(false), undefined, vi.fn());

    expect(screen.queryByText('Faktura hotová')).not.toBeInTheDocument();
  });

  // The state of the paperwork is worth knowing whether or not this user may record anything.
  it('shows it to a user who cannot record', () => {
    renderDetail(onRun(true), undefined, vi.fn());

    expect(screen.getByText('Faktura hotová')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zaznamenat změnu' })).not.toBeInTheDocument();
  });

  it('shows it beside the button for a user who can', () => {
    render(
      <MuiThemeProvider theme={theme}>
        <OrderDetail
          order={onRun(true)}
          editable
          canRecordDeviation
          onBack={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onOpenShipment={vi.fn()}
        />
      </MuiThemeProvider>,
    );

    expect(screen.getByText('Faktura hotová')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zaznamenat změnu' })).toBeInTheDocument();
  });
});
