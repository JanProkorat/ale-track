import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box, Breadcrumbs, Button, ButtonBase, Card, Checkbox, Chip, CircularProgress, Collapse, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, Link, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
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
import { fmtDate, num, fmtLiters, plural, shipmentNumber } from 'src/lib/format';
import { SHIP_STATUS, shipStateName, kindLabel, addrKindName } from 'src/lib/labels';
import {
  type OutgoingShipmentDetailDto,
  type OutgoingShipmentStopDto,
  type OutgoingShipmentOrderItemDto,
  type OutgoingShipmentStockPurchaseItemDto,
  type ProductKind,
  OutgoingShipmentState,
  StockPurchaseDto,
  UpdateOutgoingShipmentDto,
} from 'src/generated/api-client';
import { useUpdateShipment } from 'src/hooks/useShipments';
import { useVehicle } from 'src/hooks/useVehicles';
import { useDrivers } from 'src/hooks/useDrivers';
import { useInventory } from 'src/hooks/useInventory';
import { useProducts } from 'src/hooks/useProducts';
import {
  useAddPurchaseInvoice, useDeletePurchaseInvoice, useSetPurchaseInvoiceLine,
} from 'src/hooks/usePurchaseInvoices';
import { columnTotals } from './purchaseSplitModel';
import {
  PurchaseInvoiceFooterCells, PurchaseInvoiceHeaderCells, PurchaseInvoiceRowCells,
} from './PurchaseInvoiceColumns';
import { colorForClient } from './clientColor';
import { draftFromShipment, type ShipmentDraft } from './shipmentDraft';
import { overdrawnStock } from './nakladkaSourcing';
import { ShipmentInvoicing } from './ShipmentInvoicing';

interface NakladkaRow {
  key: string;
  orderItemId?: string;
  extraId?: string;
  productId?: string;
  stockPurchase: boolean;
  name: string;
  kind?: ProductKind;
  packageSize?: number;
  quantity: number;
  weight: number;
  loaded: boolean;
  /** Of `quantity`, how many pieces come from our own stock (order rows only). */
  fromInventory: number;
  inventoryItemId?: string;
  inventoryItemName?: string;
  /** Pieces on hand in that stock entry, for the over-draw warning. */
  inventoryAvailable?: number;
}

function productRowFrom(p: OutgoingShipmentOrderItemDto): NakladkaRow {
  return {
    key: p.orderItemId ?? p.id ?? '',
    orderItemId: p.orderItemId,
    // OutgoingShipmentOrderItemDto.id is the product's public id.
    productId: p.id,
    stockPurchase: false,
    name: p.name ?? '—',
    kind: p.kind,
    packageSize: p.packageSize,
    quantity: p.quantity ?? 0,
    weight: p.weight ?? 0,
    loaded: p.isShipmentLoadingConfirmed ?? false,
    fromInventory: p.quantityFromInventory ?? 0,
    inventoryItemId: p.inventoryItemId,
    inventoryItemName: p.inventoryItemName,
    inventoryAvailable: p.inventoryItemAvailable,
  };
}
function extraRowFrom(e: OutgoingShipmentStockPurchaseItemDto): NakladkaRow {
  return {
    key: `extra-${e.id}`,
    extraId: e.id,
    productId: e.productId,
    stockPurchase: true,
    name: e.name ?? '—',
    kind: e.kind,
    packageSize: e.packageSize,
    quantity: e.quantity ?? 0,
    weight: e.weight ?? 0,
    loaded: e.isShipmentLoadingConfirmed ?? false,
    fromInventory: 0,
  };
}
const HEAD_SX = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' as const, letterSpacing: '0.03em', borderBottom: 'none' };

/** The two checkbox columns: only as wide as the control, since their header is an icon. */
const CHECK_HEAD_SX = { ...HEAD_SX, width: 44, minWidth: 44, color: 'text.secondary' };

function kindSizeChipText(kind: ProductKind | undefined, packageSize: number | undefined): string {
  return `${kindLabel(kind) ?? ''}${packageSize != null ? ` · ${fmtLiters(packageSize)}` : ''}`.replace(/^ · /, '');
}

