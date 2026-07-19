import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box, Breadcrumbs, Button, ButtonBase, Card, Checkbox, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, Link, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseOutlined';
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

/** F1/F2 invoice picker — an unfilled segmented control (grey track, white
 * active pill), matching the prototype's `.seg` rather than a solid amber fill. */
function InvoiceSeg({ value, onChange, disabled }: { value: 1 | 2; onChange: (v: 1 | 2) => void; disabled?: boolean }) {
  return (
    <Box sx={{ display: 'inline-flex', gap: '2px', p: '2px', borderRadius: 1.5, bgcolor: 'brand.surface3' }}>
      {([1, 2] as const).map((n) => {
        const on = value === n;
        return (
          <ButtonBase
            key={n}
            disabled={disabled}
            onClick={() => onChange(n)}
            sx={{
              px: 1.1, py: 0.35, borderRadius: 1, fontSize: 11.5, fontWeight: 700,
              bgcolor: on ? 'background.paper' : 'transparent',
              color: on ? 'text.primary' : 'text.secondary',
              boxShadow: on ? 1 : 'none',
              '&:hover': { color: 'text.primary' },
            }}
          >
            F{n}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

const HEAD_SX = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' as const, letterSpacing: '0.03em', borderBottom: 'none' };

function LoadingRow({
  row, tab, editable, loaded, checked, onLoaded, onInvoice, onToggleChecked, onRemove,
}: {
  row: NakladkaRow;
  tab: Tab;
  editable: boolean;
  loaded: boolean;
  checked: boolean;
  onLoaded: (loaded: boolean) => void;
  onInvoice: (invoice: 1 | 2) => void;
  onToggleChecked: () => void;
  onRemove?: () => void;
}) {
  const chipText = `${kindLabel(row.kind) ?? ''}${row.packageSize != null ? ` · ${fmtLiters(row.packageSize)}` : ''}`.replace(/^ · /, '');
  return (
    <TableRow hover>
      <TableCell>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
          {chipText && <Chip size="small" label={chipText} sx={{ height: 19, fontSize: 10.5, fontWeight: 600 }} />}
          {row.dokladka && (
            <Chip
              size="small"
              label={
                <Stack direction="row" spacing={0.25} alignItems="center">
                  <span>dokládka +{row.quantity}</span>
                  {onRemove && editable && (
                    <Box component="span" onClick={onRemove} sx={{ display: 'inline-flex', cursor: 'pointer', ml: 0.25 }} title="Odebrat dokládku">
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </Box>
                  )}
                </Stack>
              }
              sx={{ height: 19, fontSize: 10.5, fontWeight: 700, color: 'info.main', bgcolor: (t) => t.vars!.palette.brand.infoTint }}
            />
          )}
        </Stack>
      </TableCell>
      <TableCell align="right">
        <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{row.quantity} ks</Typography>
        {row.dokladka && <Typography sx={{ fontSize: 11, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{row.quantity} ze skladu</Typography>}
      </TableCell>
      {tab === 'all' && (
        <TableCell align="center">
          <InvoiceSeg value={invoiceOf(row)} onChange={onInvoice} disabled={!editable} />
        </TableCell>
      )}
      <TableCell align="center" padding="checkbox">
        <Checkbox size="small" checked={loaded} disabled={!editable} onChange={(e) => onLoaded(e.target.checked)} title="Naloženo (1. diktovaná nakládka)" />
      </TableCell>
      <TableCell align="center" padding="checkbox">
        <Checkbox size="small" checked={checked} disabled={!editable || !loaded} onChange={onToggleChecked} title={loaded ? 'Kontrola (2. kontrolní kolo)' : 'Nejdřív naložit'} />
      </TableCell>
      <TableCell align="right" sx={{ width: 40, pl: 0 }}>
        {onRemove && editable && (
          <IconButton size="small" onClick={onRemove} sx={{ color: 'error.main' }} aria-label="Odebrat">
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
}

/** One bordered card = the header (numbered client + address + Dokládka button)
 * followed by its own product table, matching the prototype's per-stop block. */
function LoadingBlock({
  index, color, title, subtitle, tab, editable, rows, onDokladka, renderRow, emptyText,
}: {
  index: number;
  color: string;
  title: string;
  subtitle: string;
  tab: Tab;
  editable: boolean;
  rows: NakladkaRow[];
  onDokladka?: () => void;
  renderRow: (row: NakladkaRow) => ReactNode;
  emptyText: string;
}) {
  return (
    <Box sx={{ mb: 1.75 }}>
      <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, bgcolor: color }}>
            {index + 1}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{title}</Typography>
            <Typography sx={{ fontSize: 11.5 }} color="text.secondary" noWrap>{subtitle}</Typography>
          </Box>
        </Stack>
        {editable && onDokladka && (
          <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={onDokladka}
            sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}>
            Dokládka ze skladu
          </Button>
        )}
      </Stack>
      {rows.length > 0 ? (
        <Card variant="outlined">
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
                  <TableCell sx={HEAD_SX}>Produkt</TableCell>
                  <TableCell align="right" sx={HEAD_SX}>Množství</TableCell>
                  {tab === 'all' && <TableCell align="center" sx={HEAD_SX}>Faktura</TableCell>}
                  <TableCell align="center" sx={HEAD_SX}>Naloženo</TableCell>
                  <TableCell align="center" sx={HEAD_SX}>Kontrola</TableCell>
                  <TableCell sx={{ ...HEAD_SX, width: 40 }} />
                </TableRow>
              </TableHead>
              <TableBody>{rows.map(renderRow)}</TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <Typography color="text.secondary" sx={{ fontSize: 12.5, py: 1 }}>{emptyText}</Typography>
      )}
    </Box>
  );
}

function stopSubtitle(stop: OutgoingShipmentStopDto): string {
  const address = stop.selectedAddressKind === OutgoingShipmentStopAddressKind.Contact && stop.contactAddress ? stop.contactAddress : stop.officialAddress;
  const addr = address ? `${address.streetName} ${address.streetNumber}, ${address.city}` : '—';
  return `${addr} · ${addrKindLabel(stop.selectedAddressKind)}`;
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
  // "Naloženo" persists via the update mutation, but that round-trips through the
  // API; an optimistic per-row override keeps the checkbox instant (and correct
  // in demo mode where the mock may not echo the flag back). Reset per shipment.
  const [loadedOverride, setLoadedOverride] = useState<Map<string, boolean>>(new Map());
  useEffect(() => { setCheckedIds(new Set()); setLoadedOverride(new Map()); }, [shipment.id]);
  const isLoaded = (row: NakladkaRow) => loadedOverride.get(row.key) ?? row.loaded;

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
  const loadedN = combinedRows.filter((r) => isLoaded(r)).length;
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
    setLoadedOverride((prev) => { const n = new Map(prev); n.set(row.key, loaded); return n; });
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

              {stopsSorted.map((stop, i) => (
                <LoadingBlock
                  key={stop.orderId ?? i}
                  index={i}
                  color={colorForClient(stop.clientId ?? '')}
                  title={stop.clientName ?? '—'}
                  subtitle={stopSubtitle(stop)}
                  tab={tab}
                  editable={nakladkaEditable}
                  rows={(stop.products ?? []).map(productRowFrom).filter((r) => inTab(r, tab))}
                  onDokladka={openDokladka}
                  emptyText="V této faktuře nemá klient žádné položky."
                  renderRow={(row) => (
                    <LoadingRow
                      key={row.key}
                      row={row}
                      tab={tab}
                      editable={nakladkaEditable}
                      loaded={isLoaded(row)}
                      checked={checkedIds.has(row.key)}
                      onLoaded={(loaded) => setRowLoaded(row, loaded)}
                      onInvoice={(inv) => setRowInvoice(row, inv)}
                      onToggleChecked={() => toggleChecked(row.key)}
                    />
                  )}
                />
              ))}

              {extraRows.filter((r) => inTab(r, tab)).length > 0 && (
                <LoadingBlock
                  index={stopsSorted.length}
                  color="#1A2B4C"
                  title="Dokládka ze skladu"
                  subtitle="Kusy navíc mimo objednávky — při doručení se odečtou ze skladu"
                  tab={tab}
                  editable={nakladkaEditable}
                  rows={extraRows.filter((r) => inTab(r, tab))}
                  emptyText="Žádná dokládka."
                  renderRow={(row) => (
                    <LoadingRow
                      key={row.key}
                      row={row}
                      tab={tab}
                      editable={nakladkaEditable}
                      loaded={isLoaded(row)}
                      checked={checkedIds.has(row.key)}
                      onLoaded={(loaded) => setRowLoaded(row, loaded)}
                      onInvoice={(inv) => setRowInvoice(row, inv)}
                      onToggleChecked={() => toggleChecked(row.key)}
                      onRemove={() => removeExtra(row.extraId)}
                    />
                  )}
                />
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
