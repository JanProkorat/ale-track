import { useEffect, useMemo, useState } from 'react';
import {
  Box, Breadcrumbs, Button, ButtonBase, Card, Checkbox, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, Link, Stack, TextField, Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNextOutlined';
import { useSnackbar } from 'notistack';
import { SegControl } from 'src/components/common/SegControl';
import { StatusPill } from 'src/components/common/StatusPill';
import { RouteMap, type RouteStop } from 'src/components/common/RouteMap';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, num, fmtLiters } from 'src/lib/format';
import { SHIP_STATUS, shipStateName, addrKindLabel, kindLabel } from 'src/lib/labels';
import {
  type OutgoingShipmentDetailDto,
  type OutgoingShipmentStopDto,
  type OutgoingShipmentOrderItemDto,
  type OutgoingShipmentInventoryExtraItemDto,
  type ProductKind,
  OutgoingShipmentState,
  OutgoingShipmentStopAddressKind,
  InventoryExtraShipmentDto,
  UpdateOutgoingShipmentDto,
} from 'src/generated/api-client';
import { useUpdateShipment } from 'src/hooks/useShipments';
import { useVehicle } from 'src/hooks/useVehicles';
import { useDrivers } from 'src/hooks/useDrivers';
import { useInventory } from 'src/hooks/useInventory';
import { colorForClient } from './clientColor';
import { draftFromShipment, type ShipmentDraft } from './shipmentDraft';

type Tab = 'all' | 'f1' | 'f2';

interface NakladkaRow {
  key: string;
  orderItemId?: string;
  extraId?: string;
  dokladka: boolean;
  name: string;
  kind?: ProductKind;
  packageSize?: number;
  quantity: number;
  weight: number;
  firstInvoiceQuantity: number;
  secondInvoiceQuantity: number;
  loaded: boolean;
}

function productRowFrom(p: OutgoingShipmentOrderItemDto): NakladkaRow {
  return {
    key: p.orderItemId ?? p.id ?? '',
    orderItemId: p.orderItemId,
    dokladka: false,
    name: p.name ?? '—',
    kind: p.kind,
    packageSize: p.packageSize,
    quantity: p.quantity ?? 0,
    weight: p.weight ?? 0,
    firstInvoiceQuantity: p.firstInvoiceQuantity ?? 0,
    secondInvoiceQuantity: p.secondInvoiceQuantity ?? 0,
    loaded: p.isShipmentLoadingConfirmed ?? false,
  };
}
function extraRowFrom(e: OutgoingShipmentInventoryExtraItemDto): NakladkaRow {
  return {
    key: `extra-${e.id}`,
    extraId: e.id,
    dokladka: true,
    name: e.name ?? '—',
    kind: e.kind,
    packageSize: e.packageSize,
    quantity: e.quantity ?? 0,
    weight: e.weight ?? 0,
    firstInvoiceQuantity: e.firstInvoiceQuantity ?? 0,
    secondInvoiceQuantity: e.secondInvoiceQuantity ?? 0,
    loaded: e.isShipmentLoadingConfirmed ?? false,
  };
}
function inTab(row: NakladkaRow, tab: Tab): boolean {
  if (tab === 'all') return true;
  if (tab === 'f1') return row.firstInvoiceQuantity > 0;
  return row.secondInvoiceQuantity > 0;
}
function invoiceOf(row: NakladkaRow): 1 | 2 {
  return row.firstInvoiceQuantity === 0 && row.secondInvoiceQuantity > 0 ? 2 : 1;
}

function InvoiceToggle({ value, onChange, disabled }: { value: 1 | 2; onChange: (v: 1 | 2) => void; disabled?: boolean }) {
  return (
    <Stack direction="row" spacing={0.5}>
      {([1, 2] as const).map((n) => (
        <ButtonBase
          key={n}
          disabled={disabled}
          onClick={() => onChange(n)}
          sx={{
            px: 1.1, py: 0.4, borderRadius: 1, fontSize: 11.5, fontWeight: 700,
            bgcolor: value === n ? 'warning.main' : 'action.hover',
            color: value === n ? '#fff' : 'text.secondary',
          }}
        >
          F{n}
        </ButtonBase>
      ))}
    </Stack>
  );
}

function ItemsHeader({ tab }: { tab: Tab }) {
  const labelSx = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' as const, letterSpacing: '0.03em' };
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pb: 0.5 }}>
      <Typography sx={{ flex: 1, ...labelSx }}>Produkt</Typography>
      <Typography sx={{ width: 60, textAlign: 'right', ...labelSx }}>Množství</Typography>
      {tab === 'all' && <Typography sx={{ width: 68, textAlign: 'center', ...labelSx }}>Faktura</Typography>}
      <Typography sx={{ width: 64, textAlign: 'center', ...labelSx }}>Naloženo</Typography>
      <Typography sx={{ width: 64, textAlign: 'center', ...labelSx }}>Kontrola</Typography>
      <Box sx={{ width: 32 }} />
    </Stack>
  );
}

