import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Breadcrumbs, Button, Card, Checkbox, Chip, IconButton, Link, ListSubheader, MenuItem,
  Select, Stack, TextField, Typography,
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
import NavigateNextIcon from '@mui/icons-material/NavigateNextOutlined';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PageHeader } from 'src/components/common/PageHeader';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { EmptyState } from 'src/components/common/EmptyState';
import { RouteMap, type RouteStop } from 'src/components/common/RouteMap';
import { DEPOT, haversine } from 'src/lib/geo';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, num } from 'src/lib/format';
import { regionLabel, shipStateName, addrKindValue } from 'src/lib/labels';
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
} from 'src/generated/api-client';
import { useShipment, useCreateShipment, useUpdateShipment, useAvailableOrders } from 'src/hooks/useShipments';
import { useUnsavedChangesGuard, UnsavedChangesDialog } from 'src/components/common/UnsavedChangesGuard';
import { useVehicles } from 'src/hooks/useVehicles';
import { useDrivers } from 'src/hooks/useDrivers';
import { useClients } from 'src/hooks/useClients';
import { colorForClient } from './clientColor';
import { draftFromShipment } from './shipmentDraft';
import { CustomStopDialog } from 'src/components/common/CustomStopDialog';
import { DeliveryPlaceDialog } from 'src/components/common/DeliveryPlaceDialog';
import { resolveStopAddress } from './stopAddress';
import { NEW_PLACE_CHOICE, decodeStopChoice, encodeStopChoice } from 'src/features/clients/deliveryAddress';

interface DraftStop {
  /** Stable client-side identity: the orderId for order stops, or a generated
   *  id for custom stops. Used as the sortable/dnd key. */
  key: string;
  kind: 'order' | 'custom';
  order: number;
  addressKind: DeliveryAddressKind;
  // order stops
  orderId?: string;
  /** Set only when addressKind is DeliveryPlace. Undefined for a freshly
   *  toggled order or when Official/Contact is chosen. */
  deliveryPlaceId?: string;
  // custom stops
  customId?: string; // existing custom stop's PublicId (undefined when new)
  label?: string;
  note?: string;
  lat?: number;
  lng?: number;
}

/** Serialized snapshot of the savable state, for unsaved-change detection. */
function serializeShipment(name: string, date: Dayjs | null, vehicleId: string | null, driverIds: string[], stops: DraftStop[], viaPoints: { lat: number; lng: number }[]): string {
  return JSON.stringify({
    name: name.trim(),
    date: date ? date.toISOString() : null,
    vehicleId,
    driverIds: [...driverIds].sort(),
    stops: stops.map((s) => ({ kind: s.kind, order: s.order, orderId: s.orderId ?? null, customId: s.customId ?? null, label: s.label ?? null, note: s.note ?? null, lat: s.lat ?? null, lng: s.lng ?? null, addressKind: s.addressKind, deliveryPlaceId: s.deliveryPlaceId ?? null })),
    vias: viaPoints.map((v) => ({ lat: v.lat, lng: v.lng })),
  });
}

function SortableStopRow({
  stop, index, order, total, locked, deletedPlaceName, onMove, onRemove, onAddrChoice,
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
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  /** Raw <Select> value — 'Official' | 'Contact' | `place:<id>` | the
   *  '+ Nové místo…' sentinel. Decoding (and the sentinel) is the parent's
   *  job since opening the dialog needs the client id, not just the stop. */
  onAddrChoice: (value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.key, disabled: locked });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const isCustom = stop.kind === 'custom';
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
  const addressText = isCustom ? undefined : resolveStopAddress(order, stop.addressKind, stop.deliveryPlaceId).text;
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
        borderRadius: isCustom ? '4px' : '50%',
        transform: isCustom ? 'rotate(45deg)' : undefined,
        bgcolor: isCustom ? '#1A2B4C' : colorForClient(order?.clientName ?? stop.key),
      }}>
        <Box component="span" sx={{ transform: isCustom ? 'rotate(-45deg)' : undefined }}>{index + 1}</Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{isCustom ? (stop.label || 'Vlastní zastávka') : (order?.clientName ?? '—')}</Typography>
        {/* Prototype's stopAddressText prefixes this with the order number
         * (`o.number + ' · '`); OutgoingShipmentOrderDto carries no such
         * field, so that prefix is dropped here — a data-model deviation,
         * not a design one. */}
        <Typography sx={{ fontSize: 11.5 }} color="text.secondary" noWrap>
          {isCustom ? (stop.note || 'Vlastní zastávka') : addressText}
        </Typography>
      </Box>
      {!isCustom && (
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
          <IconButton size="small" onClick={onRemove} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, color: 'error.main' }}>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </IconButton>
        </>
      )}
    </Box>
  );
}

