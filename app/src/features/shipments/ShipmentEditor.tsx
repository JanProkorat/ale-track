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
import { regionLabel } from 'src/lib/labels';
import {
  type OutgoingShipmentOrderDto,
  type Region,
  OutgoingShipmentState,
  OutgoingShipmentStopAddressKind,
  ClientOrderShipmentDto,
  CreateOutgoingShipmentDto,
  UpdateOutgoingShipmentDto,
} from 'src/generated/api-client';
import { useShipment, useCreateShipment, useUpdateShipment, useAvailableOrders } from 'src/hooks/useShipments';
import { useVehicles } from 'src/hooks/useVehicles';
import { useDrivers } from 'src/hooks/useDrivers';
import { useClients } from 'src/hooks/useClients';
import { colorForClient } from './clientColor';
import { draftFromShipment } from './shipmentDraft';

interface DraftStop {
  orderId: string;
  addressKind: OutgoingShipmentStopAddressKind;
  order: number;
}

function stopPoint(order: OutgoingShipmentOrderDto | undefined, addressKind: OutgoingShipmentStopAddressKind) {
  const address = addressKind === OutgoingShipmentStopAddressKind.Contact && order?.clientContactAddress ? order.clientContactAddress : order?.clientOfficialAddress;
  return { lat: address?.latitude, lng: address?.longitude };
}

