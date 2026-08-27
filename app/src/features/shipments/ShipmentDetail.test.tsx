// What ShipmentDetail decides about the stop header on "Přehled zastávek":
// a stop delivering to a client's saved place shows a small chip with the
// place name and its formatted address below (never repeating the name); any
// other stop keeps the plain `address · kind` line unchanged. The pure
// resolution behind both is covered directly in stopAddress.test.ts.

import { type ReactNode } from 'react';
import {
  render, screen, within, fireEvent, waitForElementToBeRemoved, act, cleanup,
} from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AddressDto,
  ClientDeliveryPlaceDto,
  Country,
  OutgoingShipmentDetailDto,
  OutgoingShipmentOrderItemDto,
  OutgoingShipmentPreparationStepDto,
  OutgoingShipmentState,
  DeliveryAddressKind,
  type IOutgoingShipmentDetailDto,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
  OutgoingShipmentSupplierGoodDto,
  ProductKind,
  DayOfWeek,
  SupplierOpeningHoursDto,
  ShipmentDriverDto,
  ShipmentStartPointKind,
  ShipmentVehicleDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

// Hoisted rather than a fresh spy per call so the export tests can assert what was surfaced.
const enqueueSnackbar = vi.hoisted(() => vi.fn());
// The Vykládka, the Vratky card and the Extra položky card all read the run's clients' ledgers,
// so the hook is mocked like every other resource. Its "nothing recorded" answer is the ordinary
// case, and the one every assertion here is written against.
vi.mock('src/hooks/useClientLedger', () => ({
  useClientLedgersMany: () => ({ byClient: new Map(), loading: new Set() }),
  useClientLedger: () => ({ data: [], isLoading: false, isError: false }),
  useSaveClientLedgerEntries: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateClientLedgerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteClientLedgerEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetClientLedgerEntryResolution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetClientLedgerEntryAssignment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

// The real helper drives an <a download> click, which happy-dom cannot act on. Saving the file is
// covered directly in download.test.ts; here the question is only whether the screen hands it the
// blob and the server's filename.
const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock('src/lib/download', () => ({ downloadBlob }));

// Pulls in react-leaflet, which doesn't run under happy-dom — same stub used
// by ShipmentEditor.test.tsx. Captures the `stops` prop (rather than just
// rendering an empty div) so the route-map fix in step 2 — a DeliveryPlace
// stop must pin at the place, not the billing address — has a test that can
// actually catch a regression on it.
const routeMapProps = vi.fn();
vi.mock('src/components/common/RouteMap', () => ({
  // The stub renders `overlay`, because on md+ (happy-dom's viewport is 1024 wide)
  // that docked copy is the *only* rendered "Přehled zastávek" — the page-flow copy
  // is display:none there. A stub that dropped the prop hid the card from every
  // role-based query in this file.
  RouteMap: (props: { stops: { lat?: number; lng?: number; label: string }[]; overlay?: ReactNode; busy?: boolean }) => {
    routeMapProps(props);
    return (
      <div data-testid="route-map-stub" data-busy={props.busy ? 'true' : 'false'}>
        {props.overlay}
      </div>
    );
  },
}));

// Hoisted so the export tests below can assert what the button fired and drive the mutation's
// callbacks; a fresh vi.fn() per hook call would hand each re-render a different spy.
const exportShipmentMutate = vi.hoisted(() => vi.fn());
const setShipmentStateMutate = vi.hoisted(() => vi.fn());
const setOrderItemSourcingMutate = vi.hoisted(() => vi.fn());
const reorderStopsMutate = vi.hoisted(() => vi.fn());
const setStockPurchaseMutate = vi.hoisted(() => vi.fn());
const setStopCompletionMutate = vi.hoisted(() => vi.fn());
const exportShipmentPending = vi.hoisted(() => ({ value: false }));
// Mutable so the start-point test below can assert against a specific company
// entry without every other test in this file having to know about it — the
// happy-path default carries one, matching the reference data every shipment
// screen actually gets.
const startPointsData = vi.hoisted(() => ({
  value: [
    { kind: 'Company', name: 'Sklad AleTrack', address: 'Turistická 211, 46334 Hrádek nad Nisou', latitude: 50.841437, longitude: 14.837309 },
  ] as { kind: string; name: string; address?: string; latitude?: number; longitude?: number }[],
}));
vi.mock('src/hooks/useShipments', () => ({
  useUpdateShipment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAcknowledgeAddressChanges: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // Ticking a preparation step is a mutation the screen only fires on click; the checklist card
  // has its own tests (PreparationStepsCard.test.tsx).
  useSetPreparationStep: () => ({ mutate: vi.fn(), isPending: false }),
  // The two one-field nakládka writes. Both are fired on click only, and both have their
  // behaviour covered where it lives: the state transition on the API side
  // (ShipmentStateEndpointTests), the sourcing stepper in nakladkaSourcing.test.ts.
  useSetShipmentState: () => ({ mutate: setShipmentStateMutate, isPending: false }),
  useSetOrderItemSourcing: () => ({ mutate: setOrderItemSourcingMutate, isPending: false }),
  // Feeds the Další zboží card's stepper; a click also re-derives the run's pickup stops.
  useSetSupplierGoodSourcing: () => ({ mutate: vi.fn(), isPending: false }),
  useReorderShipmentStops: () => ({ mutate: reorderStopsMutate, isPending: false }),
  useSetStockPurchase: () => ({ mutate: setStockPurchaseMutate, isPending: false }),
  // Marking a stop finished from the Vykládka; fired on click only, and covered as a hook in
  // useSetStopCompletion.test.tsx.
  useSetStopCompletion: () => ({ mutate: setStopCompletionMutate, isPending: false }),
  useExportShipment: () => ({ mutate: exportShipmentMutate, isPending: exportShipmentPending.value }),
  // String "kind" here, deliberately not the numeric enum member — the real
  // backend serializes every enum as its string name (JsonStringEnumConverter,
  // Program.cs), and the screen must resolve the company entry through that
  // wire shape (see startPointKindName in src/lib/labels.ts), not by comparing
  // against ShipmentStartPointKind.Company directly.
  useShipmentStartPoints: () => ({ data: startPointsData.value, isPending: false, isError: false }),
}));
vi.mock('src/hooks/useInventory', () => ({ useInventory: () => ({ data: [], isLoading: false }) }));
// The suppliers behind the run's pickup stops, which the Vykládka reads opening hours off.
// Mutable so the hours test can hand back a schedule while every other test here stays unaware
// that suppliers exist at all.
const suppliersById = vi.hoisted(() => ({ value: new Map<string, unknown>() }));
vi.mock('src/hooks/useSuppliers', () => ({
  useSuppliersMany: () => ({ bySupplier: suppliersById.value, loading: new Set<string>() }),
}));
// The nakládka's brewery-invoice columns: the product catalogue feeds the
// "Zboží na sklad" picker, and the split/loading writes are mutations the
// screen only calls on click. Mocked for the same reason as the rest — this
// file is about stop headers and route points, not about a QueryClient.
vi.mock('src/hooks/useProducts', () => ({ useProducts: () => ({ data: [], isLoading: false }) }));
// The nakládka marks each brewery section with the brewery's own colour, which rides on
// the cached brewery list rather than on the shipment. Only Frýdlant has one here, so the
// fallback for a brewery without a colour is exercised too.
vi.mock('src/hooks/useBreweries', () => ({
  useBreweryColors: () => (id?: string) => (id === 'brewery-frydlant' ? '#F08C00' : undefined),
}));
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
// Stands in for the export drawer: this file is about what the detail screen does with an export,
// not about choosing its rows — ExportSelectionDrawer.test.tsx covers that against the real thing.
// The stub reports whether it was opened and fires each format with a fixed selection.
vi.mock('./ExportSelectionDrawer', () => ({
  ExportSelectionDrawer: ({ open, onExport }: {
    open: boolean;
    onExport: (format: 'excel' | 'word', clientIds: string[]) => void;
  }) => (open ? (
    <div data-testid="export-drawer">
      <button type="button" onClick={() => onExport('excel', ['client-a'])}>Excel</button>
      <button type="button" onClick={() => onExport('word', ['client-a'])}>Word</button>
    </div>
  ) : null),
}));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => (czk == null ? '—' : `${czk} Kč`) }),
}));

const { ShipmentDetail } = await import('./ShipmentDetail');

// Every test starts with suppliers nobody has looked up: the hours line is opt-in per test.
beforeEach(() => { suppliersById.value = new Map(); });

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

/**
 * Renders the detail screen either from a bare stop list (the shape every
 * existing call site here uses) or a partial shipment override carrying its
 * own `stops` — the Vykládka tests below need to vary `startPointName` too,
 * which a stop array alone cannot express.
 */
