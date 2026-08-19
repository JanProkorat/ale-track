import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Card, Checkbox, Chip, IconButton, ListSubheader, MenuItem,
  Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicatorOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import PropaneOutlinedIcon from '@mui/icons-material/PropaneOutlined';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { EmptyState } from 'src/components/common/EmptyState';
import { RouteMap, type RouteStop, type RouteEndpoint } from 'src/components/common/RouteMap';
import { haversine } from 'src/lib/geo';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, num } from 'src/lib/format';
import { regionLabel, shipStateName, addrKindValue, startPointKindName, stopKindName } from 'src/lib/labels';
import {
  type OutgoingShipmentOrderDto,
  type Region,
  OutgoingShipmentState,
  DeliveryAddressKind,
  ClientOrderShipmentDto,
  CustomStopDto,
  RoutePointDto,
  CreateOutgoingShipmentDto,
  UpdateOutgoingShipmentDto,
  PreparationStepDto,
  ShipmentStartPointKind,
  OutgoingShipmentStopKind,
} from 'src/generated/api-client';
import {
  useShipment, useCreateShipment, useUpdateShipment, useAvailableOrders, useShipmentStartPoints,
} from 'src/hooks/useShipments';
import { useUnsavedChangesGuard, UnsavedChangesDialog } from 'src/components/common/UnsavedChangesGuard';
import { useVehicles } from 'src/hooks/useVehicles';
import { useDrivers } from 'src/hooks/useDrivers';
import { useClients } from 'src/hooks/useClients';
import { colorForClient } from './clientColor';
import { draftFromShipment } from './shipmentDraft';
import { CustomStopDialog, type CustomStopResult } from 'src/components/common/CustomStopDialog';
import { DeliveryPlaceDialog } from 'src/components/common/DeliveryPlaceDialog';
import { AddressChangedBanner } from './AddressChangedBanner';
import { PreparationStepsEditor } from './PreparationStepsEditor';
import { defaultChecklistSteps, type DraftStep } from './preparationStepModel';
import { resolveStopAddress } from './stopAddress';
import { suppliersNeedingPickup, needsGarageStop } from './pickupStopPrediction';
import { NEW_PLACE_CHOICE, decodeStopChoice, encodeStopChoice } from 'src/features/clients/deliveryAddress';
import { StartPointPicker } from './StartPointPicker';
import { optionKey, routeEndpointFrom, type StartPointValue } from './startPointOption';

interface DraftStop {
  /** Stable client-side identity: the orderId for order stops, or a generated
   *  id for custom/company stops. Used as the sortable/dnd key. */
  key: string;
  kind: 'order' | 'custom' | 'company';
  order: number;
  addressKind: DeliveryAddressKind;
  // order stops
  orderId?: string;
  /** Set only when addressKind is DeliveryPlace. Undefined for a freshly
   *  toggled order or when Official/Contact is chosen. */
  deliveryPlaceId?: string;
  // custom and company stops
  customId?: string; // existing custom/company stop's PublicId (undefined when new)
  label?: string;
  note?: string;
  lat?: number;
  lng?: number;
}

/** Serialized snapshot of the savable state, for unsaved-change detection. */
function serializeShipment(name: string, date: Dayjs | null, vehicleId: string | null, driverIds: string[], stops: DraftStop[], viaPoints: { lat: number; lng: number }[], steps: DraftStep[], startPoint: StartPointValue): string {
  return JSON.stringify({
    name: name.trim(),
    date: date ? date.toISOString() : null,
    vehicleId,
    driverIds: [...driverIds].sort(),
    stops: stops.map((s) => ({ kind: s.kind, order: s.order, orderId: s.orderId ?? null, customId: s.customId ?? null, label: s.label ?? null, note: s.note ?? null, lat: s.lat ?? null, lng: s.lng ?? null, addressKind: s.addressKind, deliveryPlaceId: s.deliveryPlaceId ?? null })),
    vias: viaPoints.map((v) => ({ lat: v.lat, lng: v.lng })),
    // Position matters (it is the order the steps are worked in), so this is the array order,
    // not a sorted copy. The local `key` is left out — it changes per session.
    steps: steps.map((s) => ({ id: s.id ?? null, label: s.label.trim() })),
    // `kind` and `addressKind` are both normalized to a single concrete representation
    // rather than passed through (or bare-coalesced) as-is — the load path and the
    // picker hand this function the same logical choice through different shapes, and a
    // literal-value comparison must not tell those shapes apart:
    //  - `kind`: the loaded shipment's own `startPointKind` may already be a wire string
    //    ('Company'/'Brewery') or, when the shipment records none, the *numeric*
    //    fallback `ShipmentStartPointKind.Company` (see `loadedStartPoint` above); a
    //    freshly picked entry's `kind` is always whatever wire shape the start-points
    //    list carries. `startPointKindName` collapses both to the same string.
    //  - `addressKind`: the loaded baseline's is always a concrete wire string in
    //    production ('Official' even for a company-kind run — the detail DTO's field is
    //    non-nullable, so a company run persists Official as its meaningless-but-present
    //    value), while a freshly picked company entry carries no addressKind of its own
    //    (`undefined`, after StartPointPicker's null-coalesce for the Critical fix).
    //    `addrKindValue` collapses both to the same concrete member instead of leaving
    //    `undefined`/`null` as a value distinct from `'Official'`.
    // Without both normalized the same way, picking a brewery and then picking the
    // company back leaves this snapshot different from the baseline and spuriously
    // flags the form dirty — confirmed by running the regression test below against
    // each partial fix before landing on this one.
    startPoint: {
      kind: startPointKindName(startPoint.kind) ?? 'Company',
      breweryId: startPoint.breweryId ?? null,
      addressKind: addrKindValue(startPoint.addressKind),
    },
  });
}

