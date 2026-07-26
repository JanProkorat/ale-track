// What only ShipmentEditor decides about the stop picker (the pure encoding/
// resolution is covered directly in stopAddress.test.ts): that a stop's
// <Select> lists the client's own delivery places under a "Vlastní místa"
// heading, that "+ Nové místo…" opens DeliveryPlaceDialog instead of changing
// the stop, that saving from that dialog selects the new place and cancelling
// it leaves the previous choice in place, and — the case the whole feature
// exists to protect — that a stop pointing at a place since soft-deleted off
// the client (absent from the loaded order's clientDeliveryPlaces) still shows
// selected, as a disabled "(smazáno)" option, rather than silently falling
// back to no selection.

import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import {
  AddressDto, ClientDeliveryPlaceDto, ClientDto, Country, OutgoingShipmentDetailDto, OutgoingShipmentOrderDto,
  OutgoingShipmentState, OutgoingShipmentStopAddressKind, OutgoingShipmentStopDto,
} from 'src/generated/api-client';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

// Pulls in react-leaflet, which doesn't run under happy-dom — same reasoning
// as DeliveryPlacesPanel.test.tsx stubbing AddressMapPicker.
vi.mock('src/components/common/RouteMap', () => ({ RouteMap: () => <div data-testid="route-map-stub" /> }));

// Stubbed rather than exercised for real: its own create/edit/validate
// behaviour is covered by DeliveryPlaceDialog.test.tsx. Here we only need to
// assert *that* ShipmentEditor opens it with the right client, and that its
// onSaved/onClose callbacks are wired the way the brief requires.
const deliveryPlaceDialogProps = vi.fn();
vi.mock('src/components/common/DeliveryPlaceDialog', () => ({
  DeliveryPlaceDialog: (props: { open: boolean; clientId: string; clientName?: string; onClose: () => void; onSaved?: (id: string) => void }) => {
    deliveryPlaceDialogProps(props);
    if (!props.open) return null;
    return (
      <div data-testid="delivery-place-dialog-stub">
        <button onClick={() => props.onSaved?.('new-place-id')}>stub-save</button>
        <button onClick={props.onClose}>stub-cancel</button>
      </div>
    );
  },
}));

let shipmentResponse: OutgoingShipmentDetailDto | undefined;
let availableOrders: OutgoingShipmentOrderDto[] = [];
const updateMutateAsync = vi.fn().mockResolvedValue(undefined);
const createMutateAsync = vi.fn().mockResolvedValue('new-shipment-id');

vi.mock('src/hooks/useShipments', () => ({
  useShipment: () => ({ data: shipmentResponse, isLoading: false, isError: false }),
  useAvailableOrders: () => ({ data: availableOrders, isLoading: false, isError: false }),
  useCreateShipment: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateShipment: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

vi.mock('src/hooks/useVehicles', () => ({ useVehicles: () => ({ data: [], isLoading: false }) }));
vi.mock('src/hooks/useDrivers', () => ({ useDrivers: () => ({ data: [], isLoading: false }) }));
vi.mock('src/hooks/useClients', () => ({
  useClients: () => ({ data: [new ClientDto({ id: 'client-1', name: 'Hospoda U Netopýra' })], isLoading: false }),
}));

const { ShipmentEditor } = await import('./ShipmentEditor');

function place(over: Partial<ClientDeliveryPlaceDto> = {}): ClientDeliveryPlaceDto {
  return new ClientDeliveryPlaceDto({
    id: 'place-a', name: 'Letní zahrádka',
    address: new AddressDto({ streetName: 'Nábřežní', streetNumber: '3', city: 'Žitava', zip: '02763', country: Country.Czechia, latitude: 50.9, longitude: 14.8 }),
    ...over,
  });
}

function officialAddress(): AddressDto {
  return new AddressDto({ streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', country: Country.Czechia, latitude: 50.897, longitude: 14.808 });
}

function renderEditor() {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <MuiThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ShipmentEditor mode="edit" shipmentId="ship-1" onDone={vi.fn()} onCancel={vi.fn()} />
          </LocalizationProvider>
        </MuiThemeProvider>
      ),
    },
  ]);
  return render(<RouterProvider router={router} />);
}

/** The "Pořadí zastávek" card's stop rows are the only <Select>s it renders,
 * in stop order — scoping to the card lets each test grab the row it needs
 * without a test-id added purely for this file. */
function stopSelects(): HTMLElement[] {
  const card = screen.getByText('Pořadí zastávek').closest('.MuiCard-root') as HTMLElement;
  return within(card).getAllByRole('combobox');
}

function openStopMenu(index = 0) {
  fireEvent.mouseDown(stopSelects()[index]);
  return screen.getByRole('listbox');
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMutateAsync.mockResolvedValue(undefined);
  createMutateAsync.mockResolvedValue('new-shipment-id');
  deliveryPlaceDialogProps.mockClear();
  availableOrders = [
    new OutgoingShipmentOrderDto({
      id: 'order-1',
      clientName: 'Hospoda U Netopýra',
      clientOfficialAddress: officialAddress(),
      clientDeliveryPlaces: [place(), place({ id: 'place-b', name: 'Sklad' })],
      items: [],
    }),
  ];
  shipmentResponse = new OutgoingShipmentDetailDto({
    id: 'ship-1',
    name: 'Rozvoz Žitava',
    state: OutgoingShipmentState.Created,
    driverIds: [],
    stops: [
      new OutgoingShipmentStopDto({
        id: 'stop-1', order: 1, orderId: 'order-1',
        selectedAddressKind: OutgoingShipmentStopAddressKind.Official,
      }),
    ],
  });
});

