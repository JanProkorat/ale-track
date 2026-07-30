// What ShipmentDetail decides about the stop header on "Přehled objednávek":
// a stop delivering to a client's saved place shows a small chip with the
// place name and its formatted address below (never repeating the name); any
// other stop keeps the plain `address · kind` line unchanged. The pure
// resolution behind both is covered directly in stopAddress.test.ts.

import { render, screen, within, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AddressDto,
  ClientDeliveryPlaceDto,
  Country,
  OutgoingShipmentDetailDto,
  OutgoingShipmentOrderItemDto,
  OutgoingShipmentState,
  DeliveryAddressKind,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
  ProductKind,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

// Pulls in react-leaflet, which doesn't run under happy-dom — same stub used
// by ShipmentEditor.test.tsx. Captures the `stops` prop (rather than just
// rendering an empty div) so the route-map fix in step 2 — a DeliveryPlace
// stop must pin at the place, not the billing address — has a test that can
// actually catch a regression on it.
const routeMapProps = vi.fn();
vi.mock('src/components/common/RouteMap', () => ({
  RouteMap: (props: { stops: { lat?: number; lng?: number; label: string }[] }) => {
    routeMapProps(props);
    return <div data-testid="route-map-stub" />;
  },
}));

vi.mock('src/hooks/useShipments', () => ({
  useUpdateShipment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAcknowledgeAddressChanges: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // Ticking a preparation step is a mutation the screen only fires on click; the checklist card
  // has its own tests (PreparationStepsCard.test.tsx).
  useSetPreparationStep: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useVehicles', () => ({ useVehicle: () => ({ data: undefined, isLoading: false }) }));
vi.mock('src/hooks/useDrivers', () => ({ useDrivers: () => ({ data: [], isLoading: false }) }));
vi.mock('src/hooks/useInventory', () => ({ useInventory: () => ({ data: [], isLoading: false }) }));
// The nakládka's brewery-invoice columns: the product catalogue feeds the
// "Zboží na sklad" picker, and the split/loading writes are mutations the
// screen only calls on click. Mocked for the same reason as the rest — this
// file is about stop headers and route points, not about a QueryClient.
vi.mock('src/hooks/useProducts', () => ({ useProducts: () => ({ data: [], isLoading: false }) }));
// Hoisted rather than a fresh `vi.fn()` per call: the stacked-layout tests below
// assert that ticking a product off commits, which needs a spy that survives
// across the re-renders the hook factory would otherwise hand a new one to.
const setLoadingStateMutate = vi.hoisted(() => vi.fn());
vi.mock('src/hooks/usePurchaseInvoices', () => ({
  useAddPurchaseInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePurchaseInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useSetPurchaseInvoiceLine: () => ({ mutate: vi.fn(), isPending: false }),
  useSetLoadingState: () => ({ mutate: setLoadingStateMutate, isPending: false }),
}));

// ShipmentInvoicing renders unconditionally at the bottom of the detail
// screen; give it just enough to not crash without pulling in a QueryClient
// or <CurrencyProvider> (same pattern as ShipmentInvoicing.test.tsx).
vi.mock('src/hooks/useShipmentInvoices', () => ({
  useShipmentInvoices: () => ({ data: undefined, isLoading: false, isError: false }),
  useMoveInvoiceLine: () => ({ mutate: vi.fn(), isPending: false }),
  useAddShipmentInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteShipmentInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => (czk == null ? '—' : `${czk} Kč`) }),
}));

const { ShipmentDetail } = await import('./ShipmentDetail');

function officialAddress(): AddressDto {
  return new AddressDto({ streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', country: Country.Czechia, latitude: 50.897, longitude: 14.808 });
}

// The backend serializes enums as strings on the wire (JsonStringEnumConverter,
// Program.cs), so `selectedAddressKind` really arrives as "DeliveryPlace"/
// "Contact", not the generated client's numeric enum members. Using the string
// form here — rather than `DeliveryAddressKind.DeliveryPlace` —
// is what makes this fixture actually exercise the real API shape; a direct
// `===` against the numeric member (the regression this whole suite guards)
// would silently fall through to the official-address branch instead.
function placeStop(): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-1',
    kind: OutgoingShipmentStopKind.Order,
    order: 1,
    clientId: 'client-a',
    clientName: 'Hospoda U Netopýra',
    orderId: 'order-1',
    officialAddress: officialAddress(),
    selectedAddressKind: 'DeliveryPlace' as unknown as DeliveryAddressKind,
    deliveryPlace: new ClientDeliveryPlaceDto({
      id: 'place-a',
      name: 'Letní zahrádka',
      address: new AddressDto({ streetName: 'Nábřežní', streetNumber: '3', city: 'Žitava', zip: '02763', country: Country.Czechia, latitude: 50.9, longitude: 14.8 }),
    }),
    products: [],
    returns: [],
  });
}

function officialStop(): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-2',
    kind: OutgoingShipmentStopKind.Order,
    order: 1,
    clientId: 'client-b',
    clientName: 'Restaurace B',
    orderId: 'order-2',
    officialAddress: officialAddress(),
    selectedAddressKind: DeliveryAddressKind.Official,
    products: [],
    returns: [],
  });
}

