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

// Mutable rather than literals — app/CLAUDE.md requires a query mock able to
// express loading/error/no-data, since a mock that's always the happy path
// can't catch a crash on a missing one (which is exactly how a page-level
// crash shipped once). Reset to the happy path in beforeEach; individual
// tests flip one or two to exercise a non-happy state.
let shipmentLoading = false;
let shipmentError = false;
let availableOrdersLoading = false;
let availableOrdersError = false;
let vehiclesLoading = false;
let driversLoading = false;
let clientsLoading = false;

vi.mock('src/hooks/useShipments', () => ({
  useShipment: () => ({ data: shipmentResponse, isLoading: shipmentLoading, isError: shipmentError }),
  useAvailableOrders: () => ({ data: availableOrders, isLoading: availableOrdersLoading, isError: availableOrdersError }),
  useCreateShipment: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateShipment: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

vi.mock('src/hooks/useVehicles', () => ({ useVehicles: () => ({ data: [], isLoading: vehiclesLoading }) }));
vi.mock('src/hooks/useDrivers', () => ({ useDrivers: () => ({ data: [], isLoading: driversLoading }) }));
vi.mock('src/hooks/useClients', () => ({
  useClients: () => ({ data: [new ClientDto({ id: 'client-1', name: 'Hospoda U Netopýra' })], isLoading: clientsLoading }),
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
  shipmentLoading = false;
  shipmentError = false;
  availableOrdersLoading = false;
  availableOrdersError = false;
  vehiclesLoading = false;
  driversLoading = false;
  clientsLoading = false;
  availableOrders = [
    new OutgoingShipmentOrderDto({
      id: 'order-1',
      clientName: 'Hospoda U Netopýra',
      clientOfficialAddress: officialAddress(),
      // A third place already on the client but not yet chosen by this stop —
      // stands in for "the orders query has refetched since '+ Nové místo…'
      // created a place", so the "selects the new place on success" test can
      // assert the positive (a normal, enabled, selected option) rather than
      // a negative on an unrelated option.
      clientDeliveryPlaces: [place(), place({ id: 'place-b', name: 'Sklad' }), place({ id: 'new-place-id', name: 'Depo Sever' })],
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
    // The stub always reports 'new-place-id' regardless of what was typed —
    // real creation is DeliveryPlaceDialog's own concern, covered by its own
    // test file. 'Depo Sever' (id 'new-place-id') is already present in this
    // test's clientDeliveryPlaces fixture, standing in for the orders query
    // having refetched by the time the picker is reopened.
    fireEvent.click(screen.getByText('stub-save'));

    expect(screen.queryByTestId('delivery-place-dialog-stub')).not.toBeInTheDocument();
    const opened = openStopMenu();
    const selectedOption = within(opened).getByText('Depo Sever').closest('[role="option"]') as HTMLElement;
    expect(selectedOption.getAttribute('aria-selected')).toBe('true');
    expect(selectedOption.getAttribute('aria-disabled')).not.toBe('true');
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

  it('does not mislabel a just-created place as soft-deleted before the orders query refetches', () => {
    // Unlike the "selects the new place on success" fixture, this order's
    // clientDeliveryPlaces does NOT yet include the id the stub reports —
    // simulating the real gap between the create mutation resolving and its
    // qk.shipmentOrders invalidation refetching. The stop never had a loaded
    // deliveryPlace (it started on Official), so there is no name to show and
    // it must not render as a disabled "(smazáno)" entry in the meantime.
    availableOrders = [
      new OutgoingShipmentOrderDto({
        id: 'order-1',
        clientName: 'Hospoda U Netopýra',
        clientOfficialAddress: officialAddress(),
        clientDeliveryPlaces: [place(), place({ id: 'place-b', name: 'Sklad' })],
        items: [],
      }),
    ];
    renderEditor();
    fireEvent.click(within(openStopMenu()).getByText('+ Nové místo…'));
    fireEvent.click(screen.getByText('stub-save'));

    expect(screen.queryByText(/\(smazáno\)/)).not.toBeInTheDocument();
    const opened = openStopMenu();
    expect(within(opened).queryByText(/\(smazáno\)/)).not.toBeInTheDocument();
    expect(within(opened).queryByText('Smazané')).not.toBeInTheDocument();
  });
});

describe('ShipmentEditor stop picker — soft-deleted place', () => {
  it('keeps a stop selected on a place no longer in the client\'s list, disabled and labelled "(smazáno)"', () => {
    // The place this stop originally picked has since been removed from the
    // client — it's absent from order-1's clientDeliveryPlaces (its id
    // 'gone-place' isn't among the ones offered) but the loaded shipment
    // still resolves it on read, carrying its name for display.
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

    // The positive case of the "Smazané" heading: ShipmentEditor.test.tsx's
    // "listing places" describe block only asserts its *absence* when nothing
    // is soft-deleted; this is the genuine soft-deleted-place path (the one
    // Critical 2 of the whole-branch review lives on), so the heading must
    // actually be there.
    expect(within(listbox).getByText('Smazané')).toBeInTheDocument();

    const goneOption = within(listbox).getByText('Zrušená hospůdka (smazáno)');
    expect(goneOption).toBeInTheDocument();
    const optionEl = goneOption.closest('[role="option"]') as HTMLElement;
    expect(optionEl.getAttribute('aria-selected')).toBe('true');
    expect(optionEl.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('ShipmentEditor — non-happy query states', () => {
  it('does not crash while the available-orders query is still loading, falling back to a placeholder client name', () => {
    // orderById is built purely from useAvailableOrders' data — while it's
    // loading (data undefined, coerced to []) an existing order stop can't
    // resolve its order at all. Must degrade gracefully, not throw.
    availableOrdersLoading = true;
    availableOrders = [];

    renderEditor();

    const card = screen.getByText('Pořadí zastávek').closest('.MuiCard-root') as HTMLElement;
    expect(within(card).getByText('—')).toBeInTheDocument();
    // The picker still renders with just the two standard options — no
    // client-specific places (there's no order to read them from) and no
    // crash opening it either.
    const listbox = openStopMenu();
    expect(within(listbox).getByText('Fakturační')).toBeInTheDocument();
    expect(within(listbox).queryByText('Vlastní místa')).not.toBeInTheDocument();
  });

  it('does not crash when the shipment detail query errors', () => {
    shipmentError = true;
    shipmentResponse = undefined;

    renderEditor();

    // Title only depends on `mode`, not on the query resolving — the editor
    // must still render its chrome around an empty draft rather than throw.
    // (It appears twice: the breadcrumb and the page heading.)
    expect(screen.getAllByText('Úprava vývozu').length).toBeGreaterThan(0);
    expect(screen.getByText('Zatím žádné zastávky')).toBeInTheDocument();
  });
});
