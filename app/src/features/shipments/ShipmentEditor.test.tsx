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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';
import {
  AddressDto, ClientDeliveryPlaceDto, ClientDto, Country, OutgoingShipmentDetailDto, OutgoingShipmentOrderDto,
  OutgoingShipmentState, DeliveryAddressKind, OutgoingShipmentStopDto,
  OutgoingShipmentPreparationStepDto, OutgoingShipmentStopKind,
} from 'src/generated/api-client';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

// Pulls in react-leaflet, which doesn't run under happy-dom — same reasoning
// as DeliveryPlacesPanel.test.tsx stubbing AddressMapPicker. Records its props
// so the route's two endpoints can be asserted: which point the run leaves from
// and which it comes home to are decisions ShipmentEditor makes, not RouteMap.
const routeMapProps = vi.fn();
vi.mock('src/components/common/RouteMap', () => ({
  RouteMap: (props: { start: { lat: number; lng: number; name: string }; end: { lat: number; lng: number; name: string } }) => {
    routeMapProps(props);
    return <div data-testid="route-map-stub" />;
  },
}));

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
let startPointsPending = false;
let startPointsError = false;

interface StartPointFixture { kind: string; breweryId?: string; addressKind?: string | null; name: string; address?: string; latitude?: number; longitude?: number }
// The company entry's `addressKind` is explicitly `null` here, not omitted — that is
// the real wire shape (GetShipmentStartPointsEndpoint assigns `AddressKind = null` with
// no DefaultIgnoreCondition to drop it), and a fixture that instead omits the key
// (producing `undefined`, which JSON.stringify drops harmlessly) cannot reproduce the
// 400-on-save bug the company-pick tests below guard against.
const DEFAULT_START_POINTS: StartPointFixture[] = [
  { kind: 'Company', name: 'Sklad AleTrack', address: 'Turistická 211, 46334 Hrádek nad Nisou', latitude: 50.841437, longitude: 14.837309, addressKind: null },
  { kind: 'Brewery', breweryId: 'brewery-svijany', name: 'Pivovar Svijany', address: 'Svijany 1, Svijany', latitude: 50.6, longitude: 15.15 },
];
// Mutable (not a literal) so the route-origin regression test below can point
// the company entry at coordinates chosen to make nearest-neighbour ordering
// unambiguous — see "ShipmentEditor — route optimizer origin".
let startPoints: StartPointFixture[] = DEFAULT_START_POINTS;

vi.mock('src/hooks/useShipments', () => ({
  useShipment: () => ({ data: shipmentResponse, isLoading: shipmentLoading, isError: shipmentError }),
  useAvailableOrders: () => ({ data: availableOrders, isLoading: availableOrdersLoading, isError: availableOrdersError }),
  useCreateShipment: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateShipment: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
  useAcknowledgeAddressChanges: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // The optimizer's origin and every stop's fallback coordinates now come from
  // the company start-point entry rather than the old fixed DEPOT — RouteMap
  // itself is stubbed above, so only the shape of the data matters here.
  useShipmentStartPoints: () => ({ data: startPoints, isPending: startPointsPending, isError: startPointsError }),
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

/** `state` overrides the mocked shipment's loaded state before rendering — used
 * to exercise the structure-locked (e.g. Loaded) editor without a separate
 * fixture per test. Only meaningful in edit mode, where a `shipmentResponse`
 * already exists by the time this runs. */
function renderEditor(opts: { mode?: 'edit' | 'create'; state?: OutgoingShipmentState } = {}) {
  const mode = opts.mode ?? 'edit';
  if (opts.state !== undefined && shipmentResponse) {
    shipmentResponse.state = opts.state;
  }
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <MuiThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ShipmentEditor
              mode={mode}
              shipmentId={mode === 'edit' ? 'ship-1' : undefined}
              onDone={vi.fn()}
              onCancel={vi.fn()}
            />
          </LocalizationProvider>
        </MuiThemeProvider>
      ),
    },
    // Only reachable via `router.navigate` from a test exercising the unsaved-changes
    // guard (`useBlocker` needs a *different* route to block navigation towards).
    { path: '/elsewhere', element: <div>Elsewhere</div> },
  ]);
  return { ...render(<RouterProvider router={router} />), router };
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
  routeMapProps.mockClear();
  shipmentLoading = false;
  shipmentError = false;
  availableOrdersLoading = false;
  availableOrdersError = false;
  vehiclesLoading = false;
  driversLoading = false;
  clientsLoading = false;
  startPointsPending = false;
  startPointsError = false;
  startPoints = DEFAULT_START_POINTS;
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
        selectedAddressKind: DeliveryAddressKind.Official,
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
          selectedAddressKind: DeliveryAddressKind.DeliveryPlace,
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