function ItemRow({
  row, tab, editable, checked, onLoaded, onInvoice, onToggleChecked, onRemove,
}: {
  row: NakladkaRow;
  tab: Tab;
  editable: boolean;
  checked: boolean;
  onLoaded: (loaded: boolean) => void;
  onInvoice: (invoice: 1 | 2) => void;
  onToggleChecked: () => void;
  onRemove?: () => void;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{row.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
          {row.kind != null && <Chip size="small" label={kindLabel(row.kind)} sx={{ height: 18, fontSize: 10.5 }} />}
          {row.packageSize != null && <Chip size="small" label={fmtLiters(row.packageSize)} sx={{ height: 18, fontSize: 10.5, fontWeight: 800 }} />}
          {row.dokladka && <Typography sx={{ fontSize: 11, color: 'info.main', fontWeight: 700 }}>dokládka ze skladu</Typography>}
        </Stack>
      </Box>
      <Typography sx={{ width: 60, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{row.quantity} ks</Typography>
      <Box sx={{ width: 68, display: 'flex', justifyContent: 'center' }}>
        {tab === 'all' && <InvoiceToggle value={invoiceOf(row)} onChange={onInvoice} disabled={!editable} />}
      </Box>
      <Box sx={{ width: 64, display: 'flex', justifyContent: 'center' }}>
        <Checkbox size="small" checked={row.loaded} disabled={!editable} onChange={(e) => onLoaded(e.target.checked)} title="Naloženo (1. diktovaná nakládka)" />
      </Box>
      <Box sx={{ width: 64, display: 'flex', justifyContent: 'center' }}>
        <Checkbox size="small" checked={checked} disabled={!editable || !row.loaded} onChange={onToggleChecked} title={row.loaded ? 'Kontrola (2. kolo)' : 'Nejdřív naložit'} />
      </Box>
      <Box sx={{ width: 32, display: 'flex', justifyContent: 'flex-end' }}>
        {onRemove && editable && (
          <IconButton size="small" onClick={onRemove} sx={{ color: 'error.main' }} aria-label="Odebrat">
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Stack>
  );
}

function StopHeader({ stop, index, onDokladka, editable }: { stop: OutgoingShipmentStopDto; index: number; onDokladka: () => void; editable: boolean }) {
  const address = stop.selectedAddressKind === OutgoingShipmentStopAddressKind.Contact && stop.contactAddress ? stop.contactAddress : stop.officialAddress;
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ mt: 1.5, mb: 0.75 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, bgcolor: colorForClient(stop.clientId ?? '') }}>
          {index + 1}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{stop.clientName}</Typography>
          <Typography sx={{ fontSize: 11.5 }} color="text.secondary">
            {address ? `${address.streetName} ${address.streetNumber}, ${address.city}` : '—'} · {addrKindLabel(stop.selectedAddressKind)}
          </Typography>
        </Box>
      </Stack>
      {editable && (
        <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={onDokladka}>
          Dokládka ze skladu
        </Button>
      )}
    </Stack>
  );
}

/** Vývoz detail: route map, advance-state header, and the nakládka card
 * (invoice-split tabs, two-stage loading check, dokládka-from-stock). Matches
 * the prototype's viewShipmentDetail + shipLoadingCard. */
export function ShipmentDetail({
  shipment,
  editable,
  onBack,
  onEdit,
}: {
  shipment: OutgoingShipmentDetailDto;
  editable: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const updateShipment = useUpdateShipment();
  const vehicleQuery = useVehicle(shipment.vehicleId ?? undefined);
  const driversQuery = useDrivers();
  const inventoryQuery = useInventory();

  const [tab, setTab] = useState<Tab>('all');
  // "Kontrola" (2nd check round) has no field on the real DTO (only a single
  // isLoadingConfirmed flag exists) — kept as ephemeral, session-only local
  // state, reset whenever a different shipment is opened.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  useEffect(() => setCheckedIds(new Set()), [shipment.id]);

  const [dokladkaOpen, setDokladkaOpen] = useState(false);
  const [dokladkaProductId, setDokladkaProductId] = useState<string | null>(null);
  const [dokladkaQty, setDokladkaQty] = useState('1');

  const nakladkaEditable = editable && shipment.state !== OutgoingShipmentState.Delivered && shipment.state !== OutgoingShipmentState.Cancelled;

  const stopsSorted = useMemo(
    () => (shipment.stops ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [shipment.stops],
  );
  const routeStops: RouteStop[] = useMemo(() => stopsSorted.map((st) => {
    const address = st.selectedAddressKind === OutgoingShipmentStopAddressKind.Contact && st.contactAddress ? st.contactAddress : st.officialAddress;
    return { lat: address?.latitude, lng: address?.longitude, label: st.clientName ?? '—', color: colorForClient(st.clientId ?? '') };
  }), [stopsSorted]);

  const extraRows = useMemo(() => (shipment.inventoryExtraItems ?? []).map(extraRowFrom), [shipment.inventoryExtraItems]);
  const combinedRows = useMemo(
    () => [...stopsSorted.flatMap((st) => (st.products ?? []).map(productRowFrom)), ...extraRows],
    [stopsSorted, extraRows],
  );
  const totalN = combinedRows.length;
  const loadedN = combinedRows.filter((r) => r.loaded).length;
  const checkedN = combinedRows.filter((r) => checkedIds.has(r.key)).length;
  const f1Count = combinedRows.filter((r) => r.firstInvoiceQuantity > 0).length;
  const f2Count = combinedRows.filter((r) => r.secondInvoiceQuantity > 0).length;
  const totalWeight = combinedRows.reduce((sum, r) => sum + r.weight * r.quantity, 0);

  const vehicle = vehicleQuery.data;
  const overloaded = Boolean(vehicle?.maxWeight != null && totalWeight > vehicle.maxWeight);
  const assignedDrivers = (driversQuery.data ?? []).filter((d) => (shipment.driverIds ?? []).includes(d.id ?? ''));

  const stateName = shipStateName(shipment.state);
  const status = SHIP_STATUS[stateName ?? 'Created'] ?? SHIP_STATUS.Created;

  async function save(draft: ShipmentDraft, nextState?: OutgoingShipmentState) {
    try {
      await updateShipment.mutateAsync({
        id: shipment.id ?? '',
        data: new UpdateOutgoingShipmentDto({
          name: shipment.name ?? '',
          deliveryDate: shipment.deliveryDate,
          vehicleId: shipment.vehicleId,
          driverIds: shipment.driverIds,
          state: nextState ?? shipment.state ?? OutgoingShipmentState.Created,
          ...draft,
        }),
      });
      if (nextState != null) enqueueSnackbar('Stav vývozu aktualizován.', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  }

  function advance(next: OutgoingShipmentState) {
    void save(draftFromShipment(shipment), next);
  }

  function setRowLoaded(row: NakladkaRow, loaded: boolean) {
    const draft = draftFromShipment(shipment);
    if (row.orderItemId) {
      for (const co of draft.clientOrderShipments) {
        const oi = co.orderItems?.find((x) => x.orderItemId === row.orderItemId);
        if (oi) oi.isLoadingConfirmed = loaded;
      }
    } else if (row.extraId) {
      const e = draft.inventoryExtraShipments.find((x) => x.id === row.extraId);
      if (e) e.isLoadingConfirmed = loaded;
    }
    if (!loaded) setCheckedIds((prev) => { const n = new Set(prev); n.delete(row.key); return n; });
    void save(draft);
  }

  function setRowInvoice(row: NakladkaRow, invoice: 1 | 2) {
    const draft = draftFromShipment(shipment);
    const apply = (target: { firstInvoiceQuantity?: number; secondInvoiceQuantity?: number }) => {
      target.firstInvoiceQuantity = invoice === 1 ? row.quantity : 0;
      target.secondInvoiceQuantity = invoice === 2 ? row.quantity : 0;
    };
    if (row.orderItemId) {
      for (const co of draft.clientOrderShipments) {
        const oi = co.orderItems?.find((x) => x.orderItemId === row.orderItemId);
        if (oi) apply(oi);
      }
    } else if (row.extraId) {
      const e = draft.inventoryExtraShipments.find((x) => x.id === row.extraId);
      if (e) apply(e);
    }
    void save(draft);
  }

  function removeExtra(extraId?: string) {
    const draft = draftFromShipment(shipment);
    draft.inventoryExtraShipments = draft.inventoryExtraShipments.filter((e) => e.id !== extraId);
    void save(draft);
    enqueueSnackbar('Dokládka odebrána.', { variant: 'success' });
  }

  function toggleChecked(key: string) {
    setCheckedIds((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  const stockOptions: ComboOption[] = useMemo(() => (inventoryQuery.data ?? [])
    .flatMap((s) => s.items ?? [])
    .filter((i) => i.productId && (i.quantity ?? 0) > 0)
    .map((i) => ({
      value: i.productId!,
      label: `${i.name}${i.packageSize != null ? ` (${fmtLiters(i.packageSize)})` : ''} — skladem ${i.quantity} ks`,
    })), [inventoryQuery.data]);

  function openDokladka() {
    setDokladkaProductId(null);
    setDokladkaQty('1');
    setDokladkaOpen(true);
  }

  async function saveDokladka() {
    const stockItem = (inventoryQuery.data ?? []).flatMap((s) => s.items ?? []).find((i) => i.productId === dokladkaProductId);
    const qty = parseInt(dokladkaQty, 10) || 0;
    if (!stockItem) { enqueueSnackbar('Vyberte produkt', { variant: 'warning' }); return; }
    if (qty <= 0) { enqueueSnackbar('Zadejte počet kusů', { variant: 'warning' }); return; }
    if (qty > (stockItem.quantity ?? 0)) { enqueueSnackbar(`Na skladě je jen ${stockItem.quantity} ks`, { variant: 'warning' }); return; }

    const draft = draftFromShipment(shipment);
    const existing = draft.inventoryExtraShipments.find((e) => e.productId === dokladkaProductId);
    if (existing) {
      existing.quantity = (existing.quantity ?? 0) + qty;
    } else {
      draft.inventoryExtraShipments.push(new InventoryExtraShipmentDto({
        productId: dokladkaProductId!, quantity: qty, isLoadingConfirmed: false, firstInvoiceQuantity: qty, secondInvoiceQuantity: 0,
      }));
    }
    await save(draft);
    setDokladkaOpen(false);
    enqueueSnackbar('Dokládka přidána do nakládky.', { variant: 'success' });
  }

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 16 }} />} sx={{ mb: 1.5, fontSize: 13 }}>
        <Link component="button" type="button" underline="hover" color="text.secondary" onClick={onBack} sx={{ fontSize: 13 }}>
          Vývozy
        </Link>
        <Typography color="text.primary" sx={{ fontSize: 13 }}>{shipment.name}</Typography>
      </Breadcrumbs>

      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'primary.dark', mb: 0.6 }}>
            Vývoz
          </Typography>
          <Typography variant="h1" sx={{ fontSize: 26 }}>{shipment.name}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 14 }}>
            {shipment.deliveryDate ? fmtDate(shipment.deliveryDate) : 'termín neurčen'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusPill tone={status.tone} label={status.label} />
          {editable && shipment.state === OutgoingShipmentState.Created && (
            <Button variant="outlined" startIcon={<CheckIcon />} onClick={() => advance(OutgoingShipmentState.Loaded)}>Naloženo</Button>
          )}
          {editable && shipment.state === OutgoingShipmentState.Loaded && (
            <Button variant="outlined" startIcon={<LocalShippingOutlinedIcon />} onClick={() => advance(OutgoingShipmentState.InTransit)}>Vyrazit</Button>
          )}
          {editable && shipment.state === OutgoingShipmentState.InTransit && (
            <Button variant="contained" startIcon={<CheckIcon />} onClick={() => advance(OutgoingShipmentState.Delivered)}>Doručeno</Button>
          )}
          {editable && (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={onEdit} sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper' }}>
              Upravit
            </Button>
          )}
        </Stack>
      </Stack>

      <RouteMap stops={routeStops} height={360} />

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, alignItems: 'start', mt: 2.5 }}>
        <Stack spacing={2}>
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Inventory2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Nakládka</Typography>
              <Box sx={{ flex: 1 }} />
              <SegControl<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'all', label: <>Celková nakládka <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>{totalN}</Box></> },
                  { value: 'f1', label: <>Faktura 1 <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>{f1Count}</Box></> },
                  { value: 'f2', label: <>Faktura 2 <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>{f2Count}</Box></> },
                ]}
              />
            </Stack>
            <Box sx={{ px: 2.5, py: 2 }}>
              <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                <StatusPill tone={totalN > 0 && loadedN === totalN ? 'ok' : 'grey'} label={`Naloženo ${loadedN}/${totalN}`} />
                <StatusPill tone={totalN > 0 && checkedN === totalN ? 'ok' : 'grey'} label={`Zkontrolováno ${checkedN}/${totalN}`} />
              </Stack>

              {stopsSorted.length > 0 && <ItemsHeader tab={tab} />}
              {stopsSorted.map((stop, i) => {
                const rows = (stop.products ?? []).map(productRowFrom).filter((r) => inTab(r, tab));
                return (
                  <Box key={stop.orderId ?? i}>
                    <StopHeader stop={stop} index={i} editable={nakladkaEditable} onDokladka={openDokladka} />
                    {rows.length > 0 ? (
                      rows.map((row) => (
                        <ItemRow
                          key={row.key}
                          row={row}
                          tab={tab}
                          editable={nakladkaEditable}
                          checked={checkedIds.has(row.key)}
                          onLoaded={(loaded) => setRowLoaded(row, loaded)}
                          onInvoice={(inv) => setRowInvoice(row, inv)}
                          onToggleChecked={() => toggleChecked(row.key)}
                        />
                      ))
                    ) : (
                      <Typography color="text.secondary" sx={{ fontSize: 12.5, py: 1 }}>V této faktuře nemá klient žádné položky.</Typography>
                    )}
                  </Box>
                );
              })}

              {extraRows.filter((r) => inTab(r, tab)).length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>Dokládka ze skladu</Typography>
                  {extraRows.filter((r) => inTab(r, tab)).map((row) => (
                    <ItemRow
                      key={row.key}
                      row={row}
                      tab={tab}
                      editable={nakladkaEditable}
                      checked={checkedIds.has(row.key)}
                      onLoaded={(loaded) => setRowLoaded(row, loaded)}
                      onInvoice={(inv) => setRowInvoice(row, inv)}
                      onToggleChecked={() => toggleChecked(row.key)}
                      onRemove={() => removeExtra(row.extraId)}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Card>

          {(shipment.customExtraItems ?? []).length > 0 && (
            <Card sx={{ overflow: 'hidden' }}>
              <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Extra položky (vratné obaly ap.)</Typography>
              </Stack>
              <Stack sx={{ px: 2.5, py: 1.5 }} spacing={1}>
                {(shipment.customExtraItems ?? []).map((e) => (
                  <Stack key={e.id} direction="row" justifyContent="space-between">
                    <Typography>{e.name}</Typography>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.quantity} ks</Typography>
                  </Stack>
                ))}
              </Stack>
            </Card>
          )}
        </Stack>

        <Stack spacing={2}>
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Vůz</Typography>
            </Stack>
            <Box sx={{ p: 2.5 }}>
              {!shipment.vehicleId ? (
                <Typography color="text.secondary">Vůz nepřiřazen</Typography>
              ) : vehicleQuery.isLoading ? (
                <CircularProgress size={20} />
              ) : vehicle ? (
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: 'action.hover' }}>
                      <DirectionsCarOutlinedIcon fontSize="small" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>{vehicle.name}</Typography>
                      <Typography variant="caption" color="text.secondary">Nosnost {num(vehicle.maxWeight ?? 0)} kg</Typography>
                    </Box>
                  </Stack>
                  <Divider />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Odhad. hmotnost nákladu</Typography>
                    <Typography sx={{ fontWeight: 700, color: overloaded ? 'error.main' : 'success.main' }}>{num(Math.round(totalWeight))} kg</Typography>
                  </Stack>
                  {overloaded && <StatusPill tone="crit" label="Překročena nosnost!" />}
                </Stack>
              ) : null}
            </Box>
          </Card>

          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Řidiči</Typography>
            </Stack>
            <Stack spacing={1.5} sx={{ p: 2.5 }}>
              {assignedDrivers.length > 0 ? assignedDrivers.map((d) => (
                <Stack key={d.id} direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: d.color ?? 'text.disabled', flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>{d.firstName} {d.lastName}</Typography>
                    {d.phoneNumber && <Typography variant="caption" color="text.secondary">{d.phoneNumber}</Typography>}
                  </Box>
                </Stack>
              )) : <Typography color="text.secondary">Bez řidiče</Typography>}
            </Stack>
          </Card>
        </Stack>
      </Box>

      <Dialog open={dokladkaOpen} onClose={() => setDokladkaOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Dokládka ze skladu</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ fontSize: 13, mb: 2 }}>
            Přidá kusy produktu ze skladu navíc k objednávce. Při doručení vývozu se automaticky odečtou ze skladu.
          </Typography>
          <Stack spacing={2}>
            <Combobox
              label="Produkt (skladem)"
              value={dokladkaProductId}
              onChange={setDokladkaProductId}
              options={stockOptions}
              placeholder="Vyberte produkt…"
              fullWidth
            />
            <TextField
              label="Počet kusů"
              type="number"
              size="small"
              fullWidth
              value={dokladkaQty}
              onChange={(e) => setDokladkaQty(e.target.value)}
              slotProps={{ htmlInput: { min: 1 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDokladkaOpen(false)} color="inherit">Zrušit</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void saveDokladka()}>Přidat dokládku</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