function renderDetail(
  input: OutgoingShipmentStopDto[] | (Partial<IOutgoingShipmentDetailDto> & { stops: OutgoingShipmentStopDto[] }),
  onOpenOrder?: (orderId: string) => void,
  // Read-only by default, which is what most of this file asserts about. The reorder tests
  // need the editable case, since the route may only be resequenced by someone who can edit.
  opts: { editable?: boolean } = {},
) {
  const overrides: Partial<IOutgoingShipmentDetailDto> = Array.isArray(input) ? { stops: input } : input;
  const shipment = new OutgoingShipmentDetailDto({
    id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Created, driverIds: [],
    ...overrides,
  });
  return render(
    <MuiThemeProvider theme={theme}>
      <ShipmentDetail
        shipment={shipment}
        editable={opts.editable ?? false}
        canSeeInvoicing
        canSeeLoadingBreakdown
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onOpenOrder={onOpenOrder}
      />
    </MuiThemeProvider>,
  );
}

function renderEditableDetail(state: OutgoingShipmentState) {
  const shipment = new OutgoingShipmentDetailDto({
    id: 'ship-1', name: 'Rozvoz Žitava', state, driverIds: [], stops: [officialStop()],
  });
  return render(
    <MuiThemeProvider theme={theme}>
      <ShipmentDetail shipment={shipment} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
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

  // "Do garáže" is content — goods bought and put on the truck — so it freezes when the truck
  // does, one state earlier than the loading ticks and the sourcing stepper beside it. The API
  // has always drawn the line there (stock purchases are frozen content); the button was
  // offered past it regardless and could only produce a 400.
  it('offers "Zboží na sklad" while the run is still being planned', () => {
    renderEditableDetail(OutgoingShipmentState.Created);

    expect(screen.getByRole('button', { name: 'Zboží na sklad' })).toBeInTheDocument();
  });

  it.each([
    ['loaded', OutgoingShipmentState.Loaded],
    ['in transit', OutgoingShipmentState.InTransit],
  ])('withdraws "Zboží na sklad" once the content is frozen (%s)', (_label, state) => {
    renderEditableDetail(state);
    // A run on the road opens on Vykládka now (loadingView.ts), where neither button belongs.
    // The toolbar under test is the loading list's, so select it the way the office would.
    fireEvent.click(screen.getByRole('button', { name: 'Nakládka' }));

    expect(screen.queryByRole('button', { name: 'Zboží na sklad' })).not.toBeInTheDocument();
    // "Faktura pivovaru" goes with it now, but for the other reason: the whole table is locked on
    // a packed run until the office unlocks it. Unlocking brings that one back and not this one —
    // opening a stock purchase is a different run, not a correction of this one's loading list.
    expect(screen.queryByRole('button', { name: 'Faktura pivovaru' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Odemknout' }));
    expect(screen.getByRole('button', { name: 'Faktura pivovaru' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zboží na sklad' })).not.toBeInTheDocument();
  });
});

// The API refuses InTransit and Delivered on a run that is not fully planned, so the header must
// not offer the step. Which fields count is pinned in departureReadiness.test.ts; what the screen
// owes is the disabled button.
// The card served the packing of the van, and opened on the loading list because of it. Once the
// run is Na cestě that list is history — the stop-by-stop unload order is what the office and the
// driver work through. Which state maps to which view is pinned in loadingView.test.ts.
describe('ShipmentDetail — the view the loading card opens on', () => {
  function runAt(state: OutgoingShipmentState) {
    return new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state, driverIds: [], stops: [officialStop()],
    });
  }

  function renderRun(state: OutgoingShipmentState) {
    return render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={runAt(state)} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );
  }

  /** The SegControl marks its active option with aria-pressed. */
  const tab = (label: string) => screen.getByRole('button', { name: label });

  it('opens on the loading list while the van is still being packed', () => {
    renderRun(OutgoingShipmentState.Loaded);

    expect(tab('Nakládka')).toHaveAttribute('aria-pressed', 'true');
    expect(tab('Vykládka')).toHaveAttribute('aria-pressed', 'false');
  });

  it.each([
    ['na cestě', OutgoingShipmentState.InTransit],
    ['doručeno', OutgoingShipmentState.Delivered],
  ])('opens on the unload view once the van is out (%s)', (_label, state) => {
    renderRun(state);

    expect(tab('Vykládka')).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches over when the run departs while the screen is open', () => {
    const { rerender } = renderRun(OutgoingShipmentState.Loaded);
    expect(tab('Nakládka')).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={runAt(OutgoingShipmentState.InTransit)} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );

    expect(tab('Vykládka')).toHaveAttribute('aria-pressed', 'true');
  });

  // The rule sets the view, it does not hold it: a run out on the road whose loading list the
  // office deliberately opens must not be dragged back on the next refetch.
  it('leaves a deliberate switch back alone', () => {
    const { rerender } = renderRun(OutgoingShipmentState.InTransit);

    fireEvent.click(tab('Nakládka'));
    expect(tab('Nakládka')).toHaveAttribute('aria-pressed', 'true');

    // Same run, same state — what a refetch of the detail query hands back.
    rerender(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={runAt(OutgoingShipmentState.InTransit)} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );

    expect(tab('Nakládka')).toHaveAttribute('aria-pressed', 'true');
  });
});

// The list used to drop every stop the van calls at to collect, which left the driver's list
// disagreeing with the route it belongs to. Which stops survive is pinned in unloadOrder.test.ts
// and the hours line in supplierStopHours.test.ts; this is the wiring between them — the screen
// has to fetch the supplier and hold its schedule against the run's own date.
describe('ShipmentDetail — a pickup stop in the Vykládka', () => {
  function pickupStop() {
    return new OutgoingShipmentStopDto({
      id: 'pickup', order: 1, kind: 'Supplier' as unknown as OutgoingShipmentStopKind,
      label: 'Linde Gas', supplierId: 'sup-linde',
      supplierAddress: new AddressDto({
        streetName: 'Průmyslová', streetNumber: '12', city: 'Liberec', zip: '46001',
        country: Country.Czechia,
      }),
    } as never);
  }

  /** A run leaving on Monday 2026-08-24 at 07:30, so a Monday schedule is the one read out. */
  function renderRun() {
    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava',
      state: OutgoingShipmentState.InTransit,
      deliveryDate: new Date(2026, 7, 24, 7, 30),
      driverIds: [],
      stops: [pickupStop(), officialStop()],
      supplierGoods: [new OutgoingShipmentSupplierGoodDto({
        id: 'good-1', name: 'CO₂ láhev', size: '10 kg', quantity: 2, supplierId: 'sup-linde',
      })],
    });
    return render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );
  }

  it('lists the pickup with what is collected there', () => {
    renderRun();

    // A run on the road opens on Vykládka, so the list is already the one showing.
    const list = within(screen.getByTestId('unload-list'));
    expect(list.getByText('Linde Gas')).toBeInTheDocument();
    expect(list.getByText(/Průmyslová 12/)).toBeInTheDocument();
    expect(list.getByText('CO₂ láhev')).toBeInTheDocument();
  });

  it("reads out the supplier's hours for the run's own day", () => {
    suppliersById.value = new Map([['sup-linde', {
      id: 'sup-linde',
      openingHours: [
        new SupplierOpeningHoursDto({ dayOfWeek: DayOfWeek.Monday, from: '07:00:00', to: '15:30:00' }),
      ],
    }]]);

    renderRun();

    expect(screen.getByText('Po 7:00–15:30')).toBeInTheDocument();
  });

  it('warns when the van would arrive to a closed gate', () => {
    suppliersById.value = new Map([['sup-linde', {
      id: 'sup-linde',
      openingHours: [
        // Opens two hours after the run sets off.
        new SupplierOpeningHoursDto({ dayOfWeek: DayOfWeek.Monday, from: '09:30:00', to: '15:30:00' }),
      ],
    }]]);

    renderRun();

    expect(screen.getByText('Po 9:30–15:30 · zavřeno')).toBeInTheDocument();
  });

  it('says nothing about hours for a supplier with no schedule', () => {
    renderRun();

    // Scoped: Přehled zastávek names the same stop, and this is about the Vykládka's row.
    const list = within(screen.getByTestId('unload-list'));
    expect(list.getByText('Linde Gas')).toBeInTheDocument();
    expect(list.queryByText(/zavřeno/)).not.toBeInTheDocument();
  });
});

// Nobody tracks the van: the drivers ring in, and the office ticks the stop off here. Only while
// the run is on the road — which is also the only state the endpoint takes it in.
// The map's stats bar is where the route is read, so the run's own departure belongs among them.
// The stat itself is covered in RouteMap.test.tsx; this is only that the screen hands its date over.
describe('ShipmentDetail — the departure on the map', () => {
  it("passes the run's date and time to the map", () => {
    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Loaded, driverIds: [],
      deliveryDate: new Date(2026, 7, 26, 7, 30),
      stops: [officialStop()],
    });
    render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );

    expect(routeMapProps).toHaveBeenCalled();
    const last = routeMapProps.mock.calls.at(-1)![0] as { startAt?: Date };
    expect(last.startAt).toEqual(new Date(2026, 7, 26, 7, 30));
  });

  it('hands over nothing for a run with no date yet', () => {
    renderDetail([officialStop()]);

    const last = routeMapProps.mock.calls.at(-1)![0] as { startAt?: Date };
    expect(last.startAt).toBeUndefined();
  });
});