/** Vývoz editor: draggable stop ordering + nearest-neighbour route
 * optimizer + order selection with a region filter, plus vehicle/driver
 * assignment. Matches the prototype's viewShipmentEditor/seOptimize/seSave. */
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
  const loadedRef = useRef(false);
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode === 'create') baselineRef.current = serializeShipment(name, deliveryDate, vehicleId, driverIds, stops, viaPoints);
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
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((st, i): DraftStop => st.orderId != null
        ? {
            key: st.orderId, kind: 'order', orderId: st.orderId, addressKind: addrKindValue(st.selectedAddressKind), order: i + 1,
            deliveryPlaceId: st.deliveryPlace?.id,
          }
        : {
            key: st.id ?? `custom-${i}`,
            kind: 'custom',
            customId: st.id,
            label: st.label ?? '',
            note: st.note,
            lat: st.latitude,
            lng: st.longitude,
            addressKind: DeliveryAddressKind.Official,
            order: i + 1,
          });
    const loadedVias = (s.routeViaPoints ?? []).map((p) => ({ lat: p.latitude ?? 0, lng: p.longitude ?? 0 }));
    setName(loadedName);
    setDeliveryDate(loadedDate);
    setVehicleId(loadedVehicle);
    setDriverIds(loadedDrivers);
    setStops(loadedStops);
    setViaPoints(loadedVias);
    baselineRef.current = serializeShipment(loadedName, loadedDate, loadedVehicle, loadedDrivers, loadedStops, loadedVias);
  }, [mode, shipmentQuery.data]);

  // Once the shipment is Loaded (or beyond), its order composition and vehicle
  // are fixed — only drivers (and name/date) may still change. Created is open.
  // (State arrives as a string from the API; normalize before comparing.)
  const lockedStateName = shipStateName(shipmentQuery.data?.state);
  const structureLocked = mode === 'edit' && lockedStateName != null && lockedStateName !== 'Created';

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

  const stopsSorted = useMemo(() => stops.slice().sort((a, b) => a.order - b.order), [stops]);
  const routeStops: RouteStop[] = useMemo(() => stopsSorted.map((st): RouteStop => {
    if (st.kind === 'custom') {
      return { lat: st.lat, lng: st.lng, label: st.label || 'Vlastní zastávka', color: '#1A2B4C', kind: 'custom' };
    }
    const order = orderById.get(st.orderId ?? '');
    const pt = resolveStopAddress(order, st.addressKind, st.deliveryPlaceId);
    return { lat: pt.lat, lng: pt.lng, label: order?.clientName ?? '—', color: colorForClient(order?.clientName ?? st.key), kind: 'order' };
  }), [stopsSorted, orderById]);

  const selectedVehicle = (vehiclesQuery.data ?? []).find((v) => v.id === vehicleId);
  const totalWeight = useMemo(() => stopsSorted.reduce((sum, st) => {
    if (st.kind === 'custom') return sum;
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
      return [...prev, {
        key: orderId,
        kind: 'order' as const,
        orderId,
        addressKind: addrKindValue(order?.deliveryAddressKind),
        deliveryPlaceId: order?.clientDeliveryPlaceId ?? undefined,
        order: prev.length + 1,
      }];
    });
  }
  function addCustomStop(stop: { label: string; note?: string; lat: number; lng: number }) {
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
    if (s.kind === 'custom') return { lat: s.lat ?? DEPOT.lat, lng: s.lng ?? DEPOT.lng };
    const pt = resolveStopAddress(orderById.get(s.orderId ?? ''), s.addressKind, s.deliveryPlaceId);
    return { lat: pt.lat ?? DEPOT.lat, lng: pt.lng ?? DEPOT.lng };
  };

  function optimizeRoute() {
    if (stopsSorted.length < 2) { enqueueSnackbar('Málo zastávek', { variant: 'info' }); return; }
    let cur = { lat: DEPOT.lat, lng: DEPOT.lng };
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

  const snapshot = serializeShipment(name, deliveryDate, vehicleId, driverIds, stops, viaPoints);
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
      .filter((st) => st.kind === 'custom')
      .map((st) => {
        const dto = new CustomStopDto({ order: st.order, label: st.label ?? '', note: st.note, latitude: st.lat ?? 0, longitude: st.lng ?? 0 });
        dto.id = st.customId; // undefined for new (base class, but keep the pattern explicit)
        return dto;
      });

    const routeViaPoints = viaPoints.map((v) => new RoutePointDto({ latitude: v.lat, longitude: v.lng }));

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
      <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 16 }} />} sx={{ mb: 1.5, fontSize: 13 }}>
        <Link component="button" type="button" underline="hover" color="text.secondary" onClick={onCancel} sx={{ fontSize: 13 }}>
          Vývozy
        </Link>
        <Typography color="text.primary" sx={{ fontSize: 13 }}>{title}</Typography>
      </Breadcrumbs>

      <PageHeader
        eyebrow="Prodej"
        title={title}
        subtitle="Vyberte objednávky, seřaďte zastávky a přiřaďte vůz a řidiče."
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

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, alignItems: 'start' }}>
        <Stack spacing={2}>
          <RouteMap stops={routeStops} viaPoints={viaPoints} editable={!structureLocked} onViasChange={setViaPoints} height={320} />

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
                          onMove={(dir) => moveStop(st.key, dir)}
                          onRemove={() => removeStop(st.key)}
                          onAddrChoice={(value) => handleAddrChoice(st.key, st.orderId, value)}
                        />
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
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
        </Stack>
      </Box>

      <CustomStopDialog open={customStopOpen} onClose={() => setCustomStopOpen(false)} onAdd={addCustomStop} />
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
