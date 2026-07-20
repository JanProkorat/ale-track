import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box, Breadcrumbs, Button, ButtonBase, Card, Checkbox, Chip, CircularProgress, Collapse, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, Link, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNextOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import BlockIcon from '@mui/icons-material/BlockOutlined';
import ReplayIcon from '@mui/icons-material/ReplayOutlined';
import { useSnackbar } from 'notistack';
import { StatusPill } from 'src/components/common/StatusPill';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { RouteMap, type RouteStop } from 'src/components/common/RouteMap';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, num, fmtLiters, plural } from 'src/lib/format';
import { SHIP_STATUS, shipStateName, kindLabel } from 'src/lib/labels';
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

interface NakladkaRow {
  key: string;
  orderItemId?: string;
  extraId?: string;
  productId?: string;
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
    productId: e.productId,
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
/** Effective invoice-2 quantity for a row (clamped to the row total). F1 is
 * always the remainder, so a single value fully describes the split. */
function f2Quantity(row: NakladkaRow): number {
  return Math.max(0, Math.min(row.secondInvoiceQuantity, row.quantity));
}

const HEAD_SX = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' as const, letterSpacing: '0.03em', borderBottom: 'none' };

function kindSizeChipText(kind: ProductKind | undefined, packageSize: number | undefined): string {
  return `${kindLabel(kind) ?? ''}${packageSize != null ? ` · ${fmtLiters(packageSize)}` : ''}`.replace(/^ · /, '');
}

/** F1/F2 split stepper: +/- moves one piece between invoices, F1 = remainder.
 * Supports partial splits (e.g. 4 pieces on F1, 2 on F2). */
function InvoiceSplit({ f2, quantity, onMove, disabled }: { f2: number; quantity: number; onMove: (delta: number) => void; disabled?: boolean }) {
  const f1 = quantity - f2;
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
      <IconButton size="small" disabled={disabled || f2 <= 0} onClick={() => onMove(-1)} aria-label="Přesunout kus na fakturu 1" sx={{ width: 24, height: 24 }}>
        <RemoveIcon sx={{ fontSize: 15 }} />
      </IconButton>
      <Box sx={{ minWidth: 78, textAlign: 'center', fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        <Box component="span" sx={{ color: f1 > 0 ? 'text.primary' : 'text.disabled' }}>F1 {f1}</Box>
        <Box component="span" sx={{ color: 'text.disabled', mx: 0.5 }}>·</Box>
        <Box component="span" sx={{ color: f2 > 0 ? 'warning.dark' : 'text.disabled' }}>F2 {f2}</Box>
      </Box>
      <IconButton size="small" disabled={disabled || f1 <= 0} onClick={() => onMove(1)} aria-label="Přesunout kus na fakturu 2" sx={{ width: 24, height: 24 }}>
        <AddIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Stack>
  );
}

interface AggRow {
  key: string;
  name: string;
  kind?: ProductKind;
  packageSize?: number;
  quantity: number;
  orderQuantity: number;
  dokladkaQuantity: number;
  dokladka: boolean;           // every source is a dokládka (pure stock extra)
  sources: NakladkaRow[];      // underlying per-order / per-dokládka rows
}

/** Collapse the per-order/per-dokládka rows into one line per distinct product
 * (name + kind + package size), summing quantities. This is the loading list —
 * two orders with the same product become a single line with the total. */
function aggregateRows(rows: NakladkaRow[]): AggRow[] {
  const map = new Map<string, AggRow>();
  const order: string[] = [];
  for (const r of rows) {
    const key = `${r.name}|${r.kind ?? ''}|${r.packageSize ?? ''}`;
    let agg = map.get(key);
    if (!agg) {
      agg = { key, name: r.name, kind: r.kind, packageSize: r.packageSize, quantity: 0, orderQuantity: 0, dokladkaQuantity: 0, dokladka: true, sources: [] };
      map.set(key, agg);
      order.push(key);
    }
    agg.quantity += r.quantity;
    if (r.dokladka) agg.dokladkaQuantity += r.quantity;
    else { agg.orderQuantity += r.quantity; agg.dokladka = false; }
    agg.sources.push(r);
  }
  return order.map((k) => map.get(k)!);
}

interface AggRowState {
  loaded: boolean;
  loadedIndeterminate: boolean;
  checked: boolean;
  checkedIndeterminate: boolean;
  f2: number;
}

/** One aggregated product line on "Celková nakládka" — the operational loading
 * row with invoice split, Naloženo/Kontrola (aggregated across its source order
 * items, hence the indeterminate state) and a removable dokládka badge. */
function AggLoadingRow({
  agg, state, editable, onLoaded, onMoveInvoice, onToggleChecked, onAdjustDokladka,
}: {
  agg: AggRow;
  state: AggRowState;
  editable: boolean;
  onLoaded: (loaded: boolean) => void;
  onMoveInvoice: (delta: number) => void;
  onToggleChecked: () => void;
  onAdjustDokladka?: (delta: number) => void;
}) {
  const chipText = kindSizeChipText(agg.kind, agg.packageSize);
  const adjustable = Boolean(onAdjustDokladka) && editable;
  return (
    <TableRow hover>
      <TableCell>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{agg.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
          {chipText && <Chip size="small" label={chipText} sx={{ height: 19, fontSize: 10.5, fontWeight: 600 }} />}
          {agg.dokladkaQuantity > 0 && (
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.25, height: 20, borderRadius: 1,
                px: adjustable ? 0.25 : 0.75, fontSize: 10.5, fontWeight: 700, color: 'info.main',
                bgcolor: (t) => t.vars!.palette.brand.infoTint,
              }}
            >
              {adjustable && (
                <IconButton size="small" onClick={() => onAdjustDokladka!(-1)} aria-label="Ubrat kus dokládky" sx={{ width: 16, height: 16, color: 'inherit' }}>
                  <RemoveIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
              <span>dokládka {agg.dokladkaQuantity}</span>
              {adjustable && (
                <IconButton size="small" onClick={() => onAdjustDokladka!(1)} aria-label="Přidat kus dokládky" sx={{ width: 16, height: 16, color: 'inherit' }}>
                  <AddIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
            </Box>
          )}
        </Stack>
      </TableCell>
      <TableCell align="right">
        <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{agg.quantity} ks</Typography>
        {agg.dokladkaQuantity > 0 && (
          <Typography sx={{ fontSize: 11, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
            {agg.orderQuantity > 0 ? `${agg.orderQuantity} obj. + ${agg.dokladkaQuantity} dokl.` : `${agg.dokladkaQuantity} ze skladu`}
          </Typography>
        )}
      </TableCell>
      <TableCell align="center">
        <InvoiceSplit f2={state.f2} quantity={agg.quantity} onMove={onMoveInvoice} disabled={!editable} />
      </TableCell>
      <TableCell align="center" padding="checkbox">
        <Checkbox size="small" checked={state.loaded} indeterminate={state.loadedIndeterminate} disabled={!editable} onChange={() => onLoaded(!state.loaded)} title="Naloženo (1. diktovaná nakládka)" />
      </TableCell>
      <TableCell align="center" padding="checkbox">
        <Checkbox size="small" checked={state.checked} indeterminate={state.checkedIndeterminate} disabled={!editable || !state.loaded} onChange={onToggleChecked} title={state.loaded ? 'Kontrola (2. kontrolní kolo)' : 'Nejdřív naložit'} />
      </TableCell>
    </TableRow>
  );
}

/** "Celková nakládka" — the loading list: one row per distinct product with the
 * invoice/loaded/kontrola controls and the summed quantity. */
function AggLoadingTable({ rows, renderRow, emptyText }: { rows: AggRow[]; renderRow: (a: AggRow) => ReactNode; emptyText: string }) {
  if (rows.length === 0) {
    return <Typography color="text.secondary" sx={{ fontSize: 13, py: 2 }}>{emptyText}</Typography>;
  }
  const total = rows.reduce((s, r) => s + r.quantity, 0);
  return (
    <Card variant="outlined">
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
              <TableCell sx={HEAD_SX}>Produkt</TableCell>
              <TableCell align="right" sx={HEAD_SX}>Množství</TableCell>
              <TableCell align="center" sx={HEAD_SX}>Faktura</TableCell>
              <TableCell align="center" sx={HEAD_SX}>Naloženo</TableCell>
              <TableCell align="center" sx={HEAD_SX}>Kontrola</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(renderRow)}
            <TableRow>
              <TableCell sx={{ fontWeight: 700, borderBottom: 'none' }}>Celkem k naložení</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', borderBottom: 'none' }}>{total} ks</TableCell>
              <TableCell colSpan={3} sx={{ borderBottom: 'none' }} />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function ProductLine({ row }: { row: NakladkaRow }) {
  const chipText = kindSizeChipText(row.kind, row.packageSize);
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.75, px: 2.5, borderTop: 1, borderColor: 'divider' }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 12.5 }} noWrap>{row.name}</Typography>
        {chipText && <Chip size="small" label={chipText} sx={{ height: 18, fontSize: 10, fontWeight: 600, mt: 0.25 }} />}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{row.quantity} ks</Typography>
    </Stack>
  );
}

/** One expandable line in the orders overview: a collapsed header (avatar +
 * title + item count) that reveals its product list on click. */
function OverviewRow({ avatar, title, rows, open, onToggle }: {
  avatar: ReactNode;
  title: string;
  rows: NakladkaRow[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 'none' } }}>
      <ButtonBase
        onClick={onToggle}
        sx={{ width: '100%', px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25, textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}
      >
        {avatar}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{title}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
            {rows.length} {plural(rows.length, 'položka', 'položky', 'položek')}
          </Typography>
        </Box>
        <ExpandMoreIcon sx={{ color: 'text.secondary', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pb: 0.75 }}>
          {rows.length > 0
            ? rows.map((r) => <ProductLine key={r.key} row={r} />)
            : <Typography color="text.secondary" sx={{ fontSize: 12, px: 2.5, py: 1 }}>Žádné položky.</Typography>}
        </Box>
      </Collapse>
    </Box>
  );
}

/** "Přehled objednávek" card — a collapsible list of the shipment's orders (one
 * row per client, expandable to its products), plus a dokládka row listing all
 * stock extras when present. Read-only; the loading workflow lives elsewhere. */
function OrdersOverviewCard({ stops, extraRows }: { stops: OutgoingShipmentStopDto[]; extraRows: NakladkaRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const numberAvatar = (color: string, n: number): ReactNode => (
    <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, bgcolor: color }}>{n}</Box>
  );

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <ReceiptLongOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Přehled objednávek</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.disabled' }}>
          {stops.length} {plural(stops.length, 'objednávka', 'objednávky', 'objednávek')}
        </Typography>
      </Stack>
      {stops.length > 0 || extraRows.length > 0 ? (
        <Box>
          {stops.map((stop, i) => {
            const key = stop.orderId ?? `stop-${i}`;
            return (
              <OverviewRow
                key={key}
                avatar={numberAvatar(colorForClient(stop.clientId ?? ''), i + 1)}
                title={stop.clientName ?? '—'}
                rows={(stop.products ?? []).map(productRowFrom)}
                open={expanded.has(key)}
                onToggle={() => toggle(key)}
              />
            );
          })}
          {extraRows.length > 0 && (
            <OverviewRow
              avatar={
                <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: '#1A2B4C', color: '#fff', '& svg': { fontSize: 15 } }}>
                  <WarehouseOutlinedIcon />
                </Box>
              }
              title="Dokládka ze skladu"
              rows={extraRows}
              open={expanded.has('dokladka')}
              onToggle={() => toggle('dokladka')}
            />
          )}
        </Box>
      ) : (
        <Typography color="text.secondary" sx={{ fontSize: 13, px: 2.5, py: 2 }}>Žádné objednávky.</Typography>
      )}
    </Card>
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