describe('ShipmentDetail — marking a stop finished', () => {
  // The spy is hoisted and shared with every other test in this file, so calls from the previous
  // one would otherwise be read as this one's.
  beforeEach(() => setStopCompletionMutate.mockClear());

  function renderRun(state: OutgoingShipmentState, editable = true, completedAt?: Date) {
    const stop = officialStop();
    if (completedAt) (stop as unknown as { completedAt?: Date }).completedAt = completedAt;

    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state, driverIds: [],
      deliveryDate: new Date(2026, 7, 24, 7, 30),
      vehicleId: 'van-1',
      stops: [stop],
    });
    return render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable={editable} canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );
  }

  /** The Vykládka's own mark button, inside the list rather than the header. */
  const markButtons = () => within(screen.getByTestId('unload-list'))
    .queryAllByRole('button', { name: /^(Označit jako hotovo|Hotovo .* kliknutím zrušit)$/ });

  it('writes the mark against the stop while the run is on the road', () => {
    renderRun(OutgoingShipmentState.InTransit);

    fireEvent.click(markButtons()[0]);

    expect(setStopCompletionMutate).toHaveBeenCalledTimes(1);
    expect(setStopCompletionMutate.mock.calls[0][0]).toEqual({ stopId: 'stop-2', isCompleted: true });
  });

  it('takes the mark back on a stop already finished', () => {
    renderRun(OutgoingShipmentState.InTransit, true, new Date(2026, 7, 24, 14, 32));

    fireEvent.click(markButtons()[0]);

    expect(setStopCompletionMutate.mock.calls[0][0]).toEqual({ stopId: 'stop-2', isCompleted: false });
  });

  // Before departure there is nothing to have finished; afterwards the marks are a record. The
  // endpoint refuses both, so offering the button would only produce a 400.
  it.each([
    ['naloženo', OutgoingShipmentState.Loaded],
    ['doručeno', OutgoingShipmentState.Delivered],
  ])('offers no mark off the road (%s)', (_label, state) => {
    renderRun(state);
    // The loading card opens on Nakládka before departure, so put the list on screen first.
    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    expect(markButtons()).toHaveLength(0);
  });

  it('offers no mark to a viewer who cannot edit, but still shows when the stop was done', () => {
    renderRun(OutgoingShipmentState.InTransit, false, new Date(2026, 7, 24, 14, 32));

    const list = within(screen.getByTestId('unload-list'));
    expect(markButtons()).toHaveLength(0);
    expect(list.getByText('14:32')).toBeInTheDocument();
  });
});

describe('ShipmentDetail — departure readiness', () => {
  function renderRun(over: Partial<IOutgoingShipmentDetailDto>) {
    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Loaded,
      deliveryDate: new Date('2026-08-27T00:00:00Z'),
      vehicleId: 'van-1',
      driverIds: ['driver-1'],
      drivers: [new ShipmentDriverDto({ id: 'driver-1', firstName: 'Jan', lastName: 'Řidič' })],
      stops: [officialStop()],
      ...over,
    });
    return render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );
  }

  const departButton = () => screen.getByRole('button', { name: 'Vyrazit' });

  it('lets a fully planned run leave', () => {
    renderRun({});

    expect(departButton()).toBeEnabled();
  });

  it('refuses to send a run out with nobody driving it', () => {
    renderRun({ driverIds: [], drivers: [] });

    expect(departButton()).toBeDisabled();
  });

  // Not a driver-only check: it mirrors the whole of HasFilledData, so a run whose van was never
  // picked is held back too, rather than 400ing on click.
  it('holds back a run with no van', () => {
    renderRun({ vehicleId: undefined });

    expect(departButton()).toBeDisabled();
  });

  it('still blocks delivery of a run that lost its driver on the road', () => {
    renderRun({ state: OutgoingShipmentState.InTransit, driverIds: [], drivers: [] });

    expect(screen.getByRole('button', { name: 'Doručit' })).toBeDisabled();
  });

  // Loading has its own, laxer rule on the API side (stops only), so the readiness check must not
  // reach back and gate it.
  it('leaves loading alone on a run with no driver', () => {
    renderRun({ state: OutgoingShipmentState.Created, driverIds: [], drivers: [] });

    expect(screen.getByRole('button', { name: 'Naložit' })).toBeEnabled();
  });
});

describe('ShipmentDetail — export', () => {
  beforeEach(() => {
    exportShipmentMutate.mockReset();
    downloadBlob.mockReset();
    enqueueSnackbar.mockReset();
    exportShipmentPending.value = false;
  });

  /** Opens the drawer and picks a format, the way a user does. */
  function pickFormat(label: 'Excel' | 'Word') {
    fireEvent.click(screen.getByRole('button', { name: /^Export/ }));
    fireEvent.click(screen.getByRole('button', { name: label }));
  }

  // Exporting is reading, so it must not disappear on a run the office can no longer edit —
  // a delivered shipment is exactly when the file is wanted.
  it('offers the export on a read-only shipment', () => {
    renderDetail([officialStop()]);

    expect(screen.getByRole('button', { name: /^Export/ })).toBeEnabled();
  });

  // The button must not export: which rows go into the file is the whole point of the drawer, and
  // a button that fired one on click would send the lot every time.
  it('opens the drawer rather than exporting straight away', () => {
    renderDetail([officialStop()]);

    expect(screen.queryByTestId('export-drawer')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Export/ }));

    expect(exportShipmentMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('export-drawer')).toBeInTheDocument();
  });

  it.each([
    ['Excel', 'excel'],
    ['Word', 'word'],
  ] as const)('exports the shipment being viewed as %s', (label, format) => {
    renderDetail([officialStop()]);

    pickFormat(label);

    expect(exportShipmentMutate).toHaveBeenCalledTimes(1);
    expect(exportShipmentMutate.mock.calls[0][0])
      .toEqual({ id: 'ship-1', format, clientIds: ['client-a'] });
  });

  it('saves the file under the name the server sent', () => {
    renderDetail([officialStop()]);

    pickFormat('Word');

    const blob = new Blob(['docx']);
    const { onSuccess } = exportShipmentMutate.mock.calls[0][1];
    act(() => onSuccess({ data: blob, fileName: 'vyvoz-2026-08-03-rozvoz-zitava.docx', status: 200 }));

    expect(downloadBlob).toHaveBeenCalledWith(blob, 'vyvoz-2026-08-03-rozvoz-zitava.docx');
  });

  // A proxy that strips Content-Disposition would otherwise save the file as "undefined" — and the
  // fallback has to carry the extension of the format that was actually asked for, or the file
  // opens in the wrong program.
  it.each([
    ['Excel', 'vyvoz.xlsx'],
    ['Word', 'vyvoz.docx'],
  ] as const)('falls back to a %s-shaped name when the response carries none', (label, expected) => {
    renderDetail([officialStop()]);

    pickFormat(label);

    const blob = new Blob(['bytes']);
    const { onSuccess } = exportShipmentMutate.mock.calls[0][1];
    act(() => onSuccess({ data: blob, fileName: undefined, status: 200 }));

    expect(downloadBlob).toHaveBeenCalledWith(blob, expected);
  });

  it('closes the drawer once the file is saved', () => {
    renderDetail([officialStop()]);

    pickFormat('Excel');

    const { onSuccess } = exportShipmentMutate.mock.calls[0][1];
    act(() => onSuccess({ data: new Blob(['x']), fileName: 'vyvoz.xlsx', status: 200 }));

    expect(screen.queryByTestId('export-drawer')).toBeNull();
  });

  // The selection took work to make; a failed export must not throw it away.
  it('leaves the drawer open when the export fails', () => {
    renderDetail([officialStop()]);

    pickFormat('Excel');

    const { onError } = exportShipmentMutate.mock.calls[0][1];
    act(() => onError(new Error('boom')));

    expect(screen.getByTestId('export-drawer')).toBeInTheDocument();
  });

  it('surfaces a failed export instead of saving nothing silently', () => {
    renderDetail([officialStop()]);

    pickFormat('Excel');

    const { onError } = exportShipmentMutate.mock.calls[0][1];
    act(() => onError(new Error('boom')));

    expect(downloadBlob).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), { variant: 'error' });
  });

  // Generating the file is a server round trip; a button that stays live invites a second click
  // and a second file.
  it('disables the button while the export is running', () => {
    exportShipmentPending.value = true;
    renderDetail([officialStop()]);

    expect(screen.getByRole('button', { name: 'Exportuji…' })).toBeDisabled();
  });
});

