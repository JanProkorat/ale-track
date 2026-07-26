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
  OutgoingShipmentStopAddressKind,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

// Pulls in react-leaflet, which doesn't run under happy-dom — same stub used
// by ShipmentEditor.test.tsx.
vi.mock('src/components/common/RouteMap', () => ({ RouteMap: () => <div data-testid="route-map-stub" /> }));

vi.mock('src/hooks/useShipments', () => ({ useUpdateShipment: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('src/hooks/useVehicles', () => ({ useVehicle: () => ({ data: undefined, isLoading: false }) }));
vi.mock('src/hooks/useDrivers', () => ({ useDrivers: () => ({ data: [], isLoading: false }) }));
vi.mock('src/hooks/useInventory', () => ({ useInventory: () => ({ data: [], isLoading: false }) }));

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

function placeStop(): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: 'stop-1',
    kind: OutgoingShipmentStopKind.Order,
    order: 1,
    clientId: 'client-a',
    clientName: 'Hospoda U Netopýra',
    orderId: 'order-1',
    officialAddress: officialAddress(),
    selectedAddressKind: OutgoingShipmentStopAddressKind.DeliveryPlace,
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
    selectedAddressKind: OutgoingShipmentStopAddressKind.Official,
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
});