function SortableStopRow({
  stop, index, order, total, onMove, onRemove, onAddrKind,
}: {
  stop: DraftStop;
  index: number;
  order?: OutgoingShipmentOrderDto;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddrKind: (kind: OutgoingShipmentStopAddressKind) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.orderId });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
    >
      <Box {...attributes} {...listeners} sx={{ cursor: 'grab', color: 'text.disabled', display: 'flex', touchAction: 'none' }}>
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, bgcolor: colorForClient(order?.clientName ?? stop.orderId) }}>
        {index + 1}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{order?.clientName ?? '—'}</Typography>
        <Typography sx={{ fontSize: 11.5 }} color="text.secondary" noWrap>
          {order?.requiredDeliveryDate ? fmtDate(order.requiredDeliveryDate) : 'bez termínu'}
        </Typography>
      </Box>
      <Select
        size="small"
        value={stop.addressKind}
        onChange={(e) => onAddrKind(Number(e.target.value) as OutgoingShipmentStopAddressKind)}
        sx={{ width: 140, flexShrink: 0 }}
      >
        <MenuItem value={OutgoingShipmentStopAddressKind.Official}>Fakturační</MenuItem>
        {order?.clientContactAddress && <MenuItem value={OutgoingShipmentStopAddressKind.Contact}>Kontaktní</MenuItem>}
      </Select>
      <IconButton size="small" onClick={() => onMove(-1)} disabled={index === 0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
        <ArrowUpwardIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={() => onMove(1)} disabled={index === total - 1} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
        <ArrowDownwardIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onRemove} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, color: 'error.main' }}>
        <DeleteOutlineOutlinedIcon fontSize="small" />
      </IconButton>
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
      .map((st, i) => ({ orderId: st.orderId ?? '', addressKind: st.selectedAddressKind ?? OutgoingShipmentStopAddressKind.Official, order: i + 1 })));
  }, [mode, shipmentQuery.data]);

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

  const usedOrderIds = useMemo(() => new Set(stops.map((s) => s.orderId)), [stops]);
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
  const routeStops: RouteStop[] = useMemo(() => stopsSorted.map((st) => {
    const order = orderById.get(st.orderId);
    const pt = stopPoint(order, st.addressKind);
    return { lat: pt.lat, lng: pt.lng, label: order?.clientName ?? '—', color: colorForClient(order?.clientName ?? st.orderId) };
  }), [stopsSorted, orderById]);

  const selectedVehicle = (vehiclesQuery.data ?? []).find((v) => v.id === vehicleId);
  const totalWeight = useMemo(() => stopsSorted.reduce((sum, st) => {
    const order = orderById.get(st.orderId);
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
      if (prev.some((s) => s.orderId === orderId)) {
        return prev.filter((s) => s.orderId !== orderId).map((s, i) => ({ ...s, order: i + 1 }));
      }
      return [...prev, { orderId, addressKind: OutgoingShipmentStopAddressKind.Official, order: prev.length + 1 }];
    });
  }
  function moveStop(orderId: string, dir: -1 | 1) {
    setStops((prev) => {
      const arr = prev.slice().sort((a, b) => a.order - b.order);
      const i = arr.findIndex((s) => s.orderId === orderId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return prev;
      [arr[i].order, arr[j].order] = [arr[j].order, arr[i].order];
      return arr.map((s) => ({ ...s }));
    });
  }
  function removeStop(orderId: string) {
    setStops((prev) => prev.filter((s) => s.orderId !== orderId).map((s, i) => ({ ...s, order: i + 1 })));
  }
  function setAddrKind(orderId: string, kind: OutgoingShipmentStopAddressKind) {
    setStops((prev) => prev.map((s) => (s.orderId === orderId ? { ...s, addressKind: kind } : s)));
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
      const oldIndex = arr.findIndex((s) => s.orderId === active.id);
      const newIndex = arr.findIndex((s) => s.orderId === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(arr, oldIndex, newIndex).map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  function optimizeRoute() {
    if (stopsSorted.length < 2) { enqueueSnackbar('Málo zastávek', { variant: 'info' }); return; }
    let cur = { lat: DEPOT.lat, lng: DEPOT.lng };
    const remaining = stopsSorted.slice();
    const ordered: DraftStop[] = [];
    while (remaining.length) {
      let bestIdx = 0;
      let bestDist = Infinity;
      remaining.forEach((s, i) => {
        const order = orderById.get(s.orderId);
        const pt = stopPoint(order, s.addressKind);
        const d = haversine(cur, { lat: pt.lat ?? DEPOT.lat, lng: pt.lng ?? DEPOT.lng });
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      const [next] = remaining.splice(bestIdx, 1);
      ordered.push(next);
      const order = orderById.get(next.orderId);
      const pt = stopPoint(order, next.addressKind);
      cur = { lat: pt.lat ?? cur.lat, lng: pt.lng ?? cur.lng };
    }
    setStops(ordered.map((s, i) => ({ ...s, order: i + 1 })));
    enqueueSnackbar('Trasa optimalizována (nejbližší soused).', { variant: 'success' });
  }

  const busy = createShipment.isPending || updateShipment.isPending;

  async function handleSave() {
    if (!name.trim()) { enqueueSnackbar('Zadejte název', { variant: 'warning' }); return; }
    if (stopsSorted.length === 0) { enqueueSnackbar('Přidejte alespoň jednu zastávku', { variant: 'warning' }); return; }

    const clientOrderShipments = stopsSorted.map((st) => new ClientOrderShipmentDto({
      clientOrderId: st.orderId,
      order: st.order,
      selectedAddressKind: st.addressKind,
      // No per-item invoice/loading data here — the editor only reorders
      // stops; the mock/backend preserves each item's existing nakládka
      // state when this field is left undefined.
    }));

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

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, alignItems: 'start' }}>
        <Stack spacing={2}>
          <RouteMap stops={routeStops} height={320} />

          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <RouteOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Pořadí zastávek</Typography>
              <Box sx={{ flex: 1 }} />
              {stopsSorted.length > 1 && (
                <Button size="small" variant="outlined" startIcon={<AutoAwesomeOutlinedIcon fontSize="small" />} onClick={optimizeRoute}>
                  Optimalizovat trasu
                </Button>
              )}
            </Stack>
            <Box sx={{ p: 2 }}>
              {stopsSorted.length === 0 ? (
                <EmptyState title="Zatím žádné zastávky" description="Vyberte objednávky vpravo." dense />
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={stopsSorted.map((s) => s.orderId)} strategy={verticalListSortingStrategy}>
                    <Stack spacing={1}>
                      {stopsSorted.map((st, i) => (
                        <SortableStopRow
                          key={st.orderId}
                          stop={st}
                          index={i}
                          total={stopsSorted.length}
                          order={orderById.get(st.orderId)}
                          onMove={(dir) => moveStop(st.orderId, dir)}
                          onRemove={() => removeStop(st.orderId)}
                          onAddrKind={(kind) => setAddrKind(st.orderId, kind)}
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
                    onClick={() => toggleOrder(order.id ?? '')}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 2, cursor: 'pointer',
                      border: 1, borderColor: inRoute ? 'warning.main' : 'divider',
                      bgcolor: (t) => (inRoute ? t.palette.brand.amberTint : 'transparent'),
                    }}
                  >
                    <Checkbox checked={inRoute} size="small" sx={{ p: 0 }} />
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
    </Box>
  );
}