describe('ShipmentEditor — new stop inherits the order\'s address', () => {
  it('pre-fills a newly added stop from the order rather than the billing address', () => {
    // A second, not-yet-assigned order whose own choice is a delivery place —
    // wire-format string ('DeliveryPlace'), matching what the real backend
    // sends and what addrKindValue must normalize. Adding it via the
    // "Objednávky k rozvozu" list must select that place on the new stop's
    // row, not default to Fakturační like a custom stop would.
    availableOrders = [
      ...availableOrders,
      new OutgoingShipmentOrderDto({
        id: 'order-2',
        clientName: 'U Zlatého sklepa',
        clientOfficialAddress: officialAddress(),
        deliveryAddressKind: 'DeliveryPlace' as unknown as DeliveryAddressKind,
        clientDeliveryPlaceId: 'p1',
        clientDeliveryPlaces: [place({ id: 'p1', name: 'Letní zahrádka' })],
        items: [],
      }),
    ];
    renderEditor();

    fireEvent.click(screen.getByText('U Zlatého sklepa'));

    // order-1's loaded stop is row 0; the freshly added order-2 stop is row 1.
    expect(stopSelects()[1]).toHaveTextContent('Letní zahrádka');
  });

  it('falls back to Fakturační when the order\'s chosen place has since been soft-deleted off the client', () => {
    // GetOrdersListForOutgoingShipmentsEndpoint filters clientDeliveryPlaces to
    // !IsDeleted, so an order that chose a place before it was removed reports
    // a clientDeliveryPlaceId absent from its own clientDeliveryPlaces. Blindly
    // inheriting that id would produce a stop the picker can't render (blank
    // <Select>) and the resolver 404s on save. Must fall back to Official
    // instead, exactly as a brand-new stop would.
    availableOrders = [
      ...availableOrders,
      new OutgoingShipmentOrderDto({
        id: 'order-3',
        clientName: 'Pivnice Na Rohu',
        clientOfficialAddress: officialAddress(),
        deliveryAddressKind: 'DeliveryPlace' as unknown as DeliveryAddressKind,
        clientDeliveryPlaceId: 'gone-place-id',
        clientDeliveryPlaces: [place({ id: 'p1', name: 'Letní zahrádka' })],
        items: [],
      }),
    ];
    renderEditor();

    fireEvent.click(screen.getByText('Pivnice Na Rohu'));

    expect(stopSelects()[1]).toHaveTextContent('Fakturační');
  });
});

describe('ShipmentEditor — route optimizer origin', () => {
  it('optimizes stop order from the company start point, not a stop\'s own coordinates', () => {
    // The mocked company entry sits right next to a second order (Brno) and
    // ~200 km from the first, already-loaded one (Žitava, the default
    // `officialAddress()` fixture). Nearest-neighbour from the *company*
    // point visits the close one first — even though it was added to the
    // route second — which only happens if the optimizer's origin really is
    // the company coordinates. If that origin ever regressed to a stop's own
    // location (the shape of bug the start/end fallback cascade in
    // ShipmentEditor.tsx exists to avoid: the first-loaded stop is trivially
    // "nearest to itself"), the order would never flip and this assertion
    // would fail.
    startPoints = [
      { kind: 'Company', name: 'Sklad AleTrack', latitude: 49.2, longitude: 16.6 },
    ];
    availableOrders = [
      ...availableOrders,
      new OutgoingShipmentOrderDto({
        id: 'order-2',
        clientName: 'Penzion Morava',
        clientOfficialAddress: new AddressDto({
          streetName: 'Zelný trh', streetNumber: '1', city: 'Brno', zip: '60200', country: Country.Czechia,
          latitude: 49.25, longitude: 16.65,
        }),
        items: [],
      }),
    ];
    renderEditor();
    fireEvent.click(screen.getByText('Penzion Morava'));

    const card = screen.getByText('Pořadí zastávek').closest('.MuiCard-root') as HTMLElement;
    const stopNames = () => within(card).getAllByText(/^(Hospoda U Netopýra|Penzion Morava)$/).map((el) => el.textContent);

    // Sanity check before optimizing: the loaded stop first, the just-added one second.
    expect(stopNames()).toEqual(['Hospoda U Netopýra', 'Penzion Morava']);

    fireEvent.click(screen.getByRole('button', { name: 'Optimalizovat trasu' }));

    expect(stopNames()).toEqual(['Penzion Morava', 'Hospoda U Netopýra']);
  });
});