  // "Kontrola" (2nd check round) has no field on the real DTO (only a single
  // isLoadingConfirmed flag exists) — kept as ephemeral, session-only local
  // state, reset whenever a different shipment is opened.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  // "Naloženo" and the invoice split persist via the update mutation, but that
  // round-trips through the API; optimistic per-row overrides keep the controls
  // instant (and correct in demo mode where the mock may not echo values back).
  const [loadedOverride, setLoadedOverride] = useState<Map<string, boolean>>(new Map());
  const [invoiceOverride, setInvoiceOverride] = useState<Map<string, number>>(new Map());
  useEffect(() => { setCheckedIds(new Set()); setLoadedOverride(new Map()); setInvoiceOverride(new Map()); }, [shipment.id]);
  const isLoaded = (row: NakladkaRow) => loadedOverride.get(row.key) ?? row.loaded;
  const rowF2 = (row: NakladkaRow) => {
    const raw = invoiceOverride.get(row.key) ?? f2Quantity(row);
    return Math.max(0, Math.min(raw, row.quantity));
  };

  const [confirmCancel, setConfirmCancel] = useState(false);
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
  const aggRows = useMemo(() => aggregateRows(combinedRows), [combinedRows]);
  // Aggregated-row state derives from the per-source overrides: a product line is
  // "loaded" only when all its source order items are, and indeterminate between.
  const aggLoaded = (a: AggRow) => a.sources.length > 0 && a.sources.every((r) => isLoaded(r));
  const aggLoadedIndeterminate = (a: AggRow) => a.sources.some((r) => isLoaded(r)) && !aggLoaded(a);
  const aggChecked = (a: AggRow) => a.sources.length > 0 && a.sources.every((r) => checkedIds.has(r.key));
  const aggCheckedIndeterminate = (a: AggRow) => a.sources.some((r) => checkedIds.has(r.key)) && !aggChecked(a);
  const aggF2 = (a: AggRow) => a.sources.reduce((s, r) => s + rowF2(r), 0);