function contactStop(): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-3',
    kind: OutgoingShipmentStopKind.Order,
    order: 1,
    clientId: 'client-c',
    clientName: 'Restaurace C',
    orderId: 'order-3',
    officialAddress: officialAddress(),
    contactAddress: new AddressDto({ streetName: 'Dvůr', streetNumber: '2a', city: 'Žitava', zip: '02763', country: Country.Czechia, latitude: 50.88, longitude: 14.81 }),
    // String wire form (see comment on placeStop) — this is the fixture that
    // guards the Contact regression: the branch this review's fix replaced
    // used `addrKindName(...) === 'Contact'` (normalized correctly); the code
    // it replaced compared the raw enum directly, which never matched real
    // API data and fell through to the official address instead.
    selectedAddressKind: 'Contact' as unknown as DeliveryAddressKind,
    products: [],
    returns: [],
  });
}

function renderDetail(stops: OutgoingShipmentStopDto[]) {
  const shipment = new OutgoingShipmentDetailDto({
    id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Created, driverIds: [], stops,
  });
  return render(
    <MuiThemeProvider theme={theme}>
      <ShipmentDetail shipment={shipment} editable={false} onBack={vi.fn()} onEdit={vi.fn()} />
    </MuiThemeProvider>,
  );
}

function renderEditableDetail(state: OutgoingShipmentState) {
  const shipment = new OutgoingShipmentDetailDto({
    id: 'ship-1', name: 'Rozvoz Žitava', state, driverIds: [], stops: [officialStop()],
  });
  return render(
    <MuiThemeProvider theme={theme}>
      <ShipmentDetail shipment={shipment} editable onBack={vi.fn()} onEdit={vi.fn()} />
    </MuiThemeProvider>,
  );
}

describe('ShipmentDetail — lifecycle affordances', () => {
  // Delivered is terminal server-side: reverting out of it re-ran the order transitions
  // and freed already-delivered orders back to New, unwinding an invoiced, reported run.
  // Offering the button would only produce a 400.
  it('offers no revert on a delivered shipment', () => {
    renderEditableDetail(OutgoingShipmentState.Delivered);

    expect(screen.queryByRole('button', { name: 'Vrátit' })).not.toBeInTheDocument();
  });

  it('still offers a revert on a shipment in transit', () => {
    renderEditableDetail(OutgoingShipmentState.InTransit);

    expect(screen.getByRole('button', { name: 'Vrátit' })).toBeInTheDocument();
  });
});