describe('ShipmentEditor — start-point picker', () => {
  it('sends the picked start point in the save payload', async () => {
    // The brief's original assertion here checked that "Uložit" stayed enabled,
    // but that button is only ever gated on `busy` (ShipmentEditor.tsx's
    // `disabled={busy}`), never on the dirty flag — it is enabled from the very
    // first render, so that check would still pass even if `startPoint` were
    // dropped from `serializeShipment` entirely. What this test actually needs
    // to guard against is a picked start point silently failing to reach the
    // saved shipment, so it asserts the save payload directly instead.
    renderEditor({ mode: 'edit' });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(await screen.findByText('Pivovar Svijany'));

    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ship-1',
          data: expect.objectContaining({
            // The fixture's `kind` is the wire-format string ('Brewery'), not the
            // numeric ShipmentStartPointKind member — StartPointPicker passes the
            // picked entry's `kind` straight through with no re-typing, exactly as
            // the real backend's data flows (see optionKey's own comment on why a
            // raw `===` against the numeric enum is unsafe). Asserting the numeric
            // enum value here would fail against what the app, and the real
            // backend round-trip, actually carries.
            startPointKind: 'Brewery',
            startBreweryId: 'brewery-svijany',
          }),
        }),
      );
    });
  });

  it('sends the picked address kind when a brewery contributes two entries', async () => {
    // Svijany now lists two entries — its official seat and a separate contact
    // address it actually loads from — distinguishable in the <Select> only by the
    // "— Kontaktní" suffix and the address caption (StartPointPicker.test.tsx covers
    // the suffix itself). Picking the second one must carry `addressKind` all the way
    // to the save payload: without it, `breweryId` alone cannot tell the two apart, and
    // a resave would silently default back to the official address.
    startPoints = [
      DEFAULT_START_POINTS[0],
      { kind: 'Brewery', breweryId: 'brewery-svijany', addressKind: 'Official', name: 'Pivovar Svijany', address: 'Svijany 1, Svijany', latitude: 50.6, longitude: 15.15 },
      { kind: 'Brewery', breweryId: 'brewery-svijany', addressKind: 'Contact', name: 'Pivovar Svijany', address: 'Skladová 9, Turnov', latitude: 50.59, longitude: 15.16 },
    ];
    renderEditor({ mode: 'edit' });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(await screen.findByText((_, el) => el?.textContent?.startsWith('Pivovar Svijany — Kontaktní') ?? false));

    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ship-1',
          data: expect.objectContaining({
            // Wire-format string, as the DTO carries with no coercion of its own — a
            // prior round of this feature confirmed the DTO does not normalize this.
            startBreweryId: 'brewery-svijany',
            startBreweryAddressKind: 'Contact',
          }),
        }),
      );
    });
  });

  it('does not 400 when picking the company as the start point', async () => {
    // GetShipmentStartPointsEndpoint sets AddressKind = null explicitly on the company
    // entry (Program.cs's JsonOptions has no DefaultIgnoreCondition to drop it), so
    // `picked.addressKind` is a real `null` at runtime, not `undefined`, even though
    // the fixture's TS type only admits the latter — DEFAULT_START_POINTS[0] models
    // that shape explicitly. Both write DTOs declare `StartBreweryAddressKind` as a
    // non-nullable enum: sending the literal `null` (JSON.stringify keeps it — only
    // `undefined` is dropped) fails model binding with a generic 400. This is the
    // regression a bare `picked.addressKind` (no coalesce) reintroduces.
    renderEditor({ mode: 'edit' });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(await screen.findByText('Pivovar Svijany'));

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(await screen.findByText('Sklad AleTrack'));

    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalled();
    });

    const payload = updateMutateAsync.mock.calls.at(-1)![0] as { data: { startBreweryAddressKind?: unknown } };
    expect(payload.data.startBreweryAddressKind).not.toBeNull();
  });

  it('does not flag the form dirty after picking a brewery and then picking the company back', async () => {
    // The loaded baseline's addressKind always arrives as a concrete wire string
    // ('Official') — the detail DTO's field is non-nullable, so even a company-start
    // shipment carries a real (if meaningless) value. Picking a brewery then picking
    // the company back must collapse back to that exact same baseline representation,
    // or the unsaved-changes guard fires on a run nothing actually changed about.
    const { router } = renderEditor({ mode: 'edit' });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(await screen.findByText('Pivovar Svijany'));

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(await screen.findByText('Sklad AleTrack'));

    await act(async () => {
      await router.navigate('/elsewhere');
    });

    expect(screen.queryByText('Neuložené změny')).not.toBeInTheDocument();
  });

  it('locks the start point once the run is loaded', () => {
    renderEditor({ mode: 'edit', state: OutgoingShipmentState.Loaded });

    expect(screen.getByLabelText('Výchozí bod')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('ShipmentEditor — the route\'s two ends', () => {
  /** The props of the most recent RouteMap render — the editor re-renders on
   *  every pick, and only the latest state is the one on screen. */
  const lastRouteMap = () => routeMapProps.mock.calls.at(-1)?.[0];

  it('starts at the picked brewery but still comes home to the company', async () => {
    // The run does not end where it began. Passing the picked start point as
    // `end` too would draw a loop back to the brewery and estimate the wrong
    // distance for the leg that actually matters — the drive home.
    renderEditor({ mode: 'edit' });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(await screen.findByText('Pivovar Svijany'));

    await waitFor(() => {
      expect(lastRouteMap().start).toMatchObject({ name: 'Pivovar Svijany', lat: 50.6, lng: 15.15 });
    });
    expect(lastRouteMap().end).toMatchObject({ name: 'Sklad AleTrack', lat: 50.841437, lng: 14.837309 });
  });

  it('does not plot a start point that was never geocoded', async () => {
    // The start-points endpoint deliberately lists breweries with no coordinates.
    // Coercing those nulls to zero would anchor the route — and the optimizer's
    // origin — off the coast of Africa; the cascade must fall through instead.
    startPoints = [
      DEFAULT_START_POINTS[0],
      { kind: 'Brewery', breweryId: 'brewery-nowhere', name: 'Pivovar bez adresy' },
    ];
    renderEditor({ mode: 'edit' });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(await screen.findByText('Pivovar bez adresy'));

    await waitFor(() => {
      expect(screen.getByLabelText('Výchozí bod')).toHaveTextContent('Pivovar bez adresy');
    });
    // Falls through to the first located stop (the loaded order's own address),
    // never to (0, 0).
    expect(lastRouteMap().start).not.toMatchObject({ lat: 0, lng: 0 });
    expect(lastRouteMap().start.name).not.toBe('Pivovar bez adresy');
  });
});

describe('ShipmentEditor — company stop round-trip', () => {
  it('keeps a loaded Company stop as Company on save, rather than demoting it to Custom', async () => {
    // The wire-format string ('Company'), as the real backend actually sends
    // this enum — not the numeric OutgoingShipmentStopKind member. The
    // edit-mode load effect classifies a loaded stop with no orderId via
    // `stopKindName(st.kind) === 'Company'` (ShipmentEditor.tsx); before that
    // check existed, any such stop was hard-defaulted to 'custom'. Saving
    // straight back out (no edits at all) must still send this stop as
    // Company — if the detection ever regressed to always 'custom', the save
    // payload's customStops would carry this stop with no `kind: Company` at
    // all, and this assertion would fail.
    shipmentResponse!.stops = [
      ...(shipmentResponse!.stops ?? []),
      new OutgoingShipmentStopDto({
        id: 'company-stop-1',
        order: 2,
        kind: 'Company' as unknown as OutgoingShipmentStopKind,
        label: 'Sklad AleTrack',
        latitude: 50.897,
        longitude: 14.807,
      }),
    ];
    renderEditor({ mode: 'edit' });

    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ship-1',
          data: expect.objectContaining({
            customStops: expect.arrayContaining([
              expect.objectContaining({ id: 'company-stop-1', kind: OutgoingShipmentStopKind.Company }),
            ]),
          }),
        }),
      );
    });
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

describe('ShipmentEditor — checklist', () => {
  it('prefills the standard pre-departure list on a new shipment', () => {
    // The list is the same before every departure, so a new vývoz arrives with it filled in —
    // and every row stays editable from there.
    renderEditor({ mode: 'create' });

    expect((screen.getByLabelText('Položka 1') as HTMLInputElement).value).toBe('Rudlík');
    expect((screen.getByLabelText('Položka 11') as HTMLInputElement).value).toBe('Věci z předchozího vývozu');
  });

  it('leaves an existing shipment its own checklist, not the default one', () => {
    // Prefilling on edit would resurrect rows the planner deliberately deleted.
    shipmentResponse = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz', state: OutgoingShipmentState.Created, stops: [],
      preparationSteps: [new OutgoingShipmentPreparationStepDto({ id: 'step-1', order: 1, label: 'Jen tohle' })],
    });

    renderEditor();

    expect((screen.getByLabelText('Položka 1') as HTMLInputElement).value).toBe('Jen tohle');
    expect(screen.queryByLabelText('Položka 2')).not.toBeInTheDocument();
  });
});