describe('ShipmentDetail — stop header on Přehled zastávek', () => {
  it('shows the place chip and its formatted address for a DeliveryPlace stop', () => {
    renderDetail([placeStop()]);

    const row = screen.getByTestId('overview-row');
    expect(within(row).getByText('Letní zahrádka')).toBeInTheDocument();
    expect(within(row).getByText('Nábřežní 3, 02763 Žitava')).toBeInTheDocument();
    // The address line must not repeat the place name — formatPlaceAddress
    // only ever formats the address part, the chip already carries the name.
    expect(within(row).queryByText(/Letní zahrádka ·/)).not.toBeInTheDocument();
  });

  // The address alone, with no "· Fakturační" tail: which of a client's addresses a stop
  // uses only matters where it can be changed, and that is the shipment editor — which
  // still shows the kind on its own rows.
  it('shows the address without its kind label, and no chip, for a stop on the official address', () => {
    renderDetail([officialStop()]);

    const row = screen.getByTestId('overview-row');
    expect(within(row).getByText('Náměstí 14, 02763 Žitava')).toBeInTheDocument();
    expect(within(row).queryByText(/Fakturační/)).not.toBeInTheDocument();
    expect(within(row).queryByText('Letní zahrádka')).not.toBeInTheDocument();
  });

  // Regression guard: the branch this review's fix replaced compared
  // `selectedAddressKind` directly against the numeric Contact member, which
  // never matches the server's string wire form and fell through to the
  // official address instead — pinning and displaying the wrong stop. Still worth
  // asserting now that the label is gone: the resolved *address* is the tell.
  it('resolves a Contact stop to the contact address, and shows no place chip', () => {
    renderDetail([contactStop()]);

    const row = screen.getByTestId('overview-row');
    expect(within(row).getByText('Dvůr 2a, 02763 Žitava')).toBeInTheDocument();
    expect(within(row).queryByText(/Kontaktní/)).not.toBeInTheDocument();
    expect(within(row).queryByText('Letní zahrádka')).not.toBeInTheDocument();
  });
});

// Where "Přehled zastávek" lives: handed to the route map, which folds it away behind
// the trip stats' chevron. That folding is RouteMap's own business and is covered in
// RouteMap.test.tsx — the stub here renders the panel outright, so what these assert is
// that the screen hands the map a populated list and keeps no second copy of it.
/** The "Přehled zastávek" card, wherever it is currently placed. */
function stopsOverviewCard(): HTMLElement {
  return screen.getByText('Přehled zastávek').closest('.MuiCard-root') as HTMLElement;
}

describe('ShipmentDetail — where Přehled zastávek is placed', () => {
  it('hands the stop list to the route map', () => {
    renderDetail([officialStop()]);

    const map = screen.getByTestId('route-map-stub');
    expect(within(map).getByText('Přehled zastávek')).toBeInTheDocument();
    // The rows come with it, rather than the heading alone.
    expect(within(map).getByText('Restaurace B')).toBeInTheDocument();
  });

  it('keeps no second copy of the card outside the map', () => {
    renderDetail([officialStop()]);

    expect(screen.getAllByText('Přehled zastávek')).toHaveLength(1);
  });

  it('counts stops, not orders, beside the heading', () => {
    renderDetail([officialStop()]);

    expect(screen.getByText('1 zastávka')).toBeInTheDocument();
  });

  it('reports an empty run as having no stops', () => {
    renderDetail([]);

    expect(screen.getByText('Žádné zastávky.')).toBeInTheDocument();
  });
});

describe('ShipmentDetail — Přehled zastávek scrolls under a fixed header', () => {
  /** The element that actually scrolls: the one holding the stop rows. */
  function scrollingBody(): HTMLElement {
    return within(stopsOverviewCard()).getByTestId('stops-overview-body');
  }

  // The heading and the count have to stay put while the stops move under them, which they can
  // only do by living outside the scrollport — sticky would have nothing to stick to, since the
  // card clips.
  it('scrolls the list, not the card', () => {
    renderDetail([officialStop()]);

    const body = getComputedStyle(scrollingBody());
    expect(body.overflowY).toBe('auto');
    // Reaching the last stop must not chain the scroll on to the page.
    expect(body.overscrollBehavior).toBe('contain');

    // The card itself does not scroll — otherwise the header would travel with the rows.
    expect(getComputedStyle(stopsOverviewCard()).overflowY).not.toBe('auto');
  });

  it('keeps the header out of the scrolling element', () => {
    renderDetail([officialStop()]);

    const heading = within(stopsOverviewCard()).getByText('Přehled zastávek');
    expect(scrollingBody().contains(heading)).toBe(false);
  });
});