describe('ShipmentDetail — stop header on Přehled objednávek', () => {
  it('shows the place chip and its formatted address for a DeliveryPlace stop', () => {
    renderDetail([placeStop()]);

    const row = screen.getByText('Hospoda U Netopýra').closest('button') as HTMLElement;
    expect(within(row).getByText('Letní zahrádka')).toBeInTheDocument();
    expect(within(row).getByText('Nábřežní 3, 02763 Žitava')).toBeInTheDocument();
    // The address line must not repeat the place name — formatPlaceAddress
    // only ever formats the address part, the chip already carries the name.
    expect(within(row).queryByText(/Letní zahrádka ·/)).not.toBeInTheDocument();
  });

  it('keeps the plain address · kind line, and no chip, for a stop on the official address', () => {
    renderDetail([officialStop()]);

    const row = screen.getByText('Restaurace B').closest('button') as HTMLElement;
    expect(within(row).getByText('Náměstí 14, 02763 Žitava · Fakturační')).toBeInTheDocument();
    expect(within(row).queryByText('Letní zahrádka')).not.toBeInTheDocument();
  });

  // Regression guard: the branch this review's fix replaced compared
  // `selectedAddressKind` directly against the numeric Contact member, which
  // never matches the server's string wire form and fell through to the
  // official address instead — pinning and displaying the wrong stop.
  it('shows the contact address · kind line, and no place chip, for a Contact stop', () => {
    renderDetail([contactStop()]);

    const row = screen.getByText('Restaurace C').closest('button') as HTMLElement;
    expect(within(row).getByText('Dvůr 2a, 02763 Žitava · Kontaktní')).toBeInTheDocument();
    expect(within(row).queryByText('Letní zahrádka')).not.toBeInTheDocument();
  });
});

describe('ShipmentDetail — route map point resolution', () => {
  it('pins a DeliveryPlace stop at the place, not the client\'s official address', () => {
    renderDetail([placeStop()]);

    expect(routeMapProps).toHaveBeenCalled();
    const { stops } = routeMapProps.mock.calls.at(-1)![0];
    expect(stops).toHaveLength(1);
    // The place's own coordinates (50.9, 14.8), not the official address's (50.897, 14.808).
    expect(stops[0].lat).toBe(50.9);
    expect(stops[0].lng).toBe(14.8);
  });
});