interface AggRow {
  key: string;
  /** Product this line is of — what a brewery-invoice line is keyed by. */
  productId?: string;
  name: string;
  kind?: ProductKind;
  packageSize?: number;
  quantity: number;
  orderQuantity: number;
  stockPurchaseQuantity: number;
  /** Pieces of this product taken from our own stock to fulfil orders. */
  fromInventory: number;
  stockPurchase: boolean;      // every source is bought for our warehouse, none ordered
  sources: NakladkaRow[];      // underlying per-order / per-stock-purchase rows
}

/** Collapse the per-order/per-stock-purchase rows into one line per distinct product
 * (name + kind + package size), summing quantities. This is the loading list —
 * two orders with the same product become a single line with the total. */
function aggregateRows(rows: NakladkaRow[]): AggRow[] {
  const map = new Map<string, AggRow>();
  const order: string[] = [];
  for (const r of rows) {
    const key = `${r.name}|${r.kind ?? ''}|${r.packageSize ?? ''}`;
    let agg = map.get(key);
    if (!agg) {
      agg = { key, productId: r.productId, name: r.name, kind: r.kind, packageSize: r.packageSize, quantity: 0, orderQuantity: 0, stockPurchaseQuantity: 0, fromInventory: 0, stockPurchase: true, sources: [] };
      map.set(key, agg);
      order.push(key);
    }
    agg.quantity += r.quantity;
    if (r.stockPurchase) agg.stockPurchaseQuantity += r.quantity;
    else { agg.orderQuantity += r.quantity; agg.stockPurchase = false; }
    agg.fromInventory += r.fromInventory;
    agg.sources.push(r);
  }
  return order.map((k) => map.get(k)!);
}

interface AggRowState {
  loaded: boolean;
  loadedIndeterminate: boolean;
  checked: boolean;
  checkedIndeterminate: boolean;
}

/** One aggregated product line on "Celková nakládka" — the operational loading
 * row with Naloženo/Kontrola (aggregated across its source order items, hence the
 * indeterminate state) and a removable "Zboží na sklad" badge. Invoicing is not this
 * card's concern; it lives in the Fakturace section. */