function SortableStopRow({
  stop, index, order, total, locked, deletedPlaceName, companyAddress, hasStockPurchases, onMove, onRemove, onAddrChoice,
}: {
  stop: DraftStop;
  index: number;
  order?: OutgoingShipmentOrderDto;
  total: number;
  locked?: boolean;
  /** Name of the stop's chosen delivery place as it was when the shipment
   *  was loaded, used only when that place no longer appears in
   *  `order.clientDeliveryPlaces` (soft-deleted since). */
  deletedPlaceName?: string;
  /** The company start-point entry's address — a company stop's second line,
   *  resolved live from `useShipmentStartPoints()` rather than the stop's own
   *  stored fields (mirrors StartPointPicker). Unused for order/custom rows. */
  companyAddress?: string;
  /** Whether the run currently carries stock purchases — while it does, the
   *  server re-adds a removed company stop on save. Unused for order/custom
   *  rows. */
  hasStockPurchases?: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  /** Raw <Select> value — 'Official' | 'Contact' | `place:<id>` | the
   *  '+ Nové místo…' sentinel. Decoding (and the sentinel) is the parent's
   *  job since opening the dialog needs the client id, not just the stop. */
  onAddrChoice: (value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.key, disabled: locked });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const isOrder = stop.kind === 'order';
  const isCompany = stop.kind === 'company';
  const places = order?.clientDeliveryPlaces ?? [];
  // Gated on `deletedPlaceName` (not just "missing from the list"), because a
  // place is *also* briefly missing from the list right after "+ Nové
  // místo…" creates it — before the orders query has refetched. That case has
  // no `deletedPlaceName` (this stop never loaded a place from the server), so
  // it must not render as a soft-deleted "(smazáno)" entry; a genuine
  // soft-delete always has one, since `deliveryPlaceId` and `deletedPlaceName`
  // both come from the same loaded `stop.deliveryPlace`.
  const isGone = stop.addressKind === DeliveryAddressKind.DeliveryPlace
    && deletedPlaceName != null
    && !places.some((p) => p.id === stop.deliveryPlaceId);
  const addressText = isOrder ? resolveStopAddress(order, stop.addressKind, stop.deliveryPlaceId).text : undefined;
  const title = isCompany ? (stop.label || 'Firemní sklad') : isOrder ? (order?.clientName ?? '—') : (stop.label || 'Vlastní zastávka');
  const subtitle = isCompany ? companyAddress : isOrder ? addressText : (stop.note || 'Vlastní zastávka');
  const deleteTooltip = isCompany && hasStockPurchases
    ? 'Dokud je v nakládce zboží na sklad, zastávka se po uložení vrátí.'
    : '';
  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
    >
      {!locked && (
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', color: 'text.disabled', display: 'flex', touchAction: 'none' }}>
          <DragIndicatorIcon fontSize="small" />
        </Box>
      )}
      <Box sx={{
        width: 28, height: 28, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
        borderRadius: isOrder ? '50%' : '4px',
        transform: isOrder ? undefined : 'rotate(45deg)',
        bgcolor: isOrder ? colorForClient(order?.clientName ?? stop.key) : '#1A2B4C',
      }}>
        {isCompany ? (
          <WarehouseOutlinedIcon sx={{ fontSize: 15, transform: 'rotate(-45deg)' }} />
        ) : (
          <Box component="span" sx={{ transform: isOrder ? undefined : 'rotate(-45deg)' }}>{index + 1}</Box>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{title}</Typography>
        {/* Prototype's stopAddressText prefixes this with the order number
         * (`o.number + ' · '`); OutgoingShipmentOrderDto carries no such
         * field, so that prefix is dropped here — a data-model deviation,
         * not a design one. */}
        <Typography sx={{ fontSize: 11.5 }} color="text.secondary" noWrap>
          {subtitle}
        </Typography>
      </Box>
      {isOrder && (
        <Select
          size="small"
          value={encodeStopChoice(stop.addressKind, stop.deliveryPlaceId)}
          disabled={locked}
          onChange={(e) => onAddrChoice(e.target.value)}
          sx={{ width: 190, flexShrink: 0 }}
        >
          <MenuItem value="Official">Fakturační</MenuItem>
          {order?.clientContactAddress && <MenuItem value="Contact">Kontaktní</MenuItem>}
          {places.length > 0 && [
            <ListSubheader key="places-header">Vlastní místa</ListSubheader>,
            ...places.map((p) => (
              <MenuItem key={p.id} value={encodeStopChoice(DeliveryAddressKind.DeliveryPlace, p.id)}>{p.name}</MenuItem>
            )),
          ]}
          {isGone && deletedPlaceName && [
            <ListSubheader key="gone-header">Smazané</ListSubheader>,
            <MenuItem key="gone-item" value={encodeStopChoice(DeliveryAddressKind.DeliveryPlace, stop.deliveryPlaceId)} disabled>
              {deletedPlaceName + ' (smazáno)'}
            </MenuItem>,
          ]}
          <MenuItem value={NEW_PLACE_CHOICE}>+ Nové místo…</MenuItem>
        </Select>
      )}
      {!locked && (
        <>
          <IconButton size="small" onClick={() => onMove(-1)} disabled={index === 0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => onMove(1)} disabled={index === total - 1} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
          <Tooltip title={deleteTooltip}>
            <IconButton size="small" onClick={onRemove} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, color: 'error.main' }}>
              <DeleteOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}

/** Vývoz editor: draggable stop ordering + nearest-neighbour route
 * optimizer + order selection with a region filter, plus vehicle/driver
 * assignment. Matches the prototype's viewShipmentEditor/seOptimize/seSave. */
/**
 * A pickup stop the save will create, shown before it exists.
 *
 * Read-only by nature rather than by choice: it has no identity yet, so there is nothing to drag,
 * remove or address. The label says so, because a row that looked like the others but ignored every
 * control would read as broken. Once saved, the detail screen's stop list can place it.
 */
function PickupPreviewRow({ seq, label, isCompany }: { seq: number; label: string; isCompany: boolean }) {
  return (
    <Box
      data-testid="pickup-preview-row"
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25,
        border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2,
        bgcolor: 'action.hover',
      }}
    >
      {/* The drag column, left empty so these rows line up with the ones above them. */}
      <Box sx={{ width: 20, flexShrink: 0 }} />
      <Box sx={{
        width: 28, height: 28, display: 'grid', placeItems: 'center', flexShrink: 0,
        borderRadius: '4px', transform: 'rotate(45deg)', bgcolor: 'text.disabled', color: '#fff',
      }}
      >
        <Box component="span" sx={{ transform: 'rotate(-45deg)', fontSize: 12, fontWeight: 800 }}>{seq}</Box>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          {isCompany
            ? <WarehouseOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            : <PropaneOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />}
          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{label}</Typography>
        </Stack>
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
          {isCompany ? 'Vyzvednutí z garáže — přidá se po uložení' : 'Vyzvednutí u dodavatele — přidá se po uložení'}
        </Typography>
      </Box>
    </Box>
  );
}