describe('ShipmentDetail — address-changed banner position', () => {
  // Regression guard: the banner used to sit at the bottom of the right
  // column, four cards below the map (Vůz/Řidiči, then two GarageCards) —
  // a warning nobody would scroll down to see. It must now render directly
  // under the map, before any of those cards, matching ShipmentEditor.tsx.
  it('renders directly under the map rather than below the vehicle/garage cards', () => {
    const stop = officialStop();
    stop.addressChangedAt = new Date('2026-07-27T09:00:00Z');
    stop.isAddressOverridden = false;
    renderDetail([stop]);

    const mapStub = screen.getByTestId('route-map-stub');
    const banner = screen.getByText('Změna adresy doručení');
    const vehicleHeading = screen.getByText('Vůz');

    // DOCUMENT_POSITION_FOLLOWING (4): the second node comes after the first.
    expect(mapStub.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner.compareDocumentPosition(vehicleHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds no stray gap under the map when there is nothing to announce', () => {
    renderDetail([officialStop()]);
    expect(screen.queryByText('Změna adresy doručení')).not.toBeInTheDocument();
  });
});

// When the card is too narrow for its columns the nakládka drops the table and
// stacks, because reaching the loading control meant scrolling sideways — the one
// interaction the brewery ramp has no free hand for. What the swap must preserve:
// the ramp's own control stays reachable without expanding anything, and the desk
// controls stay reachable at all.
describe('ShipmentDetail — nakládka when the columns do not fit', () => {
  /** MUI's useMediaQuery reads window.matchMedia; happy-dom resolves it against a
   * 1024px window, so force the answer rather than depend on that default. */
  function setCompact(compact: boolean) {
    window.matchMedia = ((query: string) => ({
      matches: compact && query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  /** happy-dom ships no ResizeObserver, so the card measures 0 (= "not known") and
   * the layout falls back to the media query. Stubbing one lets a test say how much
   * room the card actually got, which is the signal the tablet case turns on. */
  function setCardWidth(width: number) {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback(
          [{ contentRect: { width } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    });
  }

  const originalMatchMedia = window.matchMedia;
  beforeEach(() => setLoadingStateMutate.mockClear());
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.unstubAllGlobals();
  });

  function stopWithProduct(): OutgoingShipmentStopDto {
    const stop = officialStop();
    stop.products = [new OutgoingShipmentOrderItemDto({
      id: 'product-1',
      orderItemId: 'item-1',
      name: 'Roh. Cherry beer',
      kind: ProductKind.Bottle,
      packageSize: 0.5,
      platoDegree: 10,
      quantity: 3,
      weight: 12,
      quantityFromInventory: 0,
    })];
    return stop;
  }

  function renderNakladka() {
    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Created,
      driverIds: [], stops: [stopWithProduct()],
    });
    return render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );
  }

  it('stacks the loading list instead of rendering the table', () => {
    setCompact(true);
    renderNakladka();

    expect(screen.getByText('Roh. Cherry beer')).toBeInTheDocument();
    expect(screen.getAllByText('3 ks').length).toBeGreaterThan(0);
    // The Množství column header is table-only; its absence is what proves the swap.
    expect(screen.queryByText('Množství')).not.toBeInTheDocument();
  });

  it('shows every control without an expander, so nothing costs a tap to reach', () => {
    setCompact(true);
    renderNakladka();

    // No expander at all: an earlier revision hid the numbers below behind one, and
    // a list that is worked through rather than skimmed pays that tap on every item.
    expect(screen.queryByLabelText('Rozbalit Roh. Cherry beer')).not.toBeInTheDocument();

    // Scoped to the row — "F1" is also the filter tab and the summary bar's label.
    const row = within(screen.getByTestId('nakladka-row'));
    expect(row.getByLabelText('Přidat kus z garáže')).toBeInTheDocument();
    expect(row.getByLabelText('Přidat kus na fakturu 2')).toBeInTheDocument();
    expect(row.getByText('F1')).toBeInTheDocument();
    expect(row.getByText('Z pivovaru')).toBeInTheDocument();
  });

  it('commits a loading state straight off the row', () => {
    setCompact(true);
    renderNakladka();

    fireEvent.click(screen.getByLabelText('Nakládka na faktuře 1: Nenaloženo'));

    expect(setLoadingStateMutate).toHaveBeenCalledTimes(1);
    expect(setLoadingStateMutate.mock.calls[0][0]).toMatchObject({
      productId: 'product-1', sequence: 1, state: 'Dictated',
    });
  });

  it('still renders the table above the breakpoint', () => {
    setCompact(false);
    renderNakladka();

    expect(screen.getByText('Množství')).toBeInTheDocument();
    // The table's own split control is a typable field, not the phone's stepper pair.
    expect(screen.getByLabelText('Kusy na faktuře 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Přidat kus na fakturu 2')).not.toBeInTheDocument();
  });

  // The tablet case, and the reason the swap is measured rather than a breakpoint:
  // from `md` up the detail screen splits into 1.5fr/1.2fr, so a wide viewport can
  // still hand the nakládka a card too narrow for its columns. A media query calls
  // that viewport "desktop" and leaves the table scrolling sideways.
  it('stacks when the card is squeezed, however wide the viewport says it is', () => {
    setCompact(false);
    setCardWidth(420);
    renderNakladka();

    expect(screen.queryByText('Množství')).not.toBeInTheDocument();
    expect(screen.getByTestId('nakladka-row')).toBeInTheDocument();
  });

  it('keeps the table when the card has room for the columns', () => {
    setCompact(false);
    setCardWidth(900);
    renderNakladka();

    expect(screen.getByText('Množství')).toBeInTheDocument();
    expect(screen.queryByTestId('nakladka-row')).not.toBeInTheDocument();
  });
});
