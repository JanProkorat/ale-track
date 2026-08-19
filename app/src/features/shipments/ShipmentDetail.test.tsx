// What ShipmentDetail decides about the stop header on "Přehled zastávek":
// a stop delivering to a client's saved place shows a small chip with the
// place name and its formatted address below (never repeating the name); any
// other stop keeps the plain `address · kind` line unchanged. The pure
// resolution behind both is covered directly in stopAddress.test.ts.

import { type ReactNode } from 'react';
import { render, screen, within, fireEvent, waitForElementToBeRemoved, act } from '@testing-library/react';
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
  type IOutgoingShipmentDetailDto,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
  OutgoingShipmentSupplierGoodDto,
  ProductKind,
  ShipmentDriverDto,
  ShipmentStartPointKind,
  ShipmentVehicleDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

// Hoisted rather than a fresh spy per call so the export tests can assert what was surfaced.
const enqueueSnackbar = vi.hoisted(() => vi.fn());
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
  useExportShipment: () => ({ mutate: exportShipmentMutate, isPending: exportShipmentPending.value }),
  // String "kind" here, deliberately not the numeric enum member — the real
  // backend serializes every enum as its string name (JsonStringEnumConverter,
  // Program.cs), and the screen must resolve the company entry through that
  // wire shape (see startPointKindName in src/lib/labels.ts), not by comparing
  // against ShipmentStartPointKind.Company directly.
  useShipmentStartPoints: () => ({ data: startPointsData.value, isPending: false, isError: false }),
}));
vi.mock('src/hooks/useInventory', () => ({ useInventory: () => ({ data: [], isLoading: false }) }));
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

    expect(screen.queryByRole('button', { name: 'Zboží na sklad' })).not.toBeInTheDocument();
    // The rest of the nakládka header stays live: the freeze is about content, not progress.
    expect(screen.getByRole('button', { name: 'Faktura pivovaru' })).toBeInTheDocument();
  });
});