function AggLoadingRow({
  agg, state, editable, onLoaded, onToggleChecked, onAdjustStockPurchase, onAdjustSourcing, invoiceCells,
}: {
  agg: AggRow;
  state: AggRowState;
  editable: boolean;
  onLoaded: (loaded: boolean) => void;
  onToggleChecked: () => void;
  onAdjustStockPurchase?: (delta: number) => void;
  onAdjustSourcing?: (delta: number) => void;
  /** The brewery-invoice columns, when the run is split across more than one. */
  invoiceCells?: ReactNode;
}) {
  const chipText = kindSizeChipText(agg.kind, agg.packageSize);
  const adjustable = Boolean(onAdjustStockPurchase) && editable;
  const sourceable = Boolean(onAdjustSourcing) && editable;
  return (
    <TableRow hover>
      <TableCell>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{agg.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
          {chipText && <Chip size="small" label={chipText} sx={{ height: 19, fontSize: 10.5, fontWeight: 600 }} />}
          {agg.stockPurchaseQuantity > 0 && (
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.25, height: 20, borderRadius: 1,
                px: adjustable ? 0.25 : 0.75, fontSize: 10.5, fontWeight: 700, color: 'info.main',
                bgcolor: (t) => t.vars!.palette.brand.infoTint,
              }}
            >
              {adjustable && (
                <IconButton size="small" onClick={() => onAdjustStockPurchase!(-1)} aria-label="Ubrat kus zboží na sklad" sx={{ width: 16, height: 16, color: 'inherit' }}>
                  <RemoveIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
              <span>na sklad {agg.stockPurchaseQuantity}</span>
              {adjustable && (
                <IconButton size="small" onClick={() => onAdjustStockPurchase!(1)} aria-label="Přidat kus zboží na sklad" sx={{ width: 16, height: 16, color: 'inherit' }}>
                  <AddIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
            </Box>
          )}
        </Stack>
      </TableCell>
      <TableCell align="right">
        <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{agg.quantity} ks</Typography>
        {sourceable ? (
          <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.25 }}>
            <IconButton
              size="small"
              onClick={() => onAdjustSourcing!(-1)}
              disabled={agg.fromInventory === 0}
              aria-label="Ubrat kus ze skladu"
              sx={{ width: 16, height: 16, color: 'info.main' }}
            >
              <RemoveIcon sx={{ fontSize: 12 }} />
            </IconButton>
            <Typography sx={{ fontSize: 11, color: agg.fromInventory > 0 ? 'info.main' : 'text.disabled', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {`${agg.fromInventory} ze skladu`}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onAdjustSourcing!(1)}
              disabled={agg.fromInventory >= agg.orderQuantity}
              aria-label="Přidat kus ze skladu"
              sx={{ width: 16, height: 16, color: 'info.main' }}
            >
              <AddIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Stack>
        ) : agg.fromInventory > 0 && (
          <Typography sx={{ fontSize: 11, color: 'info.main', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {`z toho ${agg.fromInventory} ze skladu`}
          </Typography>
        )}
        {agg.stockPurchaseQuantity > 0 && (
          <Typography sx={{ fontSize: 11, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
            {agg.orderQuantity > 0
              ? `${agg.orderQuantity} obj. + ${agg.stockPurchaseQuantity} na sklad`
              : `${agg.stockPurchaseQuantity} na sklad`}
          </Typography>
        )}
      </TableCell>
      {invoiceCells}
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
 * loaded/kontrola controls and the summed quantity. */
interface LoadingTotals {
  quantity: number;
  loaded: number;
  checked: number;
  count: number;
}

function AggLoadingTable({ rows, totals, renderRow, emptyText, invoiceHeaders, invoiceFooters }: {
  rows: AggRow[];
  totals: LoadingTotals;
  renderRow: (a: AggRow) => ReactNode;
  emptyText: string;
  /** Brewery-invoice column headers and totals; absent when the run is on one invoice. */
  invoiceHeaders?: ReactNode;
  invoiceFooters?: (footSx: object) => ReactNode;
}) {
  if (rows.length === 0) {
    return <Typography color="text.secondary" sx={{ fontSize: 13, py: 2 }}>{emptyText}</Typography>;
  }
  const footSx = { fontWeight: 800, fontVariantNumeric: 'tabular-nums' as const, borderBottom: 'none', fontSize: 12.5 };
  return (
    <Card variant="outlined">
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
              <TableCell sx={HEAD_SX}>Produkt</TableCell>
              <TableCell align="right" sx={HEAD_SX}>Množství</TableCell>
              {invoiceHeaders}
              {/* Icons, not words: "Nadiktováno" and "Kontrola" each forced their column
                  ~65px wider than the checkbox under it. The names live in the tooltips
                  here and on every checkbox in the column. */}
              <TableCell align="center" sx={CHECK_HEAD_SX}>
                <Tooltip title="Nadiktováno (1. diktovaná nakládka)">
                  <RecordVoiceOverOutlinedIcon sx={{ fontSize: 17, display: 'block', mx: 'auto' }} />
                </Tooltip>
              </TableCell>
              <TableCell align="center" sx={CHECK_HEAD_SX}>
                <Tooltip title="Kontrola (2. kontrolní kolo)">
                  <DoneAllOutlinedIcon sx={{ fontSize: 17, display: 'block', mx: 'auto' }} />
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(renderRow)}
            <TableRow sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
              <TableCell sx={{ ...footSx, fontWeight: 700 }}>Celkem k naložení</TableCell>
              <TableCell align="right" sx={footSx}>{totals.quantity} ks</TableCell>
              {invoiceFooters?.(footSx)}
              <TableCell align="center" sx={{ ...footSx, color: totals.count > 0 && totals.loaded === totals.count ? 'success.main' : 'text.primary' }}>
                {totals.loaded}/{totals.count}
              </TableCell>
              <TableCell align="center" sx={{ ...footSx, color: totals.count > 0 && totals.checked === totals.count ? 'success.main' : 'text.primary' }}>
                {totals.checked}/{totals.count}
              </TableCell>
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
 * row per client, expandable to its products), plus a stock-purchase row listing all
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
              title="Zboží na sklad"
              rows={extraRows}
              open={expanded.has('stockPurchase')}
              onToggle={() => toggle('stockPurchase')}
            />
          )}
        </Box>
      ) : (
        <Typography color="text.secondary" sx={{ fontSize: 13, px: 2.5, py: 2 }}>Žádné objednávky.</Typography>
      )}
    </Card>
  );
}

/** Vratky the driver collects on this route. Returns belong to the orders, not
 * to the shipment, so this is read-only and grouped per stop — two orders for
 * one client read as two groups, which is what the driver actually walks. */
export function ReturnsCard({ stops }: { stops: OutgoingShipmentStopDto[] }) {
  const groups = stops.filter((st) => (st.returns ?? []).length > 0);
  if (groups.length === 0) return null;

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <UndoIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Vratky</Typography>
      </Stack>
      <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
        {groups.map((stop) => (
          <Box key={stop.id} sx={{ px: 2.5, py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', flexShrink: 0, bgcolor: colorForClient(stop.clientId ?? '') }} />
              <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{stop.clientName ?? '—'}</Typography>
            </Stack>
            <Stack spacing={1}>
              {(stop.returns ?? []).map((r) => (
                <Stack key={r.id} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13.5 }} noWrap>{r.name}</Typography>
                    {r.note && <Typography variant="caption" color="text.secondary">{r.note}</Typography>}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.quantity}×</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Card>
  );
}

/** Vývoz detail: route map, advance-state header, and the nakládka card
 * (invoice-split tabs, two-stage loading check, goods bought for our own warehouse). Matches
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
  const productsQuery = useProducts();
  const addPurchaseInvoice = useAddPurchaseInvoice(shipment.id);
  const deletePurchaseInvoice = useDeletePurchaseInvoice(shipment.id);
  const setPurchaseInvoiceLine = useSetPurchaseInvoiceLine(shipment.id);

  // "Kontrola" (2nd check round) has no field on the real DTO (only a single
  // isLoadingConfirmed flag exists) — kept as ephemeral, session-only local
  // state, reset whenever a different shipment is opened.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  // "Naloženo" persists via the update mutation, but that round-trips through the
  // API; an optimistic per-row override keeps the control instant.
  const [loadedOverride, setLoadedOverride] = useState<Map<string, boolean>>(new Map());
  useEffect(() => { setCheckedIds(new Set()); setLoadedOverride(new Map()); }, [shipment.id]);
  const isLoaded = (row: NakladkaRow) => loadedOverride.get(row.key) ?? row.loaded;

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [stockPurchaseOpen, setStockPurchaseOpen] = useState(false);
  const [stockPurchaseProductId, setStockPurchaseProductId] = useState<string | null>(null);
  const [stockPurchaseQty, setStockPurchaseQty] = useState('1');

  const nakladkaEditable = editable && !['Delivered', 'Cancelled'].includes(shipStateName(shipment.state) ?? '');

  const stopsSorted = useMemo(
    () => (shipment.stops ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [shipment.stops],
  );
  const routeStops: RouteStop[] = useMemo(() => stopsSorted.map((st): RouteStop => {
    if (st.orderId == null) {
      return { lat: st.latitude, lng: st.longitude, label: st.label ?? 'Zastávka', color: '#1A2B4C', kind: 'custom' };
    }
    const address = addrKindName(st.selectedAddressKind) === 'Contact' && st.contactAddress ? st.contactAddress : st.officialAddress;
    return { lat: address?.latitude, lng: address?.longitude, label: st.clientName ?? '—', color: colorForClient(st.clientId ?? ''), kind: 'order' };
  }), [stopsSorted]);

  const extraRows = useMemo(() => (shipment.stockPurchases ?? []).map(extraRowFrom), [shipment.stockPurchases]);

  // Custom extras belong to the orders on the route; the nakládka only lists them.
  const customExtras = useMemo(
    () => stopsSorted.flatMap((st) => (st.customExtraItems ?? []).map((extra) => ({
      clientName: st.clientName ?? '—', extra,
    }))),
    [stopsSorted],
  );

  // Warned about rather than blocked: a booked delivery may still land in time.
  const overdrawn = useMemo(() => overdrawnStock(stopsSorted), [stopsSorted]);
  const combinedRows = useMemo(
    () => [...stopsSorted.flatMap((st) => (st.products ?? []).map(productRowFrom)), ...extraRows],
    [stopsSorted, extraRows],
  );
  const aggRows = useMemo(() => aggregateRows(combinedRows), [combinedRows]);

  // Two brewery-invoice columns are always on screen; the second usually has no
  // invoice behind it until a number is typed into it, which the server then
  // materialises. Anything beyond two comes from "+ Faktura pivovaru".
  const purchaseInvoices = useMemo(() => shipment.purchaseInvoices ?? [], [shipment.purchaseInvoices]);
  const purchaseTotals = useMemo(() => columnTotals(aggRows, purchaseInvoices), [aggRows, purchaseInvoices]);
  // Aggregated-row state derives from the per-source overrides: a product line is
  // "loaded" only when all its source order items are, and indeterminate between.
  const aggLoaded = (a: AggRow) => a.sources.length > 0 && a.sources.every((r) => isLoaded(r));
  const aggLoadedIndeterminate = (a: AggRow) => a.sources.some((r) => isLoaded(r)) && !aggLoaded(a);
  const aggChecked = (a: AggRow) => a.sources.length > 0 && a.sources.every((r) => checkedIds.has(r.key));
  const aggCheckedIndeterminate = (a: AggRow) => a.sources.some((r) => checkedIds.has(r.key)) && !aggChecked(a);

  const productN = aggRows.length;
  const loadedN = aggRows.filter(aggLoaded).length;
  const checkedN = aggRows.filter(aggChecked).length;
  const totalQty = aggRows.reduce((s, a) => s + a.quantity, 0);
  const totalWeight = combinedRows.reduce((sum, r) => sum + r.weight * r.quantity, 0);

  const vehicle = vehicleQuery.data;
  const overloaded = Boolean(vehicle?.maxWeight != null && totalWeight > vehicle.maxWeight);
  const assignedDrivers = (driversQuery.data ?? []).filter((d) => (shipment.driverIds ?? []).includes(d.id ?? ''));

  const stateName = shipStateName(shipment.state);
  const status = SHIP_STATUS[stateName ?? 'Created'] ?? SHIP_STATUS.Created;

  // Lifecycle transitions from the current state. The backend serializes the
  // state as a string ("Created"), while the generated enum is numeric, so the
  // logic keys off the normalized name (shipStateName), not the raw value.
  const S = OutgoingShipmentState;
  const shipmentActive = stateName === 'Created' || stateName === 'Loaded' || stateName === 'InTransit';
  const forwardStep = ({
    Created: { to: S.Loaded, label: 'Naložit', icon: <CheckIcon />, primary: false },
    Loaded: { to: S.InTransit, label: 'Vyrazit', icon: <LocalShippingOutlinedIcon />, primary: false },
    InTransit: { to: S.Delivered, label: 'Doručit', icon: <CheckIcon />, primary: true },
  } as Record<string, { to: OutgoingShipmentState; label: string; icon: ReactNode; primary: boolean }>)[stateName ?? ''];
  const revertTo = ({
    Loaded: S.Created,
    InTransit: S.Loaded,
    Delivered: S.InTransit,
  } as Record<string, OutgoingShipmentState>)[stateName ?? ''];
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
        const e = draft.stockPurchases.find((x) => x.id === row.extraId);
        if (e) e.isLoadingConfirmed = loaded;
      }
    }
    if (!loaded) setCheckedIds((prev) => { const n = new Set(prev); for (const r of rows) n.delete(r.key); return n; });
    void save(draft);
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

  // Adjust the "Zboží na sklad" quantity of an aggregated product by `delta`
  // (+1 / -1). Removes the item at zero.
  //
  // No stock-on-hand cap: these pieces are bought from the brewery *for* our
  // warehouse and are added to inventory when the shipment is delivered. Capping
  // them at what we already hold was the old "dokládka ze skladu" reading of this
  // feature, and it was backwards.
  function adjustStockPurchase(agg: AggRow, delta: number) {
    const extra = agg.sources.find((r) => r.extraId);
    if (!extra) return;
    const draft = draftFromShipment(shipment);
    const item = draft.stockPurchases.find((e) => e.id === extra.extraId);
    if (!item) return;

    const next = (item.quantity ?? 0) + delta;
    if (next <= 0) {
      draft.stockPurchases = draft.stockPurchases.filter((e) => e.id !== extra.extraId);
      enqueueSnackbar('Zboží na sklad odebráno.', { variant: 'success' });
    } else {
      item.quantity = next;
    }
    void save(draft);
  }

  /** The stock entry holding this product, if any. */
  const stockItemFor = (productId?: string) =>
    productId == null ? undefined : (inventoryQuery.data ?? [])
      .flatMap((sec) => sec.items ?? [])
      .find((i) => i.productId === productId);

  // Move a piece of an aggregated product between "from the brewery" and "from our
  // stock". Ordered quantities never change — only where the pieces come from.
  // An aggregated line can span several orders, so a increase lands on the first
  // row with brewery pieces left and a decrease comes off the last sourced one.
  function adjustSourcing(agg: AggRow, delta: number) {
    const orderRows = agg.sources.filter((r) => r.orderItemId);
    const target = delta > 0
      ? orderRows.find((r) => r.fromInventory < r.quantity)
      : [...orderRows].reverse().find((r) => r.fromInventory > 0);

    if (!target) {
      if (delta > 0) enqueueSnackbar('Všechny kusy už jsou ze skladu.', { variant: 'info' });
      return;
    }

    const stockItem = stockItemFor(target.productId);
    if (delta > 0 && !stockItem) {
      enqueueSnackbar('Produkt není veden na skladě.', { variant: 'warning' });
      return;
    }

    const draft = draftFromShipment(shipment);
    const item = draft.clientOrderShipments
      .flatMap((cos) => cos.orderItems ?? [])
      .find((i) => i.orderItemId === target.orderItemId);
    if (!item) return;

    const next = (item.quantityFromInventory ?? 0) + delta;
    item.quantityFromInventory = Math.max(0, Math.min(next, target.quantity));
    item.inventoryItemId = item.quantityFromInventory > 0 ? stockItem?.id ?? target.inventoryItemId : undefined;

    // Deliberately no stock cap here: drawing more than is on hand is allowed and
    // surfaced by the banner, because a booked delivery may still arrive in time.
    void save(draft);
  }

  // The brewery's catalogue, not our stock: this buys goods we do not have yet.
  // The on-hand figure rides along as a hint, because knowing we already hold 40
  // is what decides whether to buy more.
  const purchaseOptions: ComboOption[] = useMemo(() => {
    const onHandByProduct = new Map<string, number>();
    for (const item of (inventoryQuery.data ?? []).flatMap((s) => s.items ?? [])) {
      if (item.productId) onHandByProduct.set(item.productId, (onHandByProduct.get(item.productId) ?? 0) + (item.quantity ?? 0));
    }

    return (productsQuery.data ?? [])
      .filter((p) => p.id)
      .map((p) => {
        const onHand = onHandByProduct.get(p.id!) ?? 0;
        return {
          value: p.id!,
          label: `${p.name}${p.packageSize != null ? ` (${fmtLiters(p.packageSize)})` : ''}`
            + (onHand > 0 ? ` — skladem ${onHand} ks` : ''),
        };
      });
  }, [productsQuery.data, inventoryQuery.data]);

  function openStockPurchase() {
    setStockPurchaseProductId(null);
    setStockPurchaseQty('1');
    setStockPurchaseOpen(true);
  }

  async function saveStockPurchase() {
    const qty = parseInt(stockPurchaseQty, 10) || 0;
    if (!stockPurchaseProductId) { enqueueSnackbar('Vyberte produkt', { variant: 'warning' }); return; }
    if (qty <= 0) { enqueueSnackbar('Zadejte počet kusů', { variant: 'warning' }); return; }

    const draft = draftFromShipment(shipment);
    const existing = draft.stockPurchases.find((e) => e.productId === stockPurchaseProductId);
    if (existing) {
      existing.quantity = (existing.quantity ?? 0) + qty;
    } else {
      const dto = new StockPurchaseDto({
        quantity: qty, isLoadingConfirmed: false,
      });
      // Assign the derived-class field after construction (see shipmentDraft.ts).
      dto.productId = stockPurchaseProductId!;
      draft.stockPurchases.push(dto);
    }
    await save(draft);
    setStockPurchaseOpen(false);
    enqueueSnackbar('Zboží na sklad přidáno do nakládky.', { variant: 'success' });
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
            Vývoz · <Box component="span" sx={{ fontFamily: 'monospace' }}>{shipmentNumber(shipment.id)}</Box>
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
          {editable && stateName === 'Cancelled' && (
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

      <RouteMap stops={routeStops} viaPoints={(shipment.routeViaPoints ?? []).map((p) => ({ lat: p.latitude ?? 0, lng: p.longitude ?? 0 }))} height={360} />

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, alignItems: 'start', mt: 2.5 }}>
        <Stack spacing={2}>
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Inventory2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Celková nakládka</Typography>
              <Box sx={{ flex: 1 }} />
              {nakladkaEditable && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={openStockPurchase}
                    sx={ghostBtnSx}>
                    Zboží na sklad
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />}
                    disabled={addPurchaseInvoice.isPending}
                    onClick={() => addPurchaseInvoice.mutate(undefined, {
                      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Fakturu se nepodařilo přidat'), { variant: 'error' }),
                    })}
                    sx={ghostBtnSx}>
                    Faktura pivovaru
                  </Button>
                </Stack>
              )}
            </Stack>
            <Box sx={{ px: 2.5, py: 2 }}>
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <StatusPill tone={productN > 0 && loadedN === productN ? 'ok' : 'grey'} label={`Naloženo ${loadedN}/${productN}`} />
                <StatusPill tone={productN > 0 && checkedN === productN ? 'ok' : 'grey'} label={`Zkontrolováno ${checkedN}/${productN}`} />
              </Stack>
              <AggLoadingTable
                rows={aggRows}
                totals={{ quantity: totalQty, loaded: loadedN, checked: checkedN, count: productN }}
                emptyText="Zatím žádné produkty k naložení."
                invoiceHeaders={(
                  <PurchaseInvoiceHeaderCells
                    invoices={purchaseInvoices}
                    editable={nakladkaEditable}
                    onDelete={(invoiceId) => deletePurchaseInvoice.mutate(invoiceId, {
                      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Fakturu se nepodařilo smazat'), { variant: 'error' }),
                    })}
                  />
                )}
                invoiceFooters={(footSx) => <PurchaseInvoiceFooterCells totals={purchaseTotals} sx={footSx} />}
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
                    }}
                    onLoaded={(loaded) => applyLoaded(agg.sources, loaded)}
                    onToggleChecked={() => toggleCheckedRows(agg.sources)}
                    onAdjustStockPurchase={agg.stockPurchaseQuantity > 0 ? (delta) => adjustStockPurchase(agg, delta) : undefined}
                    onAdjustSourcing={agg.orderQuantity > 0 ? (delta) => adjustSourcing(agg, delta) : undefined}
                    invoiceCells={(
                      <PurchaseInvoiceRowCells
                        row={agg}
                        invoices={purchaseInvoices}
                        editable={nakladkaEditable}
                        onSet={(sequence, quantity) => setPurchaseInvoiceLine.mutate(
                          { sequence, productId: agg.productId!, quantity },
                          { onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Rozdělení se nepodařilo uložit'), { variant: 'error' }) },
                        )}
                      />
                    )}
                  />
                )}
              />
            </Box>
          </Card>

          {overdrawn.length > 0 && (
            <Card sx={{ overflow: 'hidden', borderColor: 'warning.main', borderWidth: 1, borderStyle: 'solid' }}>
              <Stack direction="row" spacing={1.5} sx={{ px: 2.5, py: 1.75 }}>
                <WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'warning.main', mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                    Ze skladu je odebráno víc, než je skladem
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Nakládku to nezablokuje — zásoba se může doplnit dřív, než vývoz vyjede.
                  </Typography>
                  <Stack sx={{ mt: 1 }} spacing={0.25}>
                    {overdrawn.map((e) => (
                      <Typography key={e.name} sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>{e.name}</Box>
                        {` — odebráno ${e.taken} ks, skladem ${e.available} ks`}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </Card>
          )}

          {customExtras.length > 0 && (
            <Card sx={{ overflow: 'hidden' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Extra položky (vratné obaly ap.)</Typography>
              </Stack>
              <Stack sx={{ px: 2.5, py: 1.5 }} spacing={1}>
                {/* Owned by the order — added there, only displayed here. */}
                {customExtras.map(({ clientName, extra }) => (
                  <Stack key={extra.id} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap>{extra.description}</Typography>
                      <Typography variant="caption" color="text.secondary">{clientName}</Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{extra.quantity} ks</Typography>
                  </Stack>
                ))}
              </Stack>
            </Card>
          )}
        </Stack>

        <Stack spacing={2}>
          {/* Both are short, sparse cards — side by side they read as one "kdo a čím" block
              instead of two mostly-empty rows. */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, alignItems: 'stretch' }}>
            <Card sx={{ overflow: 'hidden', height: '100%' }}>
              <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Vůz</Typography>
              </Stack>
              <Box sx={{ p: 2 }}>
                {!shipment.vehicleId ? (
                  <Typography variant="body2" color="text.secondary">Vůz nepřiřazen</Typography>
                ) : vehicleQuery.isLoading ? (
                  <CircularProgress size={20} />
                ) : vehicle ? (
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: 'action.hover' }}>
                        <DirectionsCarOutlinedIcon fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>{vehicle.name}</Typography>
                        <Typography variant="caption" color="text.secondary">Nosnost {num(vehicle.maxWeight ?? 0)} kg</Typography>
                      </Box>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                      <Typography variant="body2" color="text.secondary">Odhad. hmotnost</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', color: overloaded ? 'error.main' : 'success.main' }}>
                        {num(Math.round(totalWeight))} kg
                      </Typography>
                    </Stack>
                    {overloaded && <StatusPill tone="crit" label="Překročena nosnost!" />}
                  </Stack>
                ) : null}
              </Box>
            </Card>

            <Card sx={{ overflow: 'hidden', height: '100%' }}>
              <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Řidiči</Typography>
              </Stack>
              <Stack spacing={1.25} sx={{ p: 2 }}>
                {assignedDrivers.length > 0 ? assignedDrivers.map((d) => (
                  /* The colour rides a full-height bar instead of a dot: a dot has to pick a line
                     to sit on, and picks wrong as soon as the phone line is empty. */
                  <Box key={d.id} sx={{ pl: 1.25, borderLeft: 3, borderColor: d.color ?? 'text.disabled', minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>{d.firstName} {d.lastName}</Typography>
                    {/* Rendered even when empty so a driver without a phone occupies the same
                        height as one with it — the card must not resize per driver. */}
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {d.phoneNumber || '\u00A0'}
                    </Typography>
                  </Box>
                )) : <Typography variant="body2" color="text.secondary">Bez řidiče</Typography>}
              </Stack>
            </Card>
          </Box>

          <OrdersOverviewCard stops={stopsSorted.filter((st) => st.orderId != null)} extraRows={extraRows} />

          <ReturnsCard stops={stopsSorted} />
        </Stack>
      </Box>

      {/* Full width below the grid: the split needs the whole row, and its audience
          (the office doing the billing) is not the nakládka's. */}
      <Box sx={{ mt: 2.5 }}>
        <ShipmentInvoicing shipmentId={shipment.id!} editable={nakladkaEditable} />
      </Box>

      <Dialog open={stockPurchaseOpen} onClose={() => setStockPurchaseOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Zboží na sklad</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ fontSize: 13, mb: 2 }}>
            Nákup od pivovaru nad rámec objednávek — zboží se veze s vývozem a při doručení se naskladní.
          </Typography>
          <Stack spacing={2}>
            <Combobox
              label="Produkt"
              value={stockPurchaseProductId}
              onChange={setStockPurchaseProductId}
              options={purchaseOptions}
              placeholder="Vyberte produkt…"
              fullWidth
            />
            <TextField
              label="Počet kusů"
              type="number"
              size="small"
              fullWidth
              value={stockPurchaseQty}
              onChange={(e) => setStockPurchaseQty(e.target.value)}
              slotProps={{ htmlInput: { min: 1 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockPurchaseOpen(false)} color="inherit">Zrušit</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void saveStockPurchase()}>Přidat na sklad</Button>
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