  const productN = aggRows.length;
  const loadedN = aggRows.filter(aggLoaded).length;
  const checkedN = aggRows.filter(aggChecked).length;
  const totalWeight = combinedRows.reduce((sum, r) => sum + r.weight * r.quantity, 0);

  const vehicle = vehicleQuery.data;
  const overloaded = Boolean(vehicle?.maxWeight != null && totalWeight > vehicle.maxWeight);
  const assignedDrivers = (driversQuery.data ?? []).filter((d) => (shipment.driverIds ?? []).includes(d.id ?? ''));

  const stateName = shipStateName(shipment.state);
  const status = SHIP_STATUS[stateName ?? 'Created'] ?? SHIP_STATUS.Created;

  // Lifecycle transitions available from the current state.
  const S = OutgoingShipmentState;
  const shipmentActive = shipment.state === S.Created || shipment.state === S.Loaded || shipment.state === S.InTransit;
  const forwardStep = ({
    [S.Created]: { to: S.Loaded, label: 'Naložit', icon: <CheckIcon />, primary: false },
    [S.Loaded]: { to: S.InTransit, label: 'Vyrazit', icon: <LocalShippingOutlinedIcon />, primary: false },
    [S.InTransit]: { to: S.Delivered, label: 'Doručit', icon: <CheckIcon />, primary: true },
  } as Partial<Record<OutgoingShipmentState, { to: OutgoingShipmentState; label: string; icon: ReactNode; primary: boolean }>>)[shipment.state ?? S.Created];
  const revertTo = ({
    [S.Loaded]: S.Created,
    [S.InTransit]: S.Loaded,
    [S.Delivered]: S.InTransit,
  } as Partial<Record<OutgoingShipmentState, OutgoingShipmentState>>)[shipment.state ?? S.Created];
  const ghostBtnSx = { color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } } as const;

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

  // Mark a whole aggregated product (all its source order items) loaded/unloaded
  // in one mutation. Optimistic overrides keep the checkbox instant.
  function applyLoaded(rows: NakladkaRow[], loaded: boolean) {
    setLoadedOverride((prev) => { const n = new Map(prev); for (const r of rows) n.set(r.key, loaded); return n; });
    const draft = draftFromShipment(shipment);
    for (const row of rows) {
      if (row.orderItemId) {
        for (const co of draft.clientOrderShipments) {
          const oi = co.orderItems?.find((x) => x.orderItemId === row.orderItemId);
          if (oi) oi.isLoadingConfirmed = loaded;
        }
      } else if (row.extraId) {
        const e = draft.inventoryExtraShipments.find((x) => x.id === row.extraId);
        if (e) e.isLoadingConfirmed = loaded;
      }
    }
    if (!loaded) setCheckedIds((prev) => { const n = new Set(prev); for (const r of rows) n.delete(r.key); return n; });
    void save(draft);
  }

  // Distribute `targetF2` invoice-2 pieces across a product's source rows (fill
  // each up to its own quantity, in order); F1 is the remainder per row.
  function applyInvoiceDistribution(rows: NakladkaRow[], targetF2: number) {
    let remaining = targetF2;
    const nextOverride = new Map(invoiceOverride);
    const draft = draftFromShipment(shipment);
    for (const row of rows) {
      const give = Math.max(0, Math.min(remaining, row.quantity));
      remaining -= give;
      nextOverride.set(row.key, give);
      const apply = (target: { firstInvoiceQuantity?: number; secondInvoiceQuantity?: number }) => {
        target.firstInvoiceQuantity = row.quantity - give;
        target.secondInvoiceQuantity = give;
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
    }
    setInvoiceOverride(nextOverride);
    void save(draft);
  }

  // Move `delta` pieces of an aggregated product between invoices (+1 -> F2).
  function moveAggInvoice(agg: AggRow, delta: number) {
    const current = aggF2(agg);
    const next = Math.max(0, Math.min(current + delta, agg.quantity));
    if (next === current) return;
    applyInvoiceDistribution(agg.sources, next);
  }

  // Toggle "Kontrola" for a whole product: check all sources, or clear all.
  function toggleCheckedRows(rows: NakladkaRow[]) {
    setCheckedIds((prev) => {
      const n = new Set(prev);
      const all = rows.length > 0 && rows.every((r) => n.has(r.key));
      for (const r of rows) { if (all) n.delete(r.key); else n.add(r.key); }
      return n;
    });
  }

  const stockQtyFor = (productId?: string) =>
    productId == null ? 0 : (inventoryQuery.data ?? [])
      .flatMap((s) => s.items ?? [])
      .filter((i) => i.productId === productId)
      .reduce((sum, i) => sum + (i.quantity ?? 0), 0);

  // Adjust the dokládka (stock-extra) quantity of an aggregated product by
  // `delta` (+1 / -1). Removes the item at zero; caps increases at stock on hand.
  function adjustDokladka(agg: AggRow, delta: number) {
    const extra = agg.sources.find((r) => r.extraId);
    if (!extra) return;
    const draft = draftFromShipment(shipment);
    const item = draft.inventoryExtraShipments.find((e) => e.id === extra.extraId);
    if (!item) return;

    const next = (item.quantity ?? 0) + delta;
    if (next <= 0) {
      draft.inventoryExtraShipments = draft.inventoryExtraShipments.filter((e) => e.id !== extra.extraId);
      enqueueSnackbar('Dokládka odebrána.', { variant: 'success' });
    } else {
      if (delta > 0 && next > stockQtyFor(extra.productId)) {
        enqueueSnackbar(`Na skladě je jen ${stockQtyFor(extra.productId)} ks`, { variant: 'warning' });
        return;
      }
      item.quantity = next;
      // Keep the extra's invoice split consistent with its new total (defaults to F1).
      item.firstInvoiceQuantity = next;
      item.secondInvoiceQuantity = 0;
    }
    void save(draft);
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
      const dto = new InventoryExtraShipmentDto({
        quantity: qty, isLoadingConfirmed: false, firstInvoiceQuantity: qty, secondInvoiceQuantity: 0,
      });
      // Assign the derived-class field after construction (see shipmentDraft.ts).
      dto.productId = dokladkaProductId!;
      draft.inventoryExtraShipments.push(dto);
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
          {editable && forwardStep && (
            <Button variant={forwardStep.primary ? 'contained' : 'outlined'} startIcon={forwardStep.icon} onClick={() => advance(forwardStep.to)}>
              {forwardStep.label}
            </Button>
          )}
          {editable && revertTo !== undefined && (
            <Button variant="outlined" startIcon={<UndoIcon />} onClick={() => advance(revertTo)} sx={ghostBtnSx}>
              Vrátit
            </Button>
          )}
          {editable && shipmentActive && (
            <Button variant="outlined" color="error" startIcon={<BlockIcon />} onClick={() => setConfirmCancel(true)}>
              Zrušit vývoz
            </Button>
          )}
          {editable && shipment.state === OutgoingShipmentState.Cancelled && (
            <Button variant="outlined" startIcon={<ReplayIcon />} onClick={() => advance(OutgoingShipmentState.Created)} sx={ghostBtnSx}>
              Znovu otevřít
            </Button>
          )}
          {editable && shipmentActive && (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={onEdit} sx={ghostBtnSx}>
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
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Celková nakládka</Typography>
              <Box sx={{ flex: 1 }} />
              {nakladkaEditable && (
                <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={openDokladka}
                  sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}>
                  Dokládka ze skladu
                </Button>
              )}
            </Stack>
            <Box sx={{ px: 2.5, py: 2 }}>
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <StatusPill tone={productN > 0 && loadedN === productN ? 'ok' : 'grey'} label={`Naloženo ${loadedN}/${productN}`} />
                <StatusPill tone={productN > 0 && checkedN === productN ? 'ok' : 'grey'} label={`Zkontrolováno ${checkedN}/${productN}`} />
              </Stack>
              <AggLoadingTable
                rows={aggRows}
                emptyText="Zatím žádné produkty k naložení."
                renderRow={(agg) => (
                  <AggLoadingRow
                    key={agg.key}
                    agg={agg}
                    editable={nakladkaEditable}
                    state={{
                      loaded: aggLoaded(agg),
                      loadedIndeterminate: aggLoadedIndeterminate(agg),
                      checked: aggChecked(agg),
                      checkedIndeterminate: aggCheckedIndeterminate(agg),
                      f2: aggF2(agg),
                    }}
                    onLoaded={(loaded) => applyLoaded(agg.sources, loaded)}
                    onMoveInvoice={(delta) => moveAggInvoice(agg, delta)}
                    onToggleChecked={() => toggleCheckedRows(agg.sources)}
                    onAdjustDokladka={agg.dokladkaQuantity > 0 ? (delta) => adjustDokladka(agg, delta) : undefined}
                  />
                )}
              />
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

          <OrdersOverviewCard stops={stopsSorted} extraRows={extraRows} />
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

      <ConfirmDialog
        open={confirmCancel}
        title="Zrušit vývoz?"
        message={
          <>
            Opravdu zrušit vývoz <strong>{shipment.name}</strong>? Objednávky se uvolní zpět k plánování
            a rozúčtování nakládky se vymaže. Vývoz lze později znovu otevřít.
          </>
        }
        confirmLabel="Zrušit vývoz"
        busy={updateShipment.isPending}
        onConfirm={() => { setConfirmCancel(false); advance(OutgoingShipmentState.Cancelled); }}
        onClose={() => setConfirmCancel(false)}
      />
    </Box>
  );
}