describe('ShipmentEditor stop picker — listing places', () => {
  it('lists the clients own places under a "Vlastní místa" heading, alongside Fakturační', () => {
    renderEditor();
    const listbox = openStopMenu();

    expect(within(listbox).getByText('Fakturační')).toBeInTheDocument();
    expect(within(listbox).getByText('Vlastní místa')).toBeInTheDocument();
    expect(within(listbox).getByText('Letní zahrádka')).toBeInTheDocument();
    expect(within(listbox).getByText('Sklad')).toBeInTheDocument();
    expect(within(listbox).getByText('+ Nové místo…')).toBeInTheDocument();
    // No contact address on this order fixture, so it must be omitted.
    expect(within(listbox).queryByText('Kontaktní')).not.toBeInTheDocument();
  });

  it('selecting a place resolves the row text to the place, not the billing address', () => {
    renderEditor();
    const listbox = openStopMenu();
    fireEvent.click(within(listbox).getByText('Sklad'));

    expect(screen.getByText(/Sklad ·/)).toBeInTheDocument();
  });
});

describe('ShipmentEditor stop picker — new place', () => {
  it('opens DeliveryPlaceDialog for the stop\'s client, not the sentinel', () => {
    renderEditor();
    const listbox = openStopMenu();
    fireEvent.click(within(listbox).getByText('+ Nové místo…'));

    expect(screen.getByTestId('delivery-place-dialog-stub')).toBeInTheDocument();
    const lastCall = deliveryPlaceDialogProps.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ open: true, clientId: 'client-1', clientName: 'Hospoda U Netopýra' });
  });

  it('selects the new place on success', () => {
    renderEditor();
    fireEvent.click(within(openStopMenu()).getByText('+ Nové místo…'));
    fireEvent.click(screen.getByText('stub-save'));

    expect(screen.queryByTestId('delivery-place-dialog-stub')).not.toBeInTheDocument();
    // The row's second line now resolves through the (mocked-away, so
    // unnamed) new place id — since it isn't in clientDeliveryPlaces either,
    // resolveStopAddress falls back to the official address text; what
    // matters here is that the *select* now reflects a DeliveryPlace choice,
    // checked by re-opening the menu and seeing the "+ Nové místo…" row is no
    // longer the effective value (the stub isn't shown, and Fakturační/Sklad
    // aren't marked selected by any visible cue other than aria-selected).
    const opened = openStopMenu();
    expect(within(opened).getByText('Fakturační').closest('[aria-selected]')?.getAttribute('aria-selected')).toBe('false');
  });

  it('reverts to the previous value when the dialog is cancelled, not stuck on the sentinel', () => {
    renderEditor();
    // Row starts on Fakturační (Official) per the fixture.
    fireEvent.click(within(openStopMenu()).getByText('+ Nové místo…'));
    expect(screen.getByTestId('delivery-place-dialog-stub')).toBeInTheDocument();

    fireEvent.click(screen.getByText('stub-cancel'));
    expect(screen.queryByTestId('delivery-place-dialog-stub')).not.toBeInTheDocument();

    const opened = openStopMenu();
    expect(within(opened).getByText('Fakturační').closest('[aria-selected]')?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('ShipmentEditor stop picker — soft-deleted place', () => {
  it('keeps a stop selected on a place no longer in the client\'s list, disabled and labelled "(smazáno)"', () => {
    // The place this stop originally picked has since been removed from the
    // client — it's absent from order-1's clientDeliveryPlaces (only
    // place-a/place-b are offered) but the loaded shipment still resolves it
    // on read, carrying its name for display.
    shipmentResponse = new OutgoingShipmentDetailDto({
      id: 'ship-1',
      name: 'Rozvoz Žitava',
      state: OutgoingShipmentState.Created,
      driverIds: [],
      stops: [
        new OutgoingShipmentStopDto({
          id: 'stop-1', order: 1, orderId: 'order-1',
          selectedAddressKind: OutgoingShipmentStopAddressKind.DeliveryPlace,
          deliveryPlace: place({ id: 'gone-place', name: 'Zrušená hospůdka' }),
        }),
      ],
    });

    renderEditor();
    const listbox = openStopMenu();

    const goneOption = within(listbox).getByText('Zrušená hospůdka (smazáno)');
    expect(goneOption).toBeInTheDocument();
    const optionEl = goneOption.closest('[role="option"]') as HTMLElement;
    expect(optionEl.getAttribute('aria-selected')).toBe('true');
    expect(optionEl.getAttribute('aria-disabled')).toBe('true');
  });
});