export function ShipmentEditor({
  mode,
  shipmentId,
  onDone,
  onCancel,
}: {
  mode: 'create' | 'edit';
  shipmentId?: string;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();

  const shipmentQuery = useShipment(mode === 'edit' ? shipmentId : undefined);
  const availableQuery = useAvailableOrders(shipmentId);
  const vehiclesQuery = useVehicles();
  const driversQuery = useDrivers();
  const clientsQuery = useClients();
  const createShipment = useCreateShipment();
  const updateShipment = useUpdateShipment();
  const startPointsQuery = useShipmentStartPoints();

  const [name, setName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<Dayjs | null>(dayjs().add(2, 'day').hour(7).minute(0).second(0));
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [driverIds, setDriverIds] = useState<string[]>([]);
  const [stops, setStops] = useState<DraftStop[]>([]);
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [customStopOpen, setCustomStopOpen] = useState(false);
  const [viaPoints, setViaPoints] = useState<{ lat: number; lng: number }[]>([]);
  // The stop currently getting a brand-new delivery place via "+ Nové
  // místo…" — the place is written straight to the client on save (an
  // already-approved design choice, not deferred to the shipment draft), so
  // this only needs to remember which stop to apply the result to.
  const [newPlaceTarget, setNewPlaceTarget] = useState<{ stopKey: string; clientId: string; clientName?: string } | null>(null);
  // A new shipment starts with the standard pre-departure checklist already filled in — it is the
  // same list every time, and it stays editable, so this is a starting point rather than a rule.
  // Edit mode starts empty and the load effect below fills it from the server.
  const [steps, setSteps] = useState<DraftStep[]>(() => (mode === 'create' ? defaultChecklistSteps() : []));
  // Defaults to the company — that is what every run started at before this
  // picker existed. Edit mode overwrites this from the loaded shipment below.
  const [startPoint, setStartPoint] = useState<StartPointValue>({ kind: ShipmentStartPointKind.Company });
  const loadedRef = useRef(false);
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode === 'create') baselineRef.current = serializeShipment(name, deliveryDate, vehicleId, driverIds, stops, viaPoints, steps, startPoint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || loadedRef.current || !shipmentQuery.data) return;
    const s = shipmentQuery.data;
    loadedRef.current = true;
    const loadedName = s.name ?? '';
    const loadedDate = s.deliveryDate ? dayjs(s.deliveryDate) : null;
    const loadedVehicle = s.vehicleId ?? null;
    const loadedDrivers = s.driverIds ?? [];
    const loadedStops: DraftStop[] = (s.stops ?? [])
      .slice()
      // Supplier pickup stops are derived by the server from what the orders ask for, and it
      // carries them across a save itself. Loading them here would echo them back as custom
      // stops — duplicating each one and letting the planner rename a stop it does not own.
      .filter((st) => stopKindName(st.kind) !== 'Supplier')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((st, i): DraftStop => st.orderId != null
        ? {
            key: st.orderId, kind: 'order', orderId: st.orderId, addressKind: addrKindValue(st.selectedAddressKind), order: i + 1,
            deliveryPlaceId: st.deliveryPlace?.id,
          }
        : {
            key: st.id ?? `custom-${i}`,
            // `stopKindName` (not a raw `=== OutgoingShipmentStopKind.Company`) because the
            // backend serializes this enum as a JSON string — see stopKindName's own comment.
            kind: stopKindName(st.kind) === 'Company' ? 'company' : 'custom',
            customId: st.id,
            label: st.label ?? '',
            note: st.note,
            lat: st.latitude,
            lng: st.longitude,
            addressKind: DeliveryAddressKind.Official,
            order: i + 1,
          });
    const loadedVias = (s.routeViaPoints ?? []).map((p) => ({ lat: p.latitude ?? 0, lng: p.longitude ?? 0 }));
    const loadedSteps: DraftStep[] = (s.preparationSteps ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((st) => ({ key: st.id ?? `step-${st.order ?? 0}`, id: st.id, label: st.label ?? '' }));
    const loadedStartPoint: StartPointValue = {
      kind: s.startPointKind ?? ShipmentStartPointKind.Company,
      breweryId: s.startBreweryId,
      addressKind: s.startBreweryAddressKind,
    };
    setName(loadedName);
    setDeliveryDate(loadedDate);
    setVehicleId(loadedVehicle);
    setDriverIds(loadedDrivers);
    setStops(loadedStops);
    setViaPoints(loadedVias);
    setSteps(loadedSteps);
    setStartPoint(loadedStartPoint);
    baselineRef.current = serializeShipment(loadedName, loadedDate, loadedVehicle, loadedDrivers, loadedStops, loadedVias, loadedSteps, loadedStartPoint);
  }, [mode, shipmentQuery.data]);

  // Once the shipment is Loaded (or beyond), its order composition and vehicle
  // are fixed — only drivers (and name/date) may still change. Created is open.
  // (State arrives as a string from the API; normalize before comparing.)
  const lockedStateName = shipStateName(shipmentQuery.data?.state);
  const structureLocked = mode === 'edit' && lockedStateName != null && lockedStateName !== 'Created';
  // The preparation checklist follows the loading rule instead: it is still being worked through
  // while the run is Loaded and InTransit, and only a delivered or cancelled run freezes it.
  const stepsLocked = mode === 'edit' && ['Delivered', 'Cancelled'].includes(lockedStateName ?? '');

  const availableOrders = useMemo(() => availableQuery.data ?? [], [availableQuery.data]);
  const orderById = useMemo(() => new Map(availableOrders.map((o) => [o.id ?? '', o])), [availableOrders]);

  // OutgoingShipmentOrderDto carries no clientId/region — join by client name
  // against useClients() (best-effort; demo/real client names are unique) so
  // the prototype's region filter still works with the data this endpoint
  // actually provides.
  const regionByClientName = useMemo(() => {
    const m = new Map<string, Region | undefined>();
    for (const c of clientsQuery.data ?? []) if (c.name) m.set(c.name, c.region);
    return m;
  }, [clientsQuery.data]);

  // Same best-effort name join, needed here to hand a clientId to
  // <DeliveryPlaceDialog> when "+ Nové místo…" is picked — the available-order
  // DTO carries clientName but no clientId.
  const clientIdByClientName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientsQuery.data ?? []) if (c.name && c.id) m.set(c.name, c.id);
    return m;
  }, [clientsQuery.data]);

  // Name of each order stop's delivery place as loaded from the shipment —
  // kept only to label the "(smazáno)" MenuItem for a place that has since
  // been soft-deleted off the client (and so no longer appears in
  // order.clientDeliveryPlaces). Derived straight from the read model rather
  // than carried on DraftStop, since it's display-only and never resaved.
  const loadedPlaceNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const st of shipmentQuery.data?.stops ?? []) {
      if (st.orderId && st.deliveryPlace?.name) m.set(st.orderId, st.deliveryPlace.name);
    }
    return m;
  }, [shipmentQuery.data]);

  const usedOrderIds = useMemo(() => new Set(stops.filter((s) => s.kind === 'order').map((s) => s.orderId)), [stops]);
  const ordersWithRegion = useMemo(
    () => availableOrders.map((o) => ({ order: o, region: regionByClientName.get(o.clientName ?? '') })),
    [availableOrders, regionByClientName],
  );
  const regionsPresent = useMemo(
    () => Array.from(new Set(ordersWithRegion.map((x) => x.region).filter((r) => r != null))),
    [ordersWithRegion],
  );
  const shownOrders = regionFilter === 'all'
    ? ordersWithRegion
    : ordersWithRegion.filter((x) => String(x.region) === regionFilter || usedOrderIds.has(x.order.id ?? ''));

  // The company entry regardless of which start point is currently picked — a
  // company *stop* (dropped off at the warehouse mid-route) is independent of
  // where the run *starts* from, so this is looked up separately from
  // `pickedStartPoint` below. Feeds a freshly-added company stop's display
  // coordinates/label, every company row's address line, and the warehouse
  // pickup preview.
  const companyStartPoint = (startPointsQuery.data ?? []).find((p) => optionKey(p) === 'company');
  const hasStockPurchases = Boolean(shipmentQuery.data?.stockPurchases?.length);

  const stopsSorted = useMemo(() => stops.slice().sort((a, b) => a.order - b.order), [stops]);

  // Every supplier-good line the picked orders bring with them.
  const pickedSupplierGoods = useMemo(
    () => stopsSorted
      .filter((st) => st.kind === 'order' && st.orderId)
      .flatMap((st) => orderById.get(st.orderId!)?.supplierGoods ?? []),
    [stopsSorted, orderById],
  );

  /**
   * The pickup stops saving would create, shown here as previews.
   *
   * Previews rather than draft stops on purpose: these are derived from what the orders ask for,
   * and the server is the one thing that creates them — the editor never sends them, exactly as it
   * never sends the supplier stops it filters out on load. Showing them is what stops "add an order
   * with a CO₂ refill" from looking like it changed nothing about the route.
   *
   * A supplier already sitting in the draft as a real stop is not previewed again.
   */
  const pickupPreviews = useMemo(() => {
    const suppliers = suppliersNeedingPickup(pickedSupplierGoods);
    const previews = suppliers.map((sup) => ({
      key: `preview-supplier-${sup.supplierId}`,
      kind: 'supplier' as const,
      label: sup.supplierName ?? '—',
      lat: sup.latitude,
      lng: sup.longitude,
    }));

    // The warehouse, when a garage-sourced piece or a stock purchase calls for one and the planner
    // has not already placed the stop by hand.
    if (needsGarageStop(pickedSupplierGoods, hasStockPurchases) && !stopsSorted.some((st) => st.kind === 'company')) {
      previews.push({
        key: 'preview-company',
        kind: 'company' as unknown as 'supplier',
        label: companyStartPoint?.name ?? 'Firemní sklad',
        lat: companyStartPoint?.latitude,
        lng: companyStartPoint?.longitude,
      });
    }

    return previews;
  }, [pickedSupplierGoods, hasStockPurchases, stopsSorted, companyStartPoint]);

  const routeStops: RouteStop[] = useMemo(() => [...stopsSorted.map((st, i): RouteStop => {
    // RouteMap only distinguishes 'order' vs. 'custom' waypoints — a company
    // stop renders the same diamond marker a custom stop does; that map isn't
    // this task's to extend, and visually the two aren't meant to differ.
    if (st.kind === 'custom' || st.kind === 'company') {
      const fallbackLabel = st.kind === 'company' ? 'Firemní sklad' : 'Vlastní zastávka';
      return {
        lat: st.lat, lng: st.lng, label: st.label || fallbackLabel,
        color: '#1A2B4C', kind: 'custom', seq: i + 1,
      };
    }
    const order = orderById.get(st.orderId ?? '');
    const pt = resolveStopAddress(order, st.addressKind, st.deliveryPlaceId);
    return {
      lat: pt.lat, lng: pt.lng, label: order?.clientName ?? '—',
      color: colorForClient(order?.clientName ?? st.key), kind: 'order', seq: i + 1,
    };
  }),
  // Drawn with the drafted stops so the route — and the distance and time read off it — is the
  // one that will actually be driven, not the one before the pickups were accounted for.
  ...pickupPreviews.map((p, i): RouteStop => ({
    lat: p.lat, lng: p.lng, label: p.label, color: '#1A2B4C', kind: 'custom',
    seq: stopsSorted.length + i + 1,
  })),
  ], [stopsSorted, orderById, pickupPreviews]);

  // The picker's own choice drives the route's origin. While that reference-data
  // query hasn't resolved (or the picked entry isn't in it yet), a synthetic
  // (0, 0) would plant a marker at null island — there is always better
  // information on screen instead: the shipment's own previously-saved start
  // point (edit mode), or failing that the first stop that already has real
  // coordinates. Only a brand-new, stop-less shipment with the query still
  // pending or failed has nothing real to fall back to; `knownStart` says so
  // explicitly and the render below skips RouteMap entirely then rather than
  // draw a route anchored at (0, 0).
  const pickedStartPoint = (startPointsQuery.data ?? []).find((p) => optionKey(p) === optionKey(startPoint));
  const hasCompanyStop = stops.some((s) => s.kind === 'company');
  const savedStart: RouteEndpoint | undefined = mode === 'edit'
    && shipmentQuery.data?.startPointLatitude != null
    && shipmentQuery.data?.startPointLongitude != null
    ? {
      lat: shipmentQuery.data.startPointLatitude,
      lng: shipmentQuery.data.startPointLongitude,
      name: shipmentQuery.data.startPointName ?? '—',
      address: shipmentQuery.data.startPointAddress,
    }
    : undefined;
  const firstLocatedStop = routeStops.find((s) => s.lat != null && s.lng != null);
  // `routeEndpointFrom` yields undefined for a start point with no coordinates —
  // a brewery whose address was never geocoded is a legal pick — so such a pick
  // falls through the same cascade a not-yet-loaded one does rather than
  // anchoring the map (and the optimizer) at (0, 0).
  const knownStart: RouteEndpoint | undefined = routeEndpointFrom(pickedStartPoint)
    ?? savedStart
    ?? (firstLocatedStop ? { lat: firstLocatedStop.lat!, lng: firstLocatedStop.lng!, name: firstLocatedStop.label } : undefined);
  // The run comes home: the route always ends at the company, wherever it
  // started. Falls back to the start only while the start-points query has
  // nothing to offer, so the map draws one combined marker rather than a
  // second pin at (0, 0).
  const knownEnd: RouteEndpoint | undefined = routeEndpointFrom(companyStartPoint);
  // Internal-only: `stopCoords`/`optimizeRoute` need a concrete number to sort
  // by even in the no-real-point case, but that fallback never reaches
  // RouteMap (gated on `knownStart` below), so (0, 0) there only ever affects
  // a nearest-neighbour sort, never a rendered pin.
  const start: RouteEndpoint = knownStart ?? { lat: 0, lng: 0, name: '—' };

  const selectedVehicle = (vehiclesQuery.data ?? []).find((v) => v.id === vehicleId);
  const totalWeight = useMemo(() => stopsSorted.reduce((sum, st) => {
    if (st.kind !== 'order') return sum;
    const order = orderById.get(st.orderId ?? '');
    return sum + (order?.items ?? []).reduce((s, it) => s + (it.weight ?? 0) * (it.quantity ?? 0), 0);
  }, 0), [stopsSorted, orderById]);
  const overloaded = Boolean(selectedVehicle?.maxWeight != null && totalWeight > selectedVehicle.maxWeight);

  function driverAvailableOn(availableDates: { from?: Date }[] | undefined): boolean {
    if (!deliveryDate) return true;
    const day = deliveryDate.format('YYYY-MM-DD');
    return (availableDates ?? []).some((a) => a.from && dayjs(a.from).format('YYYY-MM-DD') === day);
  }

  function toggleOrder(orderId: string) {
    setStops((prev) => {
      if (prev.some((s) => s.kind === 'order' && s.orderId === orderId)) {
        return prev.filter((s) => !(s.kind === 'order' && s.orderId === orderId)).map((s, i) => ({ ...s, order: i + 1 }));
      }
      // Inherit the order's own delivery-address choice rather than defaulting
      // to Fakturační — `addrKindValue` is mandatory here: the API sends enum
      // names as strings while the generated TS enum is numeric, so the raw
      // field never `===` a member.
      const order = orderById.get(orderId);
      const inheritedKind = addrKindValue(order?.deliveryAddressKind);
      // The order's place list is filtered to non-deleted places (it backs the
      // picker), so a place the order chose before it was soft-deleted won't
      // be in it. Inheriting that id anyway would produce a stop the picker
      // can't render and the resolver 404s on save — fall back to Official
      // with no place instead, same as a brand-new stop would. Official/Contact
      // are unaffected: they carry no place id, so this only ever overrides
      // the DeliveryPlace case.
      const placeMissing = inheritedKind === DeliveryAddressKind.DeliveryPlace
        && order?.clientDeliveryPlaceId != null
        && !(order.clientDeliveryPlaces ?? []).some((p) => p.id === order.clientDeliveryPlaceId);
      return [...prev, {
        key: orderId,
        kind: 'order' as const,
        orderId,
        addressKind: placeMissing ? DeliveryAddressKind.Official : inheritedKind,
        deliveryPlaceId: placeMissing ? undefined : (order?.clientDeliveryPlaceId ?? undefined),
        order: prev.length + 1,
      }];
    });
  }
  function addCustomStop(stop: CustomStopResult) {
    if (stop.kind === 'company') {
      // No coordinates in the payload — the server authors a Company stop's
      // label and location itself (from configuration) and ignores whatever
      // the client sends. The company start-point entry is only used here to
      // give the freshly-added row something real to show before saving.
      setStops((prev) => [...prev, {
        key: `company-${crypto.randomUUID()}`,
        kind: 'company' as const,
        label: companyStartPoint?.name ?? 'Firemní sklad',
        lat: companyStartPoint?.latitude,
        lng: companyStartPoint?.longitude,
        addressKind: DeliveryAddressKind.Official,
        order: prev.length + 1,
      }]);
      return;
    }
    setStops((prev) => [...prev, {
      key: `custom-${crypto.randomUUID()}`,
      kind: 'custom' as const,
      label: stop.label,
      note: stop.note,
      lat: stop.lat,
      lng: stop.lng,
      addressKind: DeliveryAddressKind.Official,
      order: prev.length + 1,
    }]);
  }
  function moveStop(key: string, dir: -1 | 1) {
    setStops((prev) => {
      const arr = prev.slice().sort((a, b) => a.order - b.order);
      const i = arr.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return prev;
      [arr[i].order, arr[j].order] = [arr[j].order, arr[i].order];
      return arr.map((s) => ({ ...s }));
    });
  }
  function removeStop(key: string) {
    setStops((prev) => prev.filter((s) => s.key !== key).map((s, i) => ({ ...s, order: i + 1 })));
  }
  /** Handles the stop picker's raw <Select> value: either a decodable
   *  Official/Contact/place:<id> choice, or the '+ Nové místo…' sentinel,
   *  which opens the dialog instead of touching the stop directly. Because
   *  the Select's value is always derived from the stop's own state, not
   *  touching that state here is what makes a cancelled dialog "revert" —
   *  there's nothing to revert, the sentinel was never actually stored. */
  function handleAddrChoice(key: string, orderId: string | undefined, value: string) {
    if (value === NEW_PLACE_CHOICE) {
      const order = orderById.get(orderId ?? '');
      const clientId = clientIdByClientName.get(order?.clientName ?? '');
      if (!clientId) { enqueueSnackbar('Nelze určit klienta pro nové místo.', { variant: 'error' }); return; }
      setNewPlaceTarget({ stopKey: key, clientId, clientName: order?.clientName });
      return;
    }
    const { addressKind, deliveryPlaceId } = decodeStopChoice(value);
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, addressKind, deliveryPlaceId } : s)));
  }
  function toggleDriver(id: string) {
    setDriverIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setStops((prev) => {
      const arr = prev.slice().sort((a, b) => a.order - b.order);
      const oldIndex = arr.findIndex((s) => s.key === active.id);
      const newIndex = arr.findIndex((s) => s.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(arr, oldIndex, newIndex).map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  const stopCoords = (s: DraftStop) => {
    if (s.kind !== 'order') return { lat: s.lat ?? start.lat, lng: s.lng ?? start.lng };
    const pt = resolveStopAddress(orderById.get(s.orderId ?? ''), s.addressKind, s.deliveryPlaceId);
    return { lat: pt.lat ?? start.lat, lng: pt.lng ?? start.lng };
  };

  function optimizeRoute() {
    if (stopsSorted.length < 2) { enqueueSnackbar('Málo zastávek', { variant: 'info' }); return; }
    let cur = { lat: start.lat, lng: start.lng };
    const remaining = stopsSorted.slice();
    const ordered: DraftStop[] = [];
    while (remaining.length) {
      let bestIdx = 0;
      let bestDist = Infinity;
      remaining.forEach((s, i) => {
        const d = haversine(cur, stopCoords(s));
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      const [next] = remaining.splice(bestIdx, 1);
      ordered.push(next);
      cur = stopCoords(next);
    }
    setStops(ordered.map((s, i) => ({ ...s, order: i + 1 })));
    enqueueSnackbar('Trasa optimalizována (nejbližší soused).', { variant: 'success' });
  }

  const busy = createShipment.isPending || updateShipment.isPending;

  const snapshot = serializeShipment(name, deliveryDate, vehicleId, driverIds, stops, viaPoints, steps, startPoint);
  const dirty = baselineRef.current !== null && snapshot !== baselineRef.current;
  const { blocker, allowNext } = useUnsavedChangesGuard(dirty);

  // Persist only (no navigation); returns the saved id or null on failure.
  async function persist(): Promise<string | null> {
    if (!name.trim()) { enqueueSnackbar('Zadejte název', { variant: 'warning' }); return null; }
    if (stopsSorted.length === 0) { enqueueSnackbar('Přidejte alespoň jednu zastávku', { variant: 'warning' }); return null; }

    const clientOrderShipments = stopsSorted
      .filter((st) => st.kind === 'order')
      .map((st) => new ClientOrderShipmentDto({
        clientOrderId: st.orderId ?? '',
        order: st.order,
        selectedAddressKind: st.addressKind,
        clientDeliveryPlaceId: st.deliveryPlaceId,
        // No per-item invoice/loading data here — the editor only reorders
        // stops; the mock/backend preserves each item's existing nakládka
        // state when this field is left undefined.
      }));

    const customStops = stopsSorted
      .filter((st) => st.kind === 'custom' || st.kind === 'company')
      .map((st) => {
        // A company stop is sent as a CustomStopDto with kind: Company — the server
        // authors its label/coordinates itself and ignores whatever is sent here;
        // a plain custom stop leaves `kind` unset, defaulting server-side to Custom.
        const dto = new CustomStopDto({
          order: st.order,
          label: st.label ?? '',
          note: st.note,
          latitude: st.lat ?? 0,
          longitude: st.lng ?? 0,
          ...(st.kind === 'company' ? { kind: OutgoingShipmentStopKind.Company } : {}),
        });
        dto.id = st.customId; // undefined for new (base class, but keep the pattern explicit)
        return dto;
      });

    const routeViaPoints = viaPoints.map((v) => new RoutePointDto({ latitude: v.lat, longitude: v.lng }));

    // Blank rows are dropped rather than rejected: an empty input the planner never filled in is
    // not an error, and the server would refuse the whole save over it. Order is the position in
    // the list, and `id` is what makes the server keep an existing step's tick.
    const preparationSteps = steps
      .filter((s) => s.label.trim() !== '')
      .map((s, i) => new PreparationStepDto({ id: s.id, order: i + 1, label: s.label.trim() }));

    try {
      let savedId: string;
      if (mode === 'edit' && shipmentId) {
        const existingDraft = shipmentQuery.data ? draftFromShipment(shipmentQuery.data) : undefined;
        await updateShipment.mutateAsync({
          id: shipmentId,
          data: new UpdateOutgoingShipmentDto({
            name,
            deliveryDate: deliveryDate?.toDate(),
            vehicleId: vehicleId ?? undefined,
            driverIds,
            state: shipmentQuery.data?.state ?? OutgoingShipmentState.Created,
            clientOrderShipments,
            customStops,
            routeViaPoints,
            stockPurchases: existingDraft?.stockPurchases ?? [],
            preparationSteps,
            startPointKind: startPoint.kind,
            startBreweryId: startPoint.breweryId,
            startBreweryAddressKind: startPoint.addressKind,
          }),
        });
        savedId = shipmentId;
        enqueueSnackbar('Vývoz uložen.', { variant: 'success' });
      } else {
        savedId = await createShipment.mutateAsync(new CreateOutgoingShipmentDto({
          name,
          deliveryDate: deliveryDate?.toDate(),
          vehicleId: vehicleId ?? undefined,
          driverIds,
          clientOrderShipments,
          customStops,
          routeViaPoints,
          preparationSteps,
          startPointKind: startPoint.kind,
          startBreweryId: startPoint.breweryId,
          startBreweryAddressKind: startPoint.addressKind,
        }));
        enqueueSnackbar('Vývoz naplánován.', { variant: 'success' });
      }
      baselineRef.current = snapshot; // now clean
      return savedId;
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
      return null;
    }
  }

  async function handleSave() {
    const id = await persist();
    if (id != null) { allowNext(); onDone(id); }
  }

  const title = mode === 'edit' ? `Úprava vývozu` : 'Naplánovat vývoz';

  return (
    <Box>
      {/* Back runs the same onCancel the Zrušit button does, so the router-level
          unsaved-changes guard still intercepts a dirty editor. */}
      <DetailHeader
        onBack={onCancel}
        backLabel="Zpět na vývozy"
        title={title}
        meta={['Vyberte objednávky, seřaďte zastávky a přiřaďte vůz a řidiče.']}
        actions={(
          <>
            <Button onClick={onCancel} color="inherit" disabled={busy}>Zrušit</Button>
            <Button variant="contained" startIcon={<CheckIcon />} onClick={() => void handleSave()} disabled={busy}>
              {busy ? 'Ukládám…' : mode === 'edit' ? 'Uložit' : 'Vytvořit vývoz'}
            </Button>
          </>
        )}
      />

      {structureLocked && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, px: 2, py: 1.25, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'brand.infoTint' }}>
          <LockOutlinedIcon fontSize="small" sx={{ color: 'info.main' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'info.main' }}>
            Vývoz je naložen — objednávky a vůz už nelze měnit. Upravit lze pouze řidiče, název a termín.
          </Typography>
        </Stack>
      )}

      {/* `minmax(0, …)` for the same reason as ShipmentDetail's layout grid: without it a
          grid item's `min-width: auto` floors each track at its content's intrinsic width —
          here the stop rows' fixed-width address Select and the orders card's filter row —
          so the tracks stop honouring their fr shares and the columns spill sideways. */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.4fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Stack spacing={2}>
          {knownStart ? (
            <RouteMap
              stops={routeStops}
              start={knownStart}
              end={knownEnd ?? knownStart}
              viaPoints={viaPoints}
              editable={!structureLocked}
              onViasChange={setViaPoints}
              height={320}
            />
          ) : (
            <Box
              sx={{
                height: 320, borderRadius: 2, border: '1px dashed', borderColor: 'divider',
                bgcolor: 'action.hover', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'text.disabled',
              }}
            >
              <Typography color="text.secondary">Trasa se zobrazí, jakmile se načte výchozí bod.</Typography>
            </Box>
          )}

          {/* Fed from the loaded server shipment (shipmentQuery.data), not the local
              `stops` draft — the draft is client-side and carries no `addressChangedAt`,
              so passing it here would silently never render anything. */}
          <AddressChangedBanner shipmentId={shipmentId ?? ''} stops={shipmentQuery.data?.stops ?? []} />

          <StartPointPicker value={startPoint} onChange={setStartPoint} disabled={structureLocked} />

          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <RouteOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Pořadí zastávek</Typography>
              <Box sx={{ flex: 1 }} />
              {!structureLocked && (
                <Button size="small" variant="outlined" startIcon={<PlaceOutlinedIcon fontSize="small" />} onClick={() => setCustomStopOpen(true)}
                  sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}>
                  Vlastní zastávka
                </Button>
              )}
              {stopsSorted.length > 1 && !structureLocked && (
                <Button size="small" variant="outlined" startIcon={<AutoAwesomeOutlinedIcon fontSize="small" />} onClick={optimizeRoute}>
                  Optimalizovat trasu
                </Button>
              )}
            </Stack>
            <Box sx={{ p: 2 }}>
              {stopsSorted.length === 0 ? (
                <EmptyState title="Zatím žádné zastávky" description="Vyberte objednávky vpravo nebo přidejte vlastní zastávku." dense />
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={stopsSorted.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                    <Stack spacing={1}>
                      {stopsSorted.map((st, i) => (
                        <SortableStopRow
                          key={st.key}
                          stop={st}
                          index={i}
                          total={stopsSorted.length}
                          locked={structureLocked}
                          order={st.orderId ? orderById.get(st.orderId) : undefined}
                          deletedPlaceName={st.orderId ? loadedPlaceNames.get(st.orderId) : undefined}
                          companyAddress={companyStartPoint?.address}
                          hasStockPurchases={hasStockPurchases}
                          onMove={(dir) => moveStop(st.key, dir)}
                          onRemove={() => removeStop(st.key)}
                          onAddrChoice={(value) => handleAddrChoice(st.key, st.orderId, value)}
                        />
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
              )}
              {/* After the drafted stops, because that is where saving will append them. Not part
                  of the sortable list: they have no identity yet, so there is nothing to reorder —
                  once saved, the stop list on the detail screen can place them. */}
              {pickupPreviews.length > 0 && (
                <Stack spacing={1} sx={{ mt: stopsSorted.length > 0 ? 1 : 0 }}>
                  {pickupPreviews.map((preview, i) => (
                    <PickupPreviewRow
                      key={preview.key}
                      seq={stopsSorted.length + i + 1}
                      label={preview.label}
                      isCompany={preview.key === 'preview-company'}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Card>
        </Stack>

        <Stack spacing={2}>
          <Card sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <TextField label="Název vývozu" required fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rozvoz Žitava + Hrádek" />
              <DateTimePicker
                label="Datum a čas"
                value={deliveryDate}
                onChange={setDeliveryDate}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
              <Combobox
                label="Vůz"
                value={vehicleId}
                onChange={setVehicleId}
                disabled={structureLocked}
                options={(vehiclesQuery.data ?? []).map((v): ComboOption => ({ value: v.id ?? '', label: v.name ?? '' }))}
                placeholder="Vyberte vůz…"
                fullWidth
              />
              {selectedVehicle && (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Náklad / nosnost</Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    {overloaded && <WarningAmberOutlinedIcon fontSize="small" color="error" />}
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: overloaded ? 'error.main' : 'success.main' }}>
                      {num(Math.round(totalWeight))} / {num(selectedVehicle.maxWeight ?? 0)} kg
                    </Typography>
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Card>

          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Řidiči</Typography>
            </Stack>
            <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ p: 2, gap: 1 }}>
              {(driversQuery.data ?? []).map((d) => {
                const on = driverIds.includes(d.id ?? '');
                const free = driverAvailableOn(d.availableDates);
                return (
                  <Chip
                    key={d.id}
                    onClick={() => toggleDriver(d.id ?? '')}
                    icon={on ? <CheckIcon sx={{ fontSize: 15 }} /> : (!free ? <WarningAmberOutlinedIcon sx={{ fontSize: 15 }} /> : undefined)}
                    label={`${d.firstName ?? ''} ${d.lastName ?? ''}`}
                    variant={on ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: 700,
                      borderColor: d.color ?? 'divider',
                      ...(on && { bgcolor: `${d.color}22`, color: 'text.primary' }),
                    }}
                  />
                );
              })}
            </Stack>
          </Card>

          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Objednávky k rozvozu</Typography>
              <Chip size="small" label={`${stops.length}/${availableOrders.length}`} sx={{ mr: 1 }} />
              <Select size="small" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} sx={{ minWidth: 160 }}>
                <MenuItem value="all">Vše ({ordersWithRegion.length})</MenuItem>
                {regionsPresent.map((r) => (
                  <MenuItem key={String(r)} value={String(r)}>
                    {regionLabel(r) ?? String(r)} ({ordersWithRegion.filter((x) => x.region === r).length})
                  </MenuItem>
                ))}
              </Select>
            </Stack>
            <Stack spacing={1} sx={{ p: 2 }}>
              {shownOrders.length === 0 ? (
                <EmptyState title="V tomto regionu nejsou objednávky" dense />
              ) : shownOrders.map(({ order }) => {
                const inRoute = usedOrderIds.has(order.id ?? '');
                return (
                  <Box
                    key={order.id}
                    onClick={structureLocked ? undefined : () => toggleOrder(order.id ?? '')}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 2,
                      cursor: structureLocked ? 'default' : 'pointer',
                      opacity: structureLocked && !inRoute ? 0.45 : 1,
                      border: 1, borderColor: inRoute ? 'warning.main' : 'divider',
                      bgcolor: inRoute ? 'brand.amberTint' : 'transparent',
                    }}
                  >
                    <Checkbox checked={inRoute} disabled={structureLocked} size="small" sx={{ p: 0 }} />
                    <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: colorForClient(order.clientName ?? order.id ?? ''), flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{order.clientName}</Typography>
                      <Typography sx={{ fontSize: 12 }} color="text.secondary">
                        {(order.items ?? []).length} položek · {order.requiredDeliveryDate ? fmtDate(order.requiredDeliveryDate) : 'bez termínu'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Card>

          {/* Not gated on `structureLocked`: the checklist is worked through while the run is
              already Loaded and InTransit, so unlike the route it stays editable then — it
              closes only once the shipment is a finished record. */}
          <PreparationStepsEditor steps={steps} onChange={setSteps} disabled={stepsLocked} />
        </Stack>
      </Box>

      <CustomStopDialog
        open={customStopOpen}
        onClose={() => setCustomStopOpen(false)}
        onAdd={addCustomStop}
        hasCompanyStop={hasCompanyStop}
        hasStockPurchases={hasStockPurchases}
      />
      {newPlaceTarget && (
        <DeliveryPlaceDialog
          open
          clientId={newPlaceTarget.clientId}
          clientName={newPlaceTarget.clientName}
          onClose={() => setNewPlaceTarget(null)}
          onSaved={(placeId) => {
            setStops((prev) => prev.map((s) => (s.key === newPlaceTarget.stopKey
              ? { ...s, addressKind: DeliveryAddressKind.DeliveryPlace, deliveryPlaceId: placeId }
              : s)));
            setNewPlaceTarget(null);
          }}
        />
      )}
      <UnsavedChangesDialog blocker={blocker} onSave={() => persist().then((id) => id != null)} busy={busy} />
    </Box>
  );
}