describe('ShipmentDetail — the route follows the garage split at once', () => {
  const SUPPLIER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

  /**
   * A run carrying one supplier good of 2 pieces, with the stops the server would actually have
   * given that split: a pickup stop while anything is still fetched, the warehouse while anything
   * comes off our shelf. Building it consistently matters — a fixture whose stops contradict its
   * split would let a broken prediction look right.
   */
  function runWithSplit(quantityFromGarage: number) {
    const stops = [officialStop()];

    if (quantityFromGarage < 2) {
      stops.push(new OutgoingShipmentStopDto({
        id: 'supplier-stop-1',
        order: stops.length + 1,
        kind: 'Supplier' as unknown as OutgoingShipmentStopKind,
        label: 'Linde Gas',
        supplierId: SUPPLIER_ID,
        latitude: 50.77,
        longitude: 15.05,
        products: [],
        returns: [],
      }));
    }

    if (quantityFromGarage > 0) {
      stops.push(new OutgoingShipmentStopDto({
        id: 'company-stop-1',
        order: stops.length + 1,
        kind: 'Company' as unknown as OutgoingShipmentStopKind,
        label: 'Sklad AleTrack',
        products: [],
        returns: [],
      }));
    }

    return {
      state: OutgoingShipmentState.Created,
      stops,
      supplierGoods: [
        new OutgoingShipmentSupplierGoodDto({
          id: 'line-1',
          supplierGoodId: 'g-co2',
          name: 'CO₂ láhev',
          quantity: 2,
          quantityFromGarage,
          supplierId: SUPPLIER_ID,
          supplierName: 'Linde Gas',
        }),
      ],
    };
  }

  // The complaint this guards: the stop list waited for the run to be re-read, so a stop nobody
  // was driving to stayed on the list. The mocked mutation here never settles, so only the
  // client-side prediction can move it.
  it('drops the pickup stop as soon as the last piece moves to the garage', () => {
    renderDetail(runWithSplit(1), undefined, { editable: true });
    expect(within(stopsOverviewCard()).getByText('Linde Gas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Přidat z garáže — CO₂ láhev' }));

    expect(within(stopsOverviewCard()).queryByText('Linde Gas')).not.toBeInTheDocument();
    // The warehouse is still needed — every piece now comes off our shelf.
    expect(within(stopsOverviewCard()).getByText('Sklad AleTrack')).toBeInTheDocument();
  });

  it('brings the pickup stop back as soon as a piece moves off the garage', () => {
    renderDetail(runWithSplit(2), undefined, { editable: true });
    expect(within(stopsOverviewCard()).queryByText('Linde Gas')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ubrat z garáže — CO₂ láhev' }));

    expect(within(stopsOverviewCard()).getByText('Linde Gas')).toBeInTheDocument();
  });

  it('drops the warehouse stop when the last garage piece goes back to the supplier', () => {
    renderDetail(runWithSplit(1), undefined, { editable: true });
    expect(within(stopsOverviewCard()).getByText('Sklad AleTrack')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ubrat z garáže — CO₂ láhev' }));

    expect(within(stopsOverviewCard()).queryByText('Sklad AleTrack')).not.toBeInTheDocument();
    expect(within(stopsOverviewCard()).getByText('Linde Gas')).toBeInTheDocument();
  });

  it('recounts the stops with it', () => {
    renderDetail(runWithSplit(1), undefined, { editable: true });
    expect(screen.getByText('3 zastávky')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Přidat z garáže — CO₂ láhev' }));

    expect(screen.getByText('2 zastávky')).toBeInTheDocument();
  });

  // The map's road route re-resolves whenever the stops change, and the drawn line falls back to a
  // straight one until it answers. The veil covers exactly the window in which the screen is
  // showing a predicted route it has not had confirmed.
  it('veils the map while the change is being confirmed', () => {
    renderDetail(runWithSplit(1), undefined, { editable: true });
    expect(screen.getByTestId('route-map-stub')).toHaveAttribute('data-busy', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Přidat z garáže — CO₂ láhev' }));

    expect(screen.getByTestId('route-map-stub')).toHaveAttribute('data-busy', 'true');
  });

  it('moves the stepper number in the same breath', () => {
    renderDetail(runWithSplit(0), undefined, { editable: true });

    fireEvent.click(screen.getByRole('button', { name: 'Přidat z garáže — CO₂ láhev' }));

    const row = screen.getAllByTestId('supplier-good-row')[0];
    expect(within(row).getByText('1')).toBeInTheDocument();
  });
});

describe('ShipmentDetail — reordering the stops', () => {
  function supplierStop() {
    return new OutgoingShipmentStopDto({
      id: 'supplier-stop-1',
      order: 2,
      kind: 'Supplier' as unknown as OutgoingShipmentStopKind,
      label: 'Linde Gas',
      latitude: 50.77,
      longitude: 15.05,
      products: [],
      returns: [],
    });
  }

  /** An editable run — the route is content, so it only moves while still being planned. */
  function renderPlanned() {
    return renderDetail({
      state: OutgoingShipmentState.Created,
      stops: [officialStop(), supplierStop()],
    }, undefined, { editable: true });
  }

  it('moves a stop down, posting the whole new sequence as stop ids', () => {
    renderPlanned();

    fireEvent.click(screen.getByRole('button', { name: 'Posunout níže — Restaurace B' }));

    expect(reorderStopsMutate).toHaveBeenCalledTimes(1);
    // The whole route, as *stop* ids — not the order id the row is keyed by.
    expect(reorderStopsMutate.mock.calls[0][0]).toEqual(['supplier-stop-1', 'stop-2']);
  });

  it('moves a stop up', () => {
    renderPlanned();

    fireEvent.click(screen.getByRole('button', { name: 'Posunout výše — Linde Gas' }));

    expect(reorderStopsMutate.mock.calls[0][0]).toEqual(['supplier-stop-1', 'stop-2']);
  });

  // The flicker this guards against: the cache patch lands a commit *later* than the click, and
  // dnd-kit animates a dropped row back to where it started unless the order changes in the same
  // render. The rows must already be resequenced on the click, with no new data from the server —
  // the mocked mutation never settles here, so nothing but the local pending order can do it.
  it('shows the new order immediately, before the server answers', () => {
    renderPlanned();

    const before = within(stopsOverviewCard()).getAllByTestId('overview-row')
      .map((r) => r.textContent);
    expect(before[0]).toMatch(/Restaurace B/);

    fireEvent.click(screen.getByRole('button', { name: 'Posunout níže — Restaurace B' }));

    const after = within(stopsOverviewCard()).getAllByTestId('overview-row')
      .map((r) => r.textContent);
    expect(after[0]).toMatch(/Linde Gas/);
    expect(after[1]).toMatch(/Restaurace B/);
  });

  // The list's numbers are the map pins' numbers, so they have to move together — otherwise the
  // row says 2 while its pin still says 1 until the refetch lands.
  it('renumbers the map pins in the same breath', () => {
    renderPlanned();

    fireEvent.click(screen.getByRole('button', { name: 'Posunout níže — Restaurace B' }));

    const { stops } = routeMapProps.mock.calls.at(-1)![0] as { stops: { label: string; seq?: number }[] };
    expect(stops.map((st) => [st.seq, st.label])).toEqual([
      [1, 'Linde Gas'],
      [2, 'Restaurace B'],
    ]);
  });

  // Nothing to move past, so the control is dead rather than posting a no-op.
  it('disables each direction at its end of the route', () => {
    renderPlanned();

    expect(screen.getByRole('button', { name: 'Posunout výše — Restaurace B' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Posunout níže — Linde Gas' })).toBeDisabled();
  });

  it('offers a drag handle beside the arrows', () => {
    renderPlanned();

    expect(screen.getAllByLabelText('Přetáhnout zastávku')).toHaveLength(2);
  });

  // The route is content: the export, the unload list and the invoice ordering read the stop
  // order, and the snapshot taken when the truck is packed depends on it.
  it('withdraws the controls once the run is loaded', () => {
    renderDetail({
      state: OutgoingShipmentState.Loaded,
      stops: [officialStop(), supplierStop()],
    }, undefined, { editable: true });

    expect(screen.queryByRole('button', { name: /Posunout/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Přetáhnout zastávku')).not.toBeInTheDocument();
  });

  it('withdraws them from a read-only viewer', () => {
    renderDetail({
      state: OutgoingShipmentState.Created,
      stops: [officialStop(), supplierStop()],
    });

    expect(screen.queryByRole('button', { name: /Posunout/ })).not.toBeInTheDocument();
  });

  // One stop is already in order; offering to move it is noise.
  it('offers nothing on a single-stop run', () => {
    renderDetail({ state: OutgoingShipmentState.Created, stops: [officialStop()] }, undefined, { editable: true });

    expect(screen.queryByRole('button', { name: /Posunout/ })).not.toBeInTheDocument();
  });
});

describe('ShipmentDetail — non-delivery stops in Přehled zastávek', () => {
  /** A supplier pickup stop as the backend sends one — enum as its string name. */
  function supplierStop() {
    return new OutgoingShipmentStopDto({
      id: 'supplier-stop-1',
      order: 2,
      kind: 'Supplier' as unknown as OutgoingShipmentStopKind,
      label: 'Linde Gas',
      supplierId: 'aaaaaaaa-0000-0000-0000-000000000001',
      supplierAddress: new AddressDto({
        streetName: 'Průmyslová', streetNumber: '3', city: 'Liberec', zip: '46001',
        country: Country.Czechia, latitude: 50.77, longitude: 15.05,
      }),
      latitude: 50.77,
      longitude: 15.05,
      products: [],
      returns: [],
    });
  }

  it('lists a supplier pickup stop with its address', () => {
    renderDetail({ stops: [officialStop(), supplierStop()] });

    const card = within(stopsOverviewCard());
    expect(card.getByText('Linde Gas')).toBeInTheDocument();
    expect(card.getByText('Průmyslová 3, 46001 Liberec')).toBeInTheDocument();
  });

  it('counts it among the stops', () => {
    renderDetail({ stops: [officialStop(), supplierStop()] });

    expect(screen.getByText('2 zastávky')).toBeInTheDocument();
  });

  // The reason the list carries every kind: its numbers are the map pins' numbers. With the
  // list filtered to order stops, the second delivery read as "2" while its pin said "3".
  it('numbers the stops the same way the map does', () => {
    renderDetail({
      stops: [
        officialStop(),
        supplierStop(),
        new OutgoingShipmentStopDto({
          id: 'order-stop-2', order: 3, orderId: 'order-9', clientId: 'client-c',
          clientName: 'Hospoda C', officialAddress: new AddressDto({
            streetName: 'Dlouhá', streetNumber: '1', city: 'Liberec', zip: '46001',
            country: Country.Czechia, latitude: 50.7, longitude: 15.0,
          }),
          selectedAddressKind: 'Official' as unknown as DeliveryAddressKind,
          products: [], returns: [],
        }),
      ],
    });

    // What the map was handed.
    const { stops } = routeMapProps.mock.calls.at(-1)![0] as { stops: { label: string; seq?: number }[] };
    expect(stops.map((st) => [st.seq, st.label])).toEqual([
      [1, 'Restaurace B'],
      [2, 'Linde Gas'],
      [3, 'Hospoda C'],
    ]);

    // And the same numbers in the list beside them.
    const rows = within(stopsOverviewCard()).getAllByTestId('overview-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('2')).toBeInTheDocument();
    expect(within(rows[2]).getByText('3')).toBeInTheDocument();
  });

  it('offers no order link on a pickup stop, which has no order behind it', () => {
    renderDetail({ stops: [supplierStop()] }, vi.fn());

    expect(screen.queryByRole('button', { name: 'Linde Gas' })).not.toBeInTheDocument();
    expect(screen.getByText('Linde Gas')).toBeInTheDocument();
  });
});

describe('ShipmentDetail — opening a stop\'s order', () => {
  it('opens the order from the client name', () => {
    const onOpenOrder = vi.fn();
    renderDetail([officialStop()], onOpenOrder);

    fireEvent.click(screen.getByRole('button', { name: 'Restaurace B' }));

    expect(onOpenOrder).toHaveBeenCalledWith('order-2');
  });

  // Opening the order is the row's only action now that it no longer expands, so the
  // whole row is the mouse target — not just the name inside it.
  it('opens the order from anywhere in the row, including the address line', () => {
    const onOpenOrder = vi.fn();
    renderDetail([officialStop()], onOpenOrder);

    fireEvent.click(screen.getByText('Náměstí 14, 02763 Žitava'));

    expect(onOpenOrder).toHaveBeenCalledWith('order-2');
  });

  // The chevron and the per-row item count are gone: what is loaded for a stop is the
  // nakládka's account, and repeating it here left two places to read it from.
  it('offers no expander and no item count', () => {
    renderDetail([officialStop()], vi.fn());

    expect(screen.queryByRole('button', { name: /Rozbalit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sbalit/ })).not.toBeInTheDocument();
    expect(within(stopsOverviewCard()).queryByText(/položk/)).not.toBeInTheDocument();
  });

  // The page omits the callback for a user who cannot see the Objednávky
  // module; a link into a screen ProtectedRoute would bounce them off is worse
  // than no link at all.
  it('leaves the client name plain when the caller passes no handler', () => {
    renderDetail([officialStop()]);

    expect(screen.queryByRole('button', { name: 'Restaurace B' })).not.toBeInTheDocument();
    expect(screen.getByText('Restaurace B')).toBeInTheDocument();
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

  // The company address used to be a fixed DEPOT read from an env var and
  // hardcoded as both ends of every route. A run is loaded at a brewery and
  // only comes home to the company at the end, so the map's start must come
  // from the shipment's own resolved start point instead.
  it('draws the route from the shipment start point, not a fixed depot', () => {
    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Created, driverIds: [],
      stops: [officialStop()],
      startPointKind: ShipmentStartPointKind.Brewery,
      startPointName: 'Pivovar Svijany',
      startPointLatitude: 50.5,
      startPointLongitude: 15.0,
    });
    render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable={false} canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );

    expect(routeMapProps).toHaveBeenCalled();
    const { start } = routeMapProps.mock.calls.at(-1)![0];
    expect(start).toEqual({ lat: 50.5, lng: 15.0, name: 'Pivovar Svijany', address: undefined });
  });

  it('falls back to the company rather than plotting an ungeocoded start point at (0, 0)', () => {
    // A brewery whose address was never geocoded is a legal start point — the
    // start-points endpoint deliberately lists it. Coercing its missing
    // coordinates to zero drew the route from off the coast of Africa.
    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Created, driverIds: [],
      stops: [officialStop()],
      startPointKind: ShipmentStartPointKind.Brewery,
      startPointName: 'Pivovar bez adresy',
    });
    render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable={false} canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );

    const { start } = routeMapProps.mock.calls.at(-1)![0];
    expect(start).toEqual({ lat: 50.841437, lng: 14.837309, name: 'Sklad AleTrack', address: 'Turistická 211, 46334 Hrádek nad Nisou' });
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

// The detail DTO now resolves the vehicle and the assigned drivers server-side (the same
// pattern the start point already used), so a driver-scoped account — which gets a 403 from
// /vehicles/{id} and sees only itself in /drivers — still sees the full picture on its own
// shipment. See GetOutgoingShipmentDetailVehicleAndDriversTests.cs on the backend.
describe('ShipmentDetail — Vůz and Řidiči cards read from the inlined shipment data', () => {
  it('shows the resolved vehicle name and max weight without a separate vehicle request', () => {
    renderDetail({
      stops: [officialStop()],
      vehicleId: 'vehicle-1',
      vehicle: new ShipmentVehicleDto({ id: 'vehicle-1', name: 'Iveco Daily', maxWeight: 3500 }),
    });

    expect(screen.getByText('Iveco Daily')).toBeInTheDocument();
    expect(screen.getByText('Nosnost 3 500 kg')).toBeInTheDocument();
  });

  it('shows "Vůz nepřiřazen" when no vehicle is inlined', () => {
    renderDetail({ stops: [officialStop()] });

    expect(screen.getByText('Vůz nepřiřazen')).toBeInTheDocument();
  });

  // Seeds two drivers so a one-driver fixture could not coincidentally pass — the co-driver
  // silently disappearing from a driver-scoped account's own /drivers list was the bug.
  it('shows both assigned drivers, including the co-driver, with phone and colour', () => {
    renderDetail({
      stops: [officialStop()],
      driverIds: ['driver-adamec', 'driver-novak'],
      drivers: [
        new ShipmentDriverDto({ id: 'driver-adamec', firstName: 'Petr', lastName: 'Adamec', phoneNumber: '+420444555666', color: '#222222' }),
        new ShipmentDriverDto({ id: 'driver-novak', firstName: 'Jan', lastName: 'Novák', phoneNumber: '+420111222333', color: '#111111' }),
      ],
    });

    expect(screen.getByText('Petr Adamec')).toBeInTheDocument();
    expect(screen.getByText('+420444555666')).toBeInTheDocument();
    // The co-driver specifically — the one that used to vanish from a driver-scoped list.
    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    expect(screen.getByText('+420111222333')).toBeInTheDocument();
  });

  it('shows "Bez řidiče" when no drivers are inlined', () => {
    renderDetail({ stops: [officialStop()] });

    expect(screen.getByText('Bez řidiče')).toBeInTheDocument();
  });
});

// When the card is too narrow for its columns the nakládka drops the table and
// stacks, because reaching the loading control meant scrolling sideways — the one
// interaction the brewery ramp has no free hand for. What the swap must preserve:
// the ramp's own control stays reachable without expanding anything, and the desk
// controls stay reachable at all.
describe('ShipmentDetail — the nakládka table', () => {
  /** MUI's useMediaQuery reads window.matchMedia; happy-dom resolves it against a
   * 1024px window. Only one test needs it now — the one proving the layout no longer
   * forks on it. */
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
        <ShipmentDetail shipment={shipment} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );
  }

  it('heads the four columns and reads out the product', () => {
    renderNakladka();

    expect(screen.getByText('Produkt')).toBeInTheDocument();
    expect(screen.getByText('Ks')).toBeInTheDocument();
    expect(screen.getByText('Zdroj')).toBeInTheDocument();
    expect(screen.getByText('Faktury')).toBeInTheDocument();
    expect(screen.getByText('Roh. Cherry beer')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  /**
   * The regression this guards: the old layout forked on the viewport and on a measured
   * card width, rendering either a table or a stacked list. Widths are the container
   * query's business now, so a media query must not change what renders — a fork that
   * crept back would show up here as a difference between the two runs.
   */
  it('renders one layout whatever the media query says', () => {
    setCompact(true);
    const { container: narrow } = renderNakladka();
    const narrowRows = narrow.querySelectorAll('[data-testid="nakladka-row"]').length;
    const narrowTables = narrow.querySelectorAll('table').length;

    cleanup();
    setCompact(false);
    const { container: wide } = renderNakladka();

    expect(wide.querySelectorAll('[data-testid="nakladka-row"]').length).toBe(narrowRows);
    expect(narrowRows).toBe(1);
    // No <table> in either: the columns are a grid, so a section can slide without the
    // several sibling tables the old wide layout needed to keep its columns aligned.
    expect(wide.querySelectorAll('table').length).toBe(narrowTables);
    expect(narrowTables).toBe(0);
  });

  it('shows every control without an expander, so nothing costs a tap to reach', () => {
    renderNakladka();

    // No expander at all: an earlier revision hid the numbers behind one, and a list
    // that is worked through rather than skimmed pays that tap on every item.
    expect(screen.queryByLabelText('Rozbalit Roh. Cherry beer')).not.toBeInTheDocument();

    // Scoped to the row — "F1" is also the filter tab and the summary bar's label.
    const row = within(screen.getByTestId('nakladka-row'));
    expect(row.getByLabelText('Přidat kus z garáže')).toBeInTheDocument();
    // The invoice split is a typable field with steppers either side, the richer control
    // the wide table always had — the stacked layout's ±1-only pair is gone with it.
    expect(row.getByLabelText('Kusy na faktuře 2')).toBeInTheDocument();
    expect(row.getByLabelText('Kusy na faktuře 2 — přidat')).toBeInTheDocument();
    expect(row.getByText('F1')).toBeInTheDocument();
    expect(row.getByText('z pivovaru')).toBeInTheDocument();
  });

  /**
   * The three Zdroj lines are the row's own partition — what the brewery hands over,
   * what comes off our shelf instead, what we buy for the shelf — so all three are
   * there at zero too. Dropping the empty ones (which is what the shaping used to do)
   * both hid which of the three a number was and moved the remaining lines up, so the
   * same number sat on a different line of the cluster from one row to the next.
   */
  it('names all three sources on a row that only has one of them', () => {
    renderNakladka();

    // The product is ordered from the brewery outright: nothing off our shelf, nothing
    // bought for it.
    const row = within(screen.getByTestId('nakladka-row'));
    expect(row.getByText('z pivovaru')).toBeInTheDocument();
    expect(row.getByText('z garáže')).toBeInTheDocument();
    expect(row.getByText('do garáže')).toBeInTheDocument();
    // And the empty ones are steppable, so a piece can be moved onto them from here.
    expect(row.getByLabelText('Přidat kus do garáže')).toBeInTheDocument();
    expect(row.getByLabelText('Ubrat kus do garáže')).toBeDisabled();
  });

  it('gives every invoice its own state control, right next to its own number', () => {
    renderNakladka();

    // The product hasn't been split onto invoice 2 yet, so only F1 carries pieces —
    // but the row still owes F2 a chip, with a placeholder dash where its state control
    // would go. Losing that is what once left a single control off in the header.
    const row = within(screen.getByTestId('nakladka-row'));
    expect(row.getByLabelText('Nakládka na faktuře 1: Nenaloženo')).toBeInTheDocument();
    expect(row.getByText('F1')).toBeInTheDocument();
    expect(row.getByText('F2')).toBeInTheDocument();
    // The em dash is otherwise unused on this row, so its presence pins down the
    // F2 placeholder specifically.
    expect(row.getByText('—')).toBeInTheDocument();
  });

  it('commits a loading state straight off the row', () => {
    renderNakladka();

    fireEvent.click(screen.getByLabelText('Nakládka na faktuře 1: Nenaloženo'));

    expect(setLoadingStateMutate).toHaveBeenCalledTimes(1);
    expect(setLoadingStateMutate.mock.calls[0][0]).toMatchObject({
      productId: 'product-1', sequence: 1, state: 'Dictated',
    });
  });

  // A packed truck's loading list has already been acted on, so the table reads as finished from
  // Naloženo onwards. The office can still get in — a pallet miscounted on the ramp has to be
  // fixable — but by unlocking it on purpose, not by clicking a live stepper by accident.
  describe('the lock on a packed run', () => {
    function renderAt(state: OutgoingShipmentState) {
      const shipment = new OutgoingShipmentDetailDto({
        id: 'ship-1', name: 'Rozvoz Žitava', state, driverIds: [], stops: [stopWithProduct()],
        preparationSteps: [new OutgoingShipmentPreparationStepDto({
          id: 'step-1', order: 1, label: 'Zkontrolovat plachtu', isDone: false,
        })],
      });
      const result = render(
        <MuiThemeProvider theme={theme}>
          <ShipmentDetail shipment={shipment} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
        </MuiThemeProvider>,
      );
      // From Na cestě on, the card opens on Vykládka (loadingView.ts). Every assertion below is
      // about the loading list's own controls, so put it on screen first — the lock is about
      // whether they take edits, not about which tab is showing.
      fireEvent.click(screen.getByRole('button', { name: 'Nakládka' }));
      return result;
    }

    /** The sourcing stepper — gone entirely when the table takes no edits. */
    const stepper = () => screen.queryByLabelText('Přidat kus z garáže');
    /** The per-invoice loading control — kept, but disabled, so the row still reads out. */
    const loadingTick = () => screen.getByLabelText('Nakládka na faktuře 1: Nenaloženo');

    it.each([
      ['loaded', OutgoingShipmentState.Loaded],
      ['in transit', OutgoingShipmentState.InTransit],
    ])('locks every control on the table (%s)', (_label, state) => {
      renderAt(state);

      expect(screen.getByText('Uzamčeno')).toBeInTheDocument();
      expect(stepper()).not.toBeInTheDocument();
      expect(loadingTick()).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Faktura pivovaru' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Odemknout' })).toBeInTheDocument();
    });

    it('hands the table back, amber, once the office unlocks it', () => {
      renderAt(OutgoingShipmentState.Loaded);

      fireEvent.click(screen.getByRole('button', { name: 'Odemknout' }));

      expect(screen.getByText('Odemčeno')).toBeInTheDocument();
      expect(screen.getByText(/Úpravy nakládky provádějte jen v nutném případě/)).toBeInTheDocument();
      expect(stepper()).toBeInTheDocument();
      expect(loadingTick()).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Faktura pivovaru' })).toBeInTheDocument();
    });

    it('shuts it again on the second thought', () => {
      renderAt(OutgoingShipmentState.Loaded);

      fireEvent.click(screen.getByRole('button', { name: 'Odemknout' }));
      fireEvent.click(screen.getByRole('button', { name: 'Zamknout' }));

      expect(screen.getByText('Uzamčeno')).toBeInTheDocument();
      expect(stepper()).not.toBeInTheDocument();
    });

    it('says nothing about locks while the run is still being planned', () => {
      renderAt(OutgoingShipmentState.Created);

      expect(screen.queryByText('Uzamčeno')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Odemknout' })).not.toBeInTheDocument();
      expect(stepper()).toBeInTheDocument();
    });

    // A finished run is a record, not something to reopen: it locks with no way back in, which is
    // what it did before the unlock existed.
    it('offers no unlock on a delivered run', () => {
      renderAt(OutgoingShipmentState.Delivered);

      expect(screen.queryByRole('button', { name: 'Odemknout' })).not.toBeInTheDocument();
      expect(screen.queryByText('Uzamčeno')).not.toBeInTheDocument();
      expect(stepper()).not.toBeInTheDocument();
      expect(loadingTick()).toBeDisabled();
    });

    // The lock is the table's alone. The checklist is worked down while the van is packed and on
    // the road, so catching it would break the one card that most needs to stay live. (Fakturace
    // reads the same wider flag; its own editability is covered in ShipmentInvoicing.test.tsx,
    // and the query is stubbed empty here.)
    it('leaves the checklist tickable while the table is locked', () => {
      renderAt(OutgoingShipmentState.Loaded);

      expect(screen.getByLabelText('Zkontrolovat plachtu')).toBeEnabled();
    });
  });

  /** Two products of two breweries. Svijany's row is first in the data, while Frýdlant's
   *  lower display order puts its section on top — so the order proves the sections are
   *  not simply following the stop. */
  function renderTwoBreweries() {
    const stop = officialStop();
    stop.products = [
      new OutgoingShipmentOrderItemDto({
        id: 'product-svijany', orderItemId: 'item-svijany', name: 'Vozka 11°',
        kind: ProductKind.Bottle, packageSize: 0.5, platoDegree: 11, quantity: 2, weight: 10,
        quantityFromInventory: 0,
        breweryId: 'brewery-svijany', breweryName: 'Pivovar Svijany', breweryDisplayOrder: 2,
      }),
      new OutgoingShipmentOrderItemDto({
        id: 'product-frydlant', orderItemId: 'item-frydlant', name: 'Albrecht 12°',
        kind: ProductKind.Keg, packageSize: 30, platoDegree: 12, quantity: 1, weight: 60,
        quantityFromInventory: 0,
        breweryId: 'brewery-frydlant', breweryName: 'Pivovar Frýdlant', breweryDisplayOrder: 1,
      }),
    ];
    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Created,
      driverIds: [], stops: [stop],
    });
    return render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );
  }

  it('heads each brewery, with that brewery’s kinds under it', () => {
    const { container } = renderTwoBreweries();

    expect(screen.getByLabelText('Sbalit Pivovar Frýdlant')).toBeInTheDocument();
    expect(screen.getByLabelText('Sbalit Pivovar Svijany')).toBeInTheDocument();
    // One kind heading per brewery, each naming the kind its rows are of.
    expect(screen.getByText('Sud')).toBeInTheDocument();
    expect(screen.getByText('Basa')).toBeInTheDocument();

    // Frýdlant's display order is the lower one, so its block comes first — and its own
    // product with it.
    const text = container.textContent ?? '';
    expect(text.indexOf('Pivovar Frýdlant')).toBeLessThan(text.indexOf('Pivovar Svijany'));
    expect(text.indexOf('Albrecht 12°')).toBeLessThan(text.indexOf('Vozka 11°'));
  });

  it('marks each brewery head with that brewery’s own colour', () => {
    renderTwoBreweries();

    // The square is what makes a group boundary visible mid-list.
    const squares = screen.getAllByTestId('brewery-color');
    expect(squares[0]).toHaveStyle({ backgroundColor: '#F08C00' });
    // Svijany has no colour recorded, so its square falls back rather than repeating the
    // previous brewery's — that would mark the boundary wrong.
    expect(squares[1]).not.toHaveStyle({ backgroundColor: '#F08C00' });
  });

  it('collapses a brewery to its head, and expands it again', async () => {
    renderTwoBreweries();

    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Sbalit Pivovar Frýdlant'));

    // The section slides shut before it unmounts, so its rows are still there right after
    // the click — the wait is what the animation costs, not flakiness. The generous timeout
    // is for a loaded machine: the removal hangs off a transition timer, which a busy test
    // run can starve well past the default second.
    await waitForElementToBeRemoved(() => screen.queryByText('Albrecht 12°'), { timeout: 5000 });

    // Frýdlant's kind heading goes with its rows; the head and the other brewery stay.
    expect(screen.queryByText('Sud')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Rozbalit Pivovar Frýdlant')).toBeInTheDocument();
    expect(screen.getByText('Vozka 11°')).toBeInTheDocument();

    // Collapsing is presentation only — what is on the pallet has not changed, so the
    // summary bar still counts the hidden brewery's piece.
    expect(screen.getByText('Celkem k naložení').parentElement?.textContent).toContain('3');

    fireEvent.click(screen.getByLabelText('Rozbalit Pivovar Frýdlant'));
    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();
  });

  it('keeps the rows when a brewery is reopened mid-slide', async () => {
    renderTwoBreweries();

    fireEvent.click(screen.getByLabelText('Sbalit Pivovar Frýdlant'));
    // Reopened while the section is still closing: it must reverse rather than finish
    // shutting and unmount the rows behind the reader's back.
    fireEvent.click(screen.getByLabelText('Rozbalit Pivovar Frýdlant'));

    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();
    // Long enough for the shut that was cancelled to have finished, had it kept running.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();
  });
});

describe('ShipmentDetail — the Vykládka tab', () => {
  // Forces the stacked nakládka layout (data-testid="nakladka-row" only exists on that
  // row, never on the desktop table's <TableRow>) regardless of the environment's default
  // viewport. Without this, happy-dom's default 1024px window is above the `compact`
  // breakpoint and the card measures 0 wide (no ResizeObserver), so the loading list
  // renders as the plain table and never carries the testid at all — the "switching back
  // to Vše restores the table" assertion below would then pass or fail for reasons that
  // have nothing to do with the tab switch itself, which is exactly the kind of vacuous
  // test this feature has already shipped four of. Same stub as the "nakládka when the
  // columns do not fit" describe above (duplicated — its helpers are scoped to that block).
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width: 300 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** An order stop carrying a product, so the loading list has something to show —
   * without this, aggRows is empty and the table renders its own empty text instead
   * of any row at all, and the "restores the table" assertion could never observe a
   * nakladka-row regardless of what the tab switch does. */
  function unloadOrderStop(): OutgoingShipmentStopDto {
    const stop = officialStop();
    stop.order = 1;
    stop.products = [new OutgoingShipmentOrderItemDto({
      id: 'product-unload-1',
      orderItemId: 'item-unload-1',
      name: 'Ley 12',
      kind: ProductKind.Bottle,
      packageSize: 0.5,
      platoDegree: 12,
      quantity: 10,
      weight: 5,
      quantityFromInventory: 0,
    })];
    return stop;
  }

  /** A Custom stop unloads nothing of its own (unloadOrder.ts) — its `title` is the
   * whole rendered text of its heading line, which is what makes an exact-match
   * `getByText('Chrastava')` meaningful rather than a lucky substring hit inside a
   * longer formatted address string. */
  function chrastavaStop(): OutgoingShipmentStopDto {
    return new OutgoingShipmentStopDto({
      id: 'stop-chrastava',
      kind: OutgoingShipmentStopKind.Custom,
      order: 2,
      label: 'Chrastava',
      products: [],
      returns: [],
    });
  }

  const shipmentWithTwoStops = { stops: [unloadOrderStop(), chrastavaStop()] };

  it('swaps the loading table for the stop-by-stop list', () => {
    renderDetail(shipmentWithTwoStops);

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    // Scoped to the unload list: the stop list in the map names every stop too, so an
    // unscoped query now finds this custom stop twice.
    expect(within(screen.getByTestId('unload-list')).getByText('Chrastava')).toBeInTheDocument();
    expect(screen.queryByTestId('nakladka-row')).not.toBeInTheDocument();
    // The tab exists to show what comes off at each stop — assert the payload
    // itself, not just that the tab swapped. Without these, a dropped quantity,
    // an omitted chip, or an inverted "has lines" check would leave every
    // assertion above still green.
    expect(screen.getByText('Ley 12')).toBeInTheDocument();
    expect(screen.getByText('× 10')).toBeInTheDocument();
    // The Custom stop (Chrastava) unloads nothing by construction — its own
    // placeholder, not a second copy of the order stop's content.
    expect(screen.getByText('Bez vykládky')).toBeInTheDocument();
  });

  it('warns on a vykládka stop whose client has no address', async () => {
    // Same stop as 'swaps the loading table for the stop-by-stop list' above, but its
    // client has neither address at all — a sub-client billed through its payer (see the
    // linked-clients-invoicing feature) can be saved that way.
    const stop = unloadOrderStop();
    stop.officialAddress = undefined;
    stop.contactAddress = undefined;
    renderDetail({ stops: [stop, chrastavaStop()] });

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    expect(await screen.findByLabelText('Klient nemá vyplněnou dodací adresu')).toBeInTheDocument();
  });

  it("opens the stop's order from its name, and drops the address-kind tail", () => {
    const onOpenOrder = vi.fn();
    renderDetail(shipmentWithTwoStops, onOpenOrder);

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    const list = within(screen.getByTestId('unload-list'));
    fireEvent.click(list.getByRole('button', { name: 'Restaurace B' }));
    expect(onOpenOrder).toHaveBeenCalledWith('order-2');

    // Which of the client's addresses it is only matters where it can be changed, and that is
    // the editor — the same reason Přehled zastávek drops the tail.
    expect(list.queryByText(/Fakturační/)).toBeNull();
  });

  it('says what each line is and how much the stop takes', () => {
    renderDetail(shipmentWithTwoStops);

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    const list = within(screen.getByTestId('unload-list'));
    // Kind first: what the driver reaches for, and the only thing separating one package of a
    // beer from another.
    expect(list.getByText('Basa · 0,5 l · 12°')).toBeInTheDocument();
    // And the stop's own count, to check the handover against.
    expect(list.getByText('10 ks')).toBeInTheDocument();
  });

  it("hides the nakládka's own actions while the unload view is up", () => {
    // Both buttons add to the loading list, which the unload view does not show — offering them
    // there invites an edit whose effect is invisible on screen.
    renderDetail(shipmentWithTwoStops, undefined, { editable: true });

    expect(screen.getByRole('button', { name: /Zboží na sklad/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faktura pivovaru/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    expect(screen.queryByRole('button', { name: /Zboží na sklad/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Faktura pivovaru/ })).toBeNull();
  });

  it("reads out the order's supplier goods at its stop", () => {
    // The wiring, not the shaping (unloadOrder.test.ts covers that): these goods hang off the
    // shipment rather than off the stop, so a screen that forgot to hand them over would show
    // the driver a stop missing half its delivery.
    renderDetail({
      ...shipmentWithTwoStops,
      supplierGoods: [
        new OutgoingShipmentSupplierGoodDto({
          id: 'line-1', name: 'CO₂ láhev', size: '10 kg', quantity: 2, orderId: 'order-2',
        }),
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    const list = within(screen.getByTestId('unload-list'));
    expect(list.getByText('CO₂ láhev')).toBeInTheDocument();
    expect(list.getByText('× 2')).toBeInTheDocument();
  });

  it('names the start point above the numbered stops', () => {
    renderDetail({ ...shipmentWithTwoStops, startPointName: 'Pivovar Svijany' });

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    expect(screen.getByText(/Pivovar Svijany/)).toBeInTheDocument();
    // Pins the "the start point is never itself a numbered stop" contract:
    // unloadOrder() renumbers 1..N over the stops alone, so the two stops here
    // must read 1 and 2, not 0 and 1 (which a bug prepending the start point
    // into the numbered list would produce) and not 2 and 3 (appending it).
    // Scoped to the seq badges themselves (data-testid) rather than a bare
    // getByText('1') — a plain "1" or "2" also appears elsewhere on the
    // screen (e.g. the progress pills' "n/n" counts), which a bare text match
    // would collide with.
    const seqBadges = screen.getAllByTestId('unload-stop-seq').map((el) => el.textContent);
    expect(seqBadges).toEqual(['1', '2']);
  });

  it('keeps the invoice tabs reachable from the unload view', () => {
    renderDetail(shipmentWithTwoStops);

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nakládka' }));

    expect(screen.getAllByTestId('nakladka-row').length).toBeGreaterThan(0);
  });
});

describe('ShipmentDetail — the back arrow', () => {
  function renderWithBackLabel(backLabel?: string) {
    const shipment = new OutgoingShipmentDetailDto({
      id: 'ship-1', name: 'Rozvoz Žitava', state: OutgoingShipmentState.Created, driverIds: [], stops: [],
    });
    return render(
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail shipment={shipment} editable={false} onBack={vi.fn()} backLabel={backLabel} onEdit={vi.fn()} />
      </MuiThemeProvider>,
    );
  }

  it('goes back to the vývozy list by default', () => {
    renderWithBackLabel();

    expect(screen.getByRole('button', { name: 'Zpět na vývozy' })).toBeInTheDocument();
  });

  // A vývoz opened from an order's Vývoz card returns to that order, so the
  // arrow has to say so — on a phone its label is the only cue for where Back
  // leads. Hardcoding "Zpět na vývozy" here dropped the caller silently.
  it('names the caller screen when one was passed', () => {
    renderWithBackLabel('Zpět na objednávku');

    expect(screen.getByRole('button', { name: 'Zpět na objednávku' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zpět na vývozy' })).not.toBeInTheDocument();
  });
});
