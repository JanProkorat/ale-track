// What ShipmentDetail decides about the stop header on "Přehled objednávek":
// a stop delivering to a client's saved place shows a small chip with the
// place name and its formatted address below (never repeating the name); any
// other stop keeps the plain `address · kind` line unchanged. The pure
// resolution behind both is covered directly in stopAddress.test.ts.

import { render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import {
  AddressDto,
  ClientDeliveryPlaceDto,
  Country,
  OutgoingShipmentDetailDto,
  OutgoingShipmentState,
  DeliveryAddressKind,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
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
}));
vi.mock('src/hooks/useVehicles', () => ({ useVehicle: () => ({ data: undefined, isLoading: false }) }));
vi.mock('src/hooks/useDrivers', () => ({ useDrivers: () => ({ data: [], isLoading: false }) }));
vi.mock('src/hooks/useInventory', () => ({ useInventory: () => ({ data: [], isLoading: false }) }));
// The nakládka's brewery-invoice columns: the product catalogue feeds the
// "Zboží na sklad" picker, and the split/loading writes are mutations the
// screen only calls on click. Mocked for the same reason as the rest — this
// file is about stop headers and route points, not about a QueryClient.
vi.mock('src/hooks/useProducts', () => ({ useProducts: () => ({ data: [], isLoading: false }) }));
vi.mock('src/hooks/usePurchaseInvoices', () => ({
  useAddPurchaseInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePurchaseInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useSetPurchaseInvoiceLine: () => ({ mutate: vi.fn(), isPending: false }),
  useSetLoadingState: () => ({ mutate: vi.fn(), isPending: false }),
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