describe('ShipmentDetail — export', () => {
  beforeEach(() => {
    exportShipmentMutate.mockReset();
    downloadBlob.mockReset();
    enqueueSnackbar.mockReset();
    exportShipmentPending.value = false;
  });

  /** Opens the format menu and picks one, the way a user does. */
  function pickFormat(label: 'Excel' | 'Word') {
    fireEvent.click(screen.getByRole('button', { name: /^Export/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${label}`) }));
  }

  // Exporting is reading, so it must not disappear on a run the office can no longer edit —
  // a delivered shipment is exactly when the file is wanted.
  it('offers the export on a read-only shipment', () => {
    renderDetail([officialStop()]);

    expect(screen.getByRole('button', { name: /^Export/ })).toBeEnabled();
  });

  // The button itself must not export: picking a format is the whole point of the menu, and a
  // button that fired Excel on click would make the Word item unreachable in one gesture.
  it('opens a format menu rather than exporting straight away', () => {
    renderDetail([officialStop()]);

    fireEvent.click(screen.getByRole('button', { name: /^Export/ }));

    expect(exportShipmentMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: /^Excel/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Word/ })).toBeInTheDocument();
  });

  it.each([
    ['Excel', 'excel'],
    ['Word', 'word'],
  ] as const)('exports the shipment being viewed as %s', (label, format) => {
    renderDetail([officialStop()]);

    pickFormat(label);

    expect(exportShipmentMutate).toHaveBeenCalledTimes(1);
    expect(exportShipmentMutate.mock.calls[0][0]).toEqual({ id: 'ship-1', format });
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
        <ShipmentDetail shipment={shipment} editable canSeeInvoicing canSeeLoadingBreakdown onBack={vi.fn()} onEdit={vi.fn()} />
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

  it('gives every invoice its own state control, right next to its own number', () => {
    setCompact(true);
    renderNakladka();

    // The product hasn't been split onto invoice 2 yet, so only F1 carries pieces —
    // but the row still owes F2 a slot (a placeholder dash) alongside its stepper,
    // same as the desktop table does. Losing that slot is what made only one
    // control show up at all, off in the header rather than by its own invoice.
    const row = within(screen.getByTestId('nakladka-row'));
    expect(row.getByLabelText('Nakládka na faktuře 1: Nenaloženo')).toBeInTheDocument();
    expect(row.getByText('F1')).toBeInTheDocument();
    expect(row.getByText('F2')).toBeInTheDocument();
    // The em dash is otherwise unused on this row, so its presence pins down the
    // F2 placeholder specifically.
    expect(row.getByText('—')).toBeInTheDocument();
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

  it('heads each brewery of the table, with that brewery’s kinds under it', () => {
    setCompact(false);
    setCardWidth(900);
    const { container } = renderTwoBreweries();

    // Each brewery owns a table of its own, labelled with its name — that is what lets
    // Collapse slide a section without the rows leaving the layout of the others.
    const frydlant = screen.getByRole('table', { name: 'Pivovar Frýdlant' });
    // The kind heading is the only cell in it that spans the columns.
    expect([...frydlant.querySelectorAll('td[colspan]')].map((c) => c.textContent))
      .toEqual(['Sud1 položka']);
    expect(within(frydlant).getByText('Albrecht 12°')).toBeInTheDocument();

    const svijany = screen.getByRole('table', { name: 'Pivovar Svijany' });
    expect([...svijany.querySelectorAll('td[colspan]')].map((c) => c.textContent))
      .toEqual(['Basa1 položka']);
    expect(within(svijany).getByText('Vozka 11°')).toBeInTheDocument();

    // Frýdlant's display order is the lower one, so its block comes first.
    const text = container.textContent ?? '';
    expect(text.indexOf('Pivovar Frýdlant')).toBeLessThan(text.indexOf('Pivovar Svijany'));
  });

  it('keeps the brewery sections when the list stacks', () => {
    setCompact(true);
    const { container } = renderTwoBreweries();

    // The brewery names appear nowhere else on the screen, so their positions in the
    // rendered text are the section order.
    const text = container.textContent ?? '';
    expect(text).toContain('Pivovar Frýdlant');
    expect(text.indexOf('Pivovar Frýdlant')).toBeLessThan(text.indexOf('Pivovar Svijany'));
  });

  it('keeps the columns of the head, the sections and the totals lined up', () => {
    setCompact(false);
    setCardWidth(900);
    const { container } = renderTwoBreweries();

    // The wide layout is four tables — head, one per brewery, totals — so that a section
    // can slide. They line up only because Produkt is declared elastic in each of them
    // while every other column is a fixed width; dropping that on any one table would
    // knock its rows out of line with the head.
    const tables = [...container.querySelectorAll('table')];
    expect(tables).toHaveLength(4);
    for (const table of tables) {
      const firstColumnCell = [...table.querySelectorAll('th,td')]
        .find((cell) => !cell.hasAttribute('colspan'));
      expect(firstColumnCell).toHaveStyle({ width: '100%' });
    }
  });

  it('marks each brewery head with that brewery’s own colour', () => {
    setCompact(false);
    setCardWidth(900);
    renderTwoBreweries();

    // The square is what makes a group boundary visible mid-list.
    const squares = screen.getAllByTestId('brewery-color');
    expect(squares[0]).toHaveStyle({ backgroundColor: '#F08C00' });
    // Svijany has no colour recorded, so its square falls back rather than repeating the
    // previous brewery's — that would mark the boundary wrong.
    expect(squares[1]).not.toHaveStyle({ backgroundColor: '#F08C00' });
  });

  it('collapses a brewery to its head, and expands it again', async () => {
    setCompact(false);
    setCardWidth(900);
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
    // totals row still counts the hidden brewery's piece.
    const totals = screen.getByText('Celkem k naložení').closest('tr');
    expect(totals?.textContent).toContain('3 ks');

    fireEvent.click(screen.getByLabelText('Rozbalit Pivovar Frýdlant'));
    expect(screen.getByText('Albrecht 12°')).toBeInTheDocument();
  });

  it('keeps the rows when a brewery is reopened mid-slide', async () => {
    setCompact(false);
    setCardWidth(900);
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

  it('collapses the stacked list the same way', async () => {
    setCompact(true);
    renderTwoBreweries();

    fireEvent.click(screen.getByLabelText('Sbalit Pivovar Svijany'));

    await waitForElementToBeRemoved(() => screen.queryByText('Vozka 11°'), { timeout: 5000 });
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
