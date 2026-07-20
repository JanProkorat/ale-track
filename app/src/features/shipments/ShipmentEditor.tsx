import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Breadcrumbs, Button, Card, Checkbox, Chip, IconButton, Link, MenuItem,
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
  OutgoingShipmentStopAddressKind,
  ClientOrderShipmentDto,
  CustomStopDto,
  RoutePointDto,
  CreateOutgoingShipmentDto,
  UpdateOutgoingShipmentDto,
} from 'src/generated/api-client';
import { useShipment, useCreateShipment, useUpdateShipment, useAvailableOrders } from 'src/hooks/useShipments';
import { useVehicles } from 'src/hooks/useVehicles';
import { useDrivers } from 'src/hooks/useDrivers';
import { useClients } from 'src/hooks/useClients';
import { colorForClient } from './clientColor';
import { draftFromShipment } from './shipmentDraft';
import { CustomStopDialog } from './CustomStopDialog';

interface DraftStop {
  /** Stable client-side identity: the orderId for order stops, or a generated
   *  id for custom stops. Used as the sortable/dnd key. */
  key: string;
  kind: 'order' | 'custom';
  order: number;
  addressKind: OutgoingShipmentStopAddressKind;
  // order stops
  orderId?: string;
  // custom stops
  customId?: string; // existing custom stop's PublicId (undefined when new)
  label?: string;
  note?: string;
  lat?: number;
  lng?: number;
}

function stopPoint(order: OutgoingShipmentOrderDto | undefined, addressKind: OutgoingShipmentStopAddressKind) {
  const address = addressKind === OutgoingShipmentStopAddressKind.Contact && order?.clientContactAddress ? order.clientContactAddress : order?.clientOfficialAddress;
  return { lat: address?.latitude, lng: address?.longitude };
}

function SortableStopRow({
  stop, index, order, total, locked, onMove, onRemove, onAddrKind,
}: {
  stop: DraftStop;
  index: number;
  order?: OutgoingShipmentOrderDto;
  total: number;
  locked?: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddrKind: (kind: OutgoingShipmentStopAddressKind) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.key, disabled: locked });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const isCustom = stop.kind === 'custom';
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
        <Typography sx={{ fontSize: 11.5 }} color="text.secondary" noWrap>
          {isCustom
            ? (stop.note || 'Vlastní zastávka')
            : (order?.requiredDeliveryDate ? fmtDate(order.requiredDeliveryDate) : 'bez termínu')}
        </Typography>
      </Box>
      {!isCustom && (
        <Select
          size="small"
          value={stop.addressKind}
          disabled={locked}
          onChange={(e) => onAddrKind(Number(e.target.value) as OutgoingShipmentStopAddressKind)}
          sx={{ width: 140, flexShrink: 0 }}
        >
          <MenuItem value={OutgoingShipmentStopAddressKind.Official}>Fakturační</MenuItem>
          {order?.clientContactAddress && <MenuItem value={OutgoingShipmentStopAddressKind.Contact}>Kontaktní</MenuItem>}
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
  const loadedRef = useRef(false);

  useEffect(() => {
    if (mode !== 'edit' || loadedRef.current || !shipmentQuery.data) return;
    const s = shipmentQuery.data;
    loadedRef.current = true;
    setName(s.name ?? '');
    setDeliveryDate(s.deliveryDate ? dayjs(s.deliveryDate) : null);
    setVehicleId(s.vehicleId ?? null);
    setDriverIds(s.driverIds ?? []);
    setStops((s.stops ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((st, i): DraftStop => st.orderId != null
        ? { key: st.orderId, kind: 'order', orderId: st.orderId, addressKind: addrKindValue(st.selectedAddressKind), order: i + 1 }
        : {
            key: st.id ?? `custom-${i}`,
            kind: 'custom',
            customId: st.id,
            label: st.label ?? '',
            note: st.note,
            lat: st.latitude,
            lng: st.longitude,
            addressKind: OutgoingShipmentStopAddressKind.Official,
            order: i + 1,
          }));
    setViaPoints((s.routeViaPoints ?? []).map((p) => ({ lat: p.latitude ?? 0, lng: p.longitude ?? 0 })));
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
    const pt = stopPoint(order, st.addressKind);
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
      return [...prev, { key: orderId, kind: 'order' as const, orderId, addressKind: OutgoingShipmentStopAddressKind.Official, order: prev.length + 1 }];
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
      addressKind: OutgoingShipmentStopAddressKind.Official,
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
  function setAddrKind(key: string, kind: OutgoingShipmentStopAddressKind) {
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, addressKind: kind } : s)));
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
    const pt = stopPoint(orderById.get(s.orderId ?? ''), s.addressKind);
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

  async function handleSave() {
    if (!name.trim()) { enqueueSnackbar('Zadejte název', { variant: 'warning' }); return; }
    if (stopsSorted.length === 0) { enqueueSnackbar('Přidejte alespoň jednu zastávku', { variant: 'warning' }); return; }

    const clientOrderShipments = stopsSorted
      .filter((st) => st.kind === 'order')
      .map((st) => new ClientOrderShipmentDto({
        clientOrderId: st.orderId ?? '',
        order: st.order,
        selectedAddressKind: st.addressKind,
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
            inventoryExtraShipments: existingDraft?.inventoryExtraShipments ?? [],
            clientExtraShipments: existingDraft?.clientExtraShipments ?? [],
            customExtraShipments: existingDraft?.customExtraShipments ?? [],
          }),
        });
        enqueueSnackbar('Vývoz uložen.', { variant: 'success' });
        onDone(shipmentId);
      } else {
        const id = await createShipment.mutateAsync(new CreateOutgoingShipmentDto({
          name,
          deliveryDate: deliveryDate?.toDate(),
          vehicleId: vehicleId ?? undefined,
          driverIds,
          clientOrderShipments,
          customStops,
          routeViaPoints,
        }));
        enqueueSnackbar('Vývoz naplánován.', { variant: 'success' });
        onDone(id);
      }
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
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
                          onMove={(dir) => moveStop(st.key, dir)}
                          onRemove={() => removeStop(st.key)}
                          onAddrKind={(kind) => setAddrKind(st.key, kind)}
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
            <Stack spacing={1} sx={{ p: 2, maxHeight: 440, overflowY: 'auto' }}>
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
    </Box>
  );
}
