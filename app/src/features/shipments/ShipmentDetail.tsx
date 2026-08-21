import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Backdrop,
  Box, Button, Card, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, Link, ListItemIcon, ListItemText,
  Menu, MenuItem, Stack, TextField, Typography,
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
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import BlockIcon from '@mui/icons-material/BlockOutlined';
import ReplayIcon from '@mui/icons-material/ReplayOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PropaneOutlinedIcon from '@mui/icons-material/PropaneOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpIcon from '@mui/icons-material/KeyboardArrowUpOutlined';
import ArrowDownIcon from '@mui/icons-material/KeyboardArrowDownOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { useSnackbar } from 'notistack';
import { StatusPill } from 'src/components/common/StatusPill';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { RouteMap, type RouteStop, type RouteEndpoint } from 'src/components/common/RouteMap';
import { ProductCombobox } from 'src/components/common/ProductCombobox';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, num, fmtLiters, plural, shipmentNumber } from 'src/lib/format';
import { SHIP_STATUS, shipStateName, kindLabel, startPointKindName } from 'src/lib/labels';
import {
  type OutgoingShipmentDetailDto,
  OutgoingShipmentStopDto,
  type OutgoingShipmentSupplierGoodDto,
  type OutgoingShipmentOrderItemDto,
  type OutgoingShipmentStockPurchaseItemDto,
  type ProductKind,
  type ProductType,
  type ProductListItemDto,
  OutgoingShipmentState,
} from 'src/generated/api-client';
import {
  useSetPreparationStep, useExportShipment, useShipmentStartPoints,
  useSetShipmentState, useSetOrderItemSourcing, useSetSupplierGoodSourcing, useSetStockPurchase,
  useReorderShipmentStops,
  type ShipmentExportFormat,
} from 'src/hooks/useShipments';
import { downloadBlob } from 'src/lib/download';
import { useInventory } from 'src/hooks/useInventory';
import { useProducts } from 'src/hooks/useProducts';
import {
  useAddPurchaseInvoice, useDeletePurchaseInvoice, useSetLoadingState, useSetPurchaseInvoiceLine,
} from 'src/hooks/usePurchaseInvoices';
import { SegControl, type SegOption } from 'src/components/common/SegControl';
import {
  columnsOf, columnTotals, loadingProgress, rowsOnInvoice, type LoadingStateName,
} from './purchaseSplitModel';
import { PurchaseInvoiceChips, PurchaseInvoiceTotalsLines } from './PurchaseInvoiceColumns';
import { NakladkaSource, NakladkaTable } from './NakladkaTable';
import { type StepperAdjust } from './nakladkaControls';
import { groupByBreweryThenKind } from './nakladkaGrouping';
import { colorForClient } from './clientColor';
import { StopAvatar } from './StopAvatar';
import { routeEndpointFrom } from './startPointOption';
import { overdrawnStock } from './nakladkaSourcing';
import { stateChangeProgress, type StateChangeProgress } from './shipmentStateProgress';
import { resolveDetailStopAddress } from './stopAddress';
import {
  aggregateSupplierGoods, nextSourcingWrite, type SupplierGoodRow,
} from './supplierGoodSourcing';
import { stopOverviewEntries, reorderedStopIds, type StopOverviewEntry } from './stopOverview';
import { predictPickupStops, withSplitApplied } from './pickupStopPrediction';
import { platoSizeChipText, unloadOrder } from './unloadOrder';
import { UnloadOrderList } from './UnloadOrderList';
import { ShipmentInvoicing } from './ShipmentInvoicing';
import { AddressChangedBanner } from './AddressChangedBanner';
import { PreparationStepsCard } from './PreparationStepsCard';

interface NakladkaRow {
  key: string;
  orderItemId?: string;
  extraId?: string;
  productId?: string;
  stockPurchase: boolean;
  name: string;
  kind?: ProductKind;
  /** Drives the app-wide product order — limonády read out last. */
  type?: ProductType;
  packageSize?: number;
  platoDegree?: number;
  /** Brewery supplying the product — the loading list is sectioned by it. */
  breweryId?: string;
  breweryName?: string;
  breweryDisplayOrder?: number;
  quantity: number;
  weight: number;
  /** Of `quantity`, how many pieces come from our own stock (order rows only). */
  fromInventory: number;
  inventoryItemId?: string;
  inventoryItemName?: string;
  /** Pieces on hand in that stock entry, for the over-draw warning. */
  inventoryAvailable?: number;
  /**
   * The order line's own note (order rows only). Shown in the per-order overview,
   * never in the aggregated loading table — that table merges the same product
   * across clients, and a note belongs to one client's line.
   */
  note?: string;
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
    type: p.type,
    packageSize: p.packageSize,
    platoDegree: p.platoDegree,
    breweryId: p.breweryId,
    breweryName: p.breweryName,
    breweryDisplayOrder: p.breweryDisplayOrder,
    quantity: p.quantity ?? 0,
    weight: p.weight ?? 0,
    fromInventory: p.quantityFromInventory ?? 0,
    inventoryItemId: p.inventoryItemId,
    inventoryItemName: p.inventoryItemName,
    inventoryAvailable: p.inventoryItemAvailable,
    note: p.note,
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
    type: e.type,
    packageSize: e.packageSize,
    platoDegree: e.platoDegree,
    breweryId: e.breweryId,
    breweryName: e.breweryName,
    breweryDisplayOrder: e.breweryDisplayOrder,
    quantity: e.quantity ?? 0,
    weight: e.weight ?? 0,
    fromInventory: 0,
  };
}
/** Tab value for the unfiltered loading list; the rest are invoice sequences. */
const ALL_INVOICES = 'all';

/** Tab value for the driver's stop-by-stop unload view; every other option
 * filters the loading list instead. A plain string, not a sequence — the
 * invoice tabs' values are `String(sequence)`, always numeric, so there is no
 * real collision risk, but this reads clearly in the SegControl regardless. */
const UNLOAD_VIEW = 'unload';

function kindSizeChipText(kind: ProductKind | undefined, packageSize: number | undefined): string {
  return `${kindLabel(kind) ?? ''}${packageSize != null ? ` · ${fmtLiters(packageSize)}` : ''}`.replace(/^ · /, '');
}

interface AggRow {
  key: string;
  /** Product this line is of — what a brewery-invoice line is keyed by. */
  productId?: string;
  name: string;
  kind?: ProductKind;
  type?: ProductType;
  packageSize?: number;
  platoDegree?: number;
  /** Brewery supplying the product — the section this line is read out under. */
  breweryId?: string;
  breweryName?: string;
  breweryDisplayOrder?: number;
  quantity: number;
  orderQuantity: number;
  stockPurchaseQuantity: number;
  /** Pieces of this product taken from our own stock to fulfil orders. */
  fromInventory: number;
  stockPurchase: boolean;      // every source is bought for our warehouse, none ordered
  sources: NakladkaRow[];      // underlying per-order / per-stock-purchase rows
}

/** Collapse the per-order/per-stock-purchase rows into one line per distinct product
 * (brewery + name + kind + package size), summing quantities. This is the loading list —
 * two orders with the same product become a single line with the total.
 *
 * The brewery joins the key so a line can never straddle two sections: same-named products
 * of two breweries are two lines, which is also what the pallet looks like. */
function aggregateRows(rows: NakladkaRow[]): AggRow[] {
  const map = new Map<string, AggRow>();
  const order: string[] = [];
  for (const r of rows) {
    const key = `${r.breweryId ?? ''}|${r.name}|${r.kind ?? ''}|${r.packageSize ?? ''}`;
    let agg = map.get(key);
    if (!agg) {
      agg = { key, productId: r.productId, name: r.name, kind: r.kind, type: r.type, packageSize: r.packageSize, platoDegree: r.platoDegree, breweryId: r.breweryId, breweryName: r.breweryName, breweryDisplayOrder: r.breweryDisplayOrder, quantity: 0, orderQuantity: 0, stockPurchaseQuantity: 0, fromInventory: 0, stockPurchase: true, sources: [] };
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


/** One labelled number of the Zdroj cluster. */
interface BreakdownEntry {
  label: string;
  value: number;
  adjust?: StepperAdjust;
}

/**
 * Where a product's pieces come from: what the brewery hands over, what comes off
 * our own shelf instead, and what we buy for the shelf.
 *
 * The three are addends of the row's total, not a total and its parts. Sourcing a
 * piece from the garage moves it out of the brewery line, which is why that entry is
 * ordered minus sourced; buying for the shelf adds to the row rather than moving
 * anything.
 *
 * All three come back on every row, zero included. They are the row's own partition,
 * and a line that appears only once it is non-zero leaves the reader working out which
 * of the three is missing before the numbers can be read as a sum — and puts the two
 * that remain on a different line of the cluster than they sit on in the row above. A
 * slot this run cannot change still comes back, just without its stepper.
 *
 * Returned as data rather than rendered, because the table owns the tracks the three
 * numbers line up on; which of them can be edited is this screen's business alone.
 */
function breakdownSlots(
  agg: AggRow,
  sourceable: boolean,
  adjustable: boolean,
  onAdjustSourcing?: (delta: number) => void,
  onAdjustStockPurchase?: (delta: number) => void,
): BreakdownEntry[] {
  return [
    { label: 'z pivovaru', value: agg.orderQuantity - agg.fromInventory },
    {
      label: 'z garáže',
      value: agg.fromInventory,
      adjust: sourceable ? {
        onAdjust: onAdjustSourcing!,
        canDecrease: agg.fromInventory > 0,
        canIncrease: agg.fromInventory < agg.orderQuantity,
        decreaseLabel: 'Ubrat kus z garáže',
        increaseLabel: 'Přidat kus z garáže',
      } : undefined,
    },
    {
      label: 'do garáže',
      value: agg.stockPurchaseQuantity,
      adjust: adjustable ? {
        onAdjust: onAdjustStockPurchase!,
        // The write takes an absolute quantity keyed by product, so the row can open a
        // stock purchase from zero as well as top one up — the dialog is for products the
        // run is not already carrying.
        canDecrease: agg.stockPurchaseQuantity > 0,
        canIncrease: true,
        decreaseLabel: 'Ubrat kus do garáže',
        increaseLabel: 'Přidat kus do garáže',
      } : undefined,
    },
  ];
}










/** One line in the stops overview: avatar + client name, optionally a place chip
 * beside it, and the destination address below.
 *
 * Flat, not expandable: what is on the truck for this stop is the nakládka's job, and
 * repeating it here behind a chevron gave two places to read the same numbers from.
 * The row's only action is opening its order. */
function OverviewRow({ avatar, title, chip, addressLine, onOpen, reorder }: {
  avatar: ReactNode;
  title: string;
  /** Place chip rendered beside the title — only for a stop delivering to a
   *  client's saved place (see `DeliveryAddressKind.DeliveryPlace`). */
  chip?: ReactNode;
  /** The destination line below the title: the place's formatted address, or
   *  the `address · kind` line for the two standard address kinds. */
  addressLine?: string;
  /** Opens the row's source order — makes the client name a link. Omitted for
   *  users who cannot see the Objednávky module, who then get the plain name back. */
  onOpen?: () => void;
  /** Reorder controls, present only while the route can still be resequenced. */
  reorder?: {
    /** Rendered by the sortable wrapper — the grab area. */
    handle?: ReactNode;
    onMove: (delta: number) => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
  };
}) {
  return (
    <Box data-testid="overview-row" sx={{ borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 'none' } }}>
      {/* A plain Box rather than a ButtonBase even now that opening the order is the
          only action: the client name inside it is its own control, and a button
          nested in a button is invalid markup. The name carries the keyboard path;
          the surrounding click target is a mouse convenience on top of it. */}
      <Box
        onClick={onOpen}
        sx={{
          px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25,
          cursor: onOpen ? 'pointer' : 'default',
          '&:hover': onOpen ? { bgcolor: 'action.hover' } : undefined,
        }}
      >
        {reorder?.handle}
        {avatar}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            {onOpen ? (
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                sx={{ fontWeight: 700, fontSize: 13.5, color: 'primary.dark', textAlign: 'left', minWidth: 0 }}
              >
                {title}
              </Link>
            ) : (
              <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{title}</Typography>
            )}
            {chip}
          </Stack>
          {addressLine && (
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>{addressLine}</Typography>
          )}
        </Box>
        {/* Stacked arrows beside the drag handle: a drag is quicker across several places, a
            click is surer for one — and the only option on a touch screen where the pane
            itself scrolls. `stopPropagation` so nudging a row does not also open its order. */}
        {reorder && (
          <Stack sx={{ flexShrink: 0 }}>
            <IconButton
              size="small"
              disabled={!reorder.canMoveUp}
              onClick={(e) => { e.stopPropagation(); reorder.onMove(-1); }}
              aria-label={`Posunout výše — ${title}`}
              sx={{ width: 22, height: 18, borderRadius: 1 }}
            >
              <ArrowUpIcon sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton
              size="small"
              disabled={!reorder.canMoveDown}
              onClick={(e) => { e.stopPropagation(); reorder.onMove(1); }}
              aria-label={`Posunout níže — ${title}`}
              sx={{ width: 22, height: 18, borderRadius: 1 }}
            >
              <ArrowDownIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

/**
 * One sortable row of the stop list: supplies the drag handle and the transform dnd-kit applies
 * while it is being dragged.
 *
 * A wrapper rather than sortable logic inside OverviewRow, so the row itself stays a plain
 * presentational component and the non-reorderable case pulls in no drag machinery at all.
 */
function SortableStopRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const handle = (
    <Box
      {...attributes}
      {...listeners}
      aria-label="Přetáhnout zastávku"
      sx={{
        display: 'flex', flexShrink: 0, cursor: 'grab', color: 'text.disabled',
        // Without this the browser's own touch scrolling wins and the drag never starts —
        // which matters here because the pane the row sits in scrolls too.
        touchAction: 'none',
      }}
    >
      <DragIndicatorIcon sx={{ fontSize: 17 }} />
    </Box>
  );

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{ opacity: isDragging ? 0.6 : 1, bgcolor: isDragging ? 'action.hover' : undefined }}
    >
      {children(handle)}
    </Box>
  );
}

/** "Přehled zastávek" card — a flat list of the shipment's stops in route order, one
 * row per stop in route order — client deliveries, supplier pickups, the warehouse and custom
 * waypoints alike. Read-only; what is loaded at each stop belongs to the nakládka.
 *
 * Every kind, not just the orders: the number beside a row is the number on its map pin, and
 * those are numbered over the whole route. Listing only order stops made the list and the map
 * disagree about which stop was "3" as soon as the run gained a warehouse or pickup stop.
 *
 * Lives in the route map, folded away behind the trip stats' chevron — the route is
 * what the map is looked at for, and the stop list is the follow-up question. */
function OrdersOverviewCard({ stops, onOpenOrder, reorderable, onReorder }: {
  stops: OutgoingShipmentStopDto[];
  onOpenOrder?: (orderId: string) => void;
  /** Whether the route may still be resequenced — content is only editable while planned. */
  reorderable?: boolean;
  /** Hands over the full new sequence, as stop ids. */
  onReorder?: (stopIds: string[]) => void;
}) {
  const entries = stopOverviewEntries(stops);

  // A pointer has to travel a few pixels before a drag begins, so a click on the arrow buttons
  // or the client-name link inside a draggable row still reads as a click.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const move = (key: string, delta: number) => {
    const ids = reorderedStopIds(entries, key, { delta });
    if (ids) onReorder?.(ids);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const overKey = event.over?.id;
    if (!overKey) return;
    const ids = reorderedStopIds(entries, String(event.active.id), { dropOn: String(overKey) });
    if (ids) onReorder?.(ids);
  };

  // Only when every stop carries its own id: the endpoint wants the run's whole sequence, so a
  // list with a hole in it would be rejected — better to show no controls than a broken one.
  const canReorder = Boolean(reorderable && onReorder)
    && entries.length > 1
    && entries.every((e) => e.stopId);

  // A column whose header is outside the scrollport and whose list is inside it: the heading
  // and the count stay put while the stops scroll under them. Sticky positioning would not do
  // it — the Card clips, so a sticky header would have nothing to stick to.
  return (
    <Card sx={{ overflow: 'clip', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ flex: '0 0 auto', px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}
      >
        <ReceiptLongOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Přehled zastávek</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.disabled' }}>
          {entries.length} {plural(entries.length, 'zastávka', 'zastávky', 'zastávek')}
        </Typography>
      </Stack>
      {entries.length > 0 ? (
        <Box
          data-testid="stops-overview-body"
          sx={{
            flex: '1 1 auto',
            minHeight: 0,
            // contain, so reaching the last stop does not chain the scroll on to the document —
            // the nested-pane trap app/CLAUDE.md warns about.
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {(() => {
            const row = (entry: StopOverviewEntry, i: number, handle?: ReactNode) => (
              <OverviewRow
                avatar={<StopAvatar kind={entry.kind} seq={entry.seq} clientId={entry.clientId} />}
                title={entry.title}
                chip={entry.placeName ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<PlaceOutlinedIcon sx={{ fontSize: '13px !important' }} />}
                    label={entry.placeName}
                    sx={{ height: 19, fontSize: 10.5, fontWeight: 700, color: 'info.main', borderColor: 'info.main', '& .MuiChip-icon': { color: 'info.main' } }}
                  />
                ) : undefined}
                // Address only, no "· Fakturační" tail: which of the client's addresses it is
                // only matters where it can be changed, and that is the editor.
                addressLine={entry.addressLine ?? entry.note}
                onOpen={onOpenOrder && entry.orderId ? () => onOpenOrder(entry.orderId!) : undefined}
                reorder={canReorder
                  ? {
                    handle,
                    onMove: (delta) => move(entry.key, delta),
                    canMoveUp: i > 0,
                    canMoveDown: i < entries.length - 1,
                  }
                  : undefined}
              />
            );

            if (!canReorder) {
              return entries.map((entry, i) => <Box key={entry.key}>{row(entry, i)}</Box>);
            }

            return (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={entries.map((e) => e.key)} strategy={verticalListSortingStrategy}>
                  {entries.map((entry, i) => (
                    <SortableStopRow key={entry.key} id={entry.key}>
                      {(handle) => row(entry, i, handle)}
                    </SortableStopRow>
                  ))}
                </SortableContext>
              </DndContext>
            );
          })()}
        </Box>
      ) : (
        <Typography color="text.secondary" sx={{ fontSize: 13, px: 2.5, py: 2 }}>Žádné zastávky.</Typography>
      )}
    </Card>
  );
}

/**
 * What the van exchanges with the garage: one card for the pieces coming off it,
 * one for the pieces going onto it.
 *
 * Both are read-only views of numbers edited elsewhere — the nakládka's "Do garáže" and
 * "Z garáže" columns, and (for "Doložit") the Další zboží card's own split. They exist as their
 * own cards because they are worked at a different moment than the loading list: at the garage
 * door, not at the brewery's pallet.
 */
export function GarageCard({
  title, icon, rows, quantityOf, emptyText, extraRows = [],
}: {
  title: string;
  icon: ReactNode;
  rows: AggRow[];
  quantityOf: (row: AggRow) => number;
  emptyText: string;
  /**
   * Lines that are not brewery products — supplier goods sourced from the garage. Passed
   * already shaped rather than as another AggRow, because they have no brewery, kind or
   * package size, and inventing empty ones would put blank chips on the row.
   */
  extraRows?: { key: string; name: string; chipText?: string; quantity: number }[];
}) {
  const listed = rows.filter((row) => quantityOf(row) > 0);
  const extras = extraRows.filter((row) => row.quantity > 0);
  const total = listed.reduce((sum, row) => sum + quantityOf(row), 0)
    + extras.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        {icon}
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {(listed.length > 0 || extras.length > 0) && (
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
            {total} ks
          </Typography>
        )}
      </Stack>
      {listed.length === 0 && extras.length === 0 ? (
        <Typography color="text.secondary" sx={{ fontSize: 13, px: 2.5, py: 2 }}>{emptyText}</Typography>
      ) : (
        <Stack sx={{ px: 2.5, py: 1.5 }} spacing={1}>
          {listed.map((row) => {
            const chipText = kindSizeChipText(row.kind, row.packageSize);
            return (
              <Stack key={row.key} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5 }} noWrap>{row.name}</Typography>
                  {chipText && <Chip size="small" label={chipText} sx={{ height: 18, fontSize: 10, fontWeight: 600 }} />}
                </Stack>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {quantityOf(row)} ks
                </Typography>
              </Stack>
            );
          })}
          {extras.map((row) => (
            <Stack key={row.key} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5 }} noWrap>{row.name}</Typography>
                {row.chipText && <Chip size="small" label={row.chipText} sx={{ height: 18, fontSize: 10, fontWeight: 600 }} />}
              </Stack>
              <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {row.quantity} ks
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Card>
  );
}

/**
 * Supplier goods the run has to bring — gas, packaging, sanitation — one row per good with the
 * total across every order that asked for it, and a stepper splitting that total between our
 * own garage and a call at the supplier.
 *
 * Not read-only, unlike the two garage cards, because this split is a decision made here: the
 * good's own pickup source only seeds it. Each click writes one underlying order line (see
 * {@link nextSourcingWrite}) and the server re-derives the route from the result, which is what
 * makes a stop appear or vanish as the last piece moves either way.
 *
 * No supplier or client column: those tell you where a piece came from and who it is for, and
 * this card answers a different question — what has to be picked up, and from where.
 */
export function SupplierGoodsCard({ rows, editable, onAdjust }: {
  /** Already aggregated by the page, which also feeds the garage side of these rows to
   *  "Doložit" — one aggregation, so the two cards cannot report different totals. */
  rows: SupplierGoodRow[];
  /** Whether the split can still be changed — the run's loading has to be open. */
  editable?: boolean;
  /** Moves one piece of a row between the garage and the supplier. */
  onAdjust?: (row: SupplierGoodRow, delta: number) => void;
}) {
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, r) => sum + r.quantity, 0);
  const fromGarage = rows.reduce((sum, r) => sum + r.fromGarage, 0);

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <PropaneOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Další zboží</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
          {total} ks
        </Typography>
      </Stack>

      {/* The two columns the stepper moves pieces between, named once at the top rather than on
          every row. */}
      <Stack
        direction="row"
        sx={{
          px: 2.5, py: 0.75, borderBottom: 1, borderColor: 'divider',
          bgcolor: 'action.hover',
          '& > *': { fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, color: 'text.secondary', textTransform: 'uppercase' },
        }}
      >
        <Box sx={{ flex: 1 }}>Zboží</Box>
        <Box sx={{ width: 104, textAlign: 'center' }}>Z garáže</Box>
        <Box sx={{ width: 74, textAlign: 'right' }}>Od dodav.</Box>
      </Stack>

      <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
        {rows.map((row) => {
          const fromSupplier = row.quantity - row.fromGarage;
          const overdrawn = row.garageAvailable != null && row.fromGarage > row.garageAvailable;
          return (
            <Stack key={row.key} data-testid="supplier-good-row" direction="row" alignItems="center" sx={{ px: 2.5, py: 1.25 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }} noWrap>{row.name}</Typography>
                  {row.size && <Chip size="small" label={row.size} sx={{ height: 18, fontSize: 10, fontWeight: 600 }} />}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {row.quantity} ks celkem
                </Typography>
                {/* Drawing more than the garage holds is allowed — a dovoz may still land before
                    the truck is packed — so this warns rather than blocks, like the nakládka. */}
                {overdrawn && (
                  <Typography variant="caption" sx={{ display: 'block', color: 'warning.dark', fontWeight: 700 }}>
                    Na skladě jen {row.garageAvailable} ks
                  </Typography>
                )}
              </Box>

              {/* minus · number · plus, so the number of every row sits in one column whether or
                  not its buttons are shown. */}
              <Stack direction="row" alignItems="center" spacing={0.25} sx={{ width: 104, justifyContent: 'center' }}>
                {editable ? (
                  <IconButton
                    size="small"
                    disabled={row.fromGarage <= 0}
                    onClick={() => onAdjust?.(row, -1)}
                    aria-label={`Ubrat z garáže — ${row.name}`}
                    sx={{ width: 24, height: 24, color: 'info.main' }}
                  >
                    <RemoveIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                ) : <Box sx={{ width: 24 }} />}
                <Typography sx={{
                  minWidth: 26, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: row.fromGarage > 0 ? (overdrawn ? 'warning.dark' : 'info.main') : 'text.disabled',
                }}
                >
                  {row.fromGarage}
                </Typography>
                {editable ? (
                  <IconButton
                    size="small"
                    disabled={row.fromGarage >= row.quantity}
                    onClick={() => onAdjust?.(row, 1)}
                    aria-label={`Přidat z garáže — ${row.name}`}
                    sx={{ width: 24, height: 24, color: 'info.main' }}
                  >
                    <AddIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                ) : <Box sx={{ width: 24 }} />}
              </Stack>

              {/* Derived, never edited: the two always add up to the ordered quantity, so one
                  stepper is the whole control. */}
              <Typography sx={{
                width: 74, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: fromSupplier > 0 ? 'text.primary' : 'text.disabled',
              }}
              >
                {fromSupplier} ks
              </Typography>
            </Stack>
          );
        })}
      </Stack>

      <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.25, borderTop: 1, borderColor: 'divider' }}>
        <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'text.secondary' }}>Celkem</Typography>
        <Typography sx={{ width: 104, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: fromGarage > 0 ? 'info.main' : 'text.disabled' }}>
          {fromGarage}
        </Typography>
        <Typography sx={{ width: 74, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {total - fromGarage} ks
        </Typography>
      </Stack>
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
  canSeeInvoicing = false,
  canSeeLoadingBreakdown = false,
  onBack,
  backLabel = 'Zpět na vývozy',
  onEdit,
  onOpenOrder,
}: {
  shipment: OutgoingShipmentDetailDto;
  editable: boolean;
  /** Fakturace section. Denied to drivers, and the endpoint behind it 403s for them,
   *  so the section is dropped rather than left to fail. Defaults closed: a call site
   *  that forgets this prop must under-show rather than leak Fakturace to a driver. */
  canSeeInvoicing?: boolean;
  /** The Vše / F1 / F2 aggregation tabs. Denied to drivers, who get the Vykládka
   *  view as the card's only content. Defaults closed for the same reason as
   *  canSeeInvoicing above. */
  canSeeLoadingBreakdown?: boolean;
  onBack: () => void;
  /** Overridden when the vývoz was opened from another screen and Back returns
   *  there — see `DetailBackState`. */
  backLabel?: string;
  onEdit: () => void;
  /** Navigates to a stop's source order. Left out when the user has no access
   *  to the Objednávky module, which hides the affordance entirely. */
  onOpenOrder?: (orderId: string) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const startPoints = useShipmentStartPoints();
  const inventoryQuery = useInventory();
  const productsQuery = useProducts();
  const addPurchaseInvoice = useAddPurchaseInvoice(shipment.id);
  const deletePurchaseInvoice = useDeletePurchaseInvoice(shipment.id);
  const setPurchaseInvoiceLine = useSetPurchaseInvoiceLine(shipment.id);
  const setLoadingState = useSetLoadingState(shipment.id);
  const setPreparationStep = useSetPreparationStep(shipment.id);
  const setShipmentState = useSetShipmentState(shipment.id);
  const setOrderItemSourcing = useSetOrderItemSourcing(shipment.id);
  const setSupplierGoodSourcing = useSetSupplierGoodSourcing(shipment.id);
  const reorderShipmentStops = useReorderShipmentStops(shipment.id);
  const setStockPurchase = useSetStockPurchase(shipment.id);
  const exportShipment = useExportShipment();

  // Which state a transition is on its way to, or null when none is running. Drives the
  // overlay that says what is happening — a transition moves stock, rewrites the orders'
  // states and freezes prices, so it is the one action here that is worth waiting on
  // rather than pretending has already happened.
  const [stateChange, setStateChange] = useState<OutgoingShipmentState | null>(null);

  const [exportMenuAnchor, setExportMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [stockPurchaseOpen, setStockPurchaseOpen] = useState(false);
  const [stockPurchaseProductId, setStockPurchaseProductId] = useState<string | null>(null);
  const [stockPurchaseQty, setStockPurchaseQty] = useState('1');

  const nakladkaEditable = editable && !['Delivered', 'Cancelled'].includes(shipStateName(shipment.state) ?? '');

  // The sequence a reorder is asking for, held until the write settles.
  //
  // The query cache is patched optimistically too, but that is not enough on its own: a cache
  // write lands in a later commit than the drop, and dnd-kit animates the dragged row back to
  // where it started unless the list order changes in the *same* render. That snap-back is the
  // flicker. Holding the order here makes the move synchronous with the drop, and it also keeps
  // the arrow buttons instant.
  //
  // Cleared on settle rather than on success: by then the cache holds the truth either way —
  // the new order if the write took, the old one if it was rejected and rolled back.
  const [pendingStopOrder, setPendingStopOrder] = useState<string[] | null>(null);

  // The stops a pending sourcing write will leave behind, for the same reason: a supplier stop
  // stops being needed the moment the last piece moves into the garage, and waiting for the run
  // to be re-read to learn that leaves the list showing a stop nobody is driving to. Predicted
  // by the mirror of the server's own two reconcilers — see pickupStopPrediction.
  const [pendingStops, setPendingStops] = useState<OutgoingShipmentStopDto[] | null>(null);

  const stopsSorted = useMemo(() => {
    const stops = (pendingStops ?? shipment.stops ?? []).slice();

    if (pendingStopOrder) {
      const position = new Map(pendingStopOrder.map((id, i) => [id, i]));
      // Anything the pending sequence does not name sorts after it rather than to the front,
      // so a stop that appeared meanwhile cannot jump the queue.
      const rank = (stop: OutgoingShipmentStopDto) =>
        (stop.id ? position.get(stop.id) : undefined) ?? Number.MAX_SAFE_INTEGER;
      return stops.sort((a, b) => rank(a) - rank(b));
    }

    return stops.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [shipment.stops, pendingStops, pendingStopOrder]);
  // Mirrors AddressChangedBanner's own "anything to show" check, so the
  // wrapper placing it directly under the map can skip its top margin when
  // the banner will render nothing (it returns null with no addressChangedAt
  // stops) rather than leave a stray gap.
  const hasAddressChanges = stopsSorted.some((s) => s.addressChangedAt);
  // `seq` is the stop's position on the route, handed over so the pins carry the same numbers
  // the stop list does — without it the map numbers only the stops it can locate, and an
  // ungeocoded address shifts every number after it.
  const routeStops: RouteStop[] = useMemo(() => stopsSorted.map((st, i): RouteStop => {
    const seq = i + 1;
    if (st.orderId == null) {
      return { lat: st.latitude, lng: st.longitude, label: st.label ?? 'Zastávka', color: '#1A2B4C', kind: 'custom', seq };
    }
    // Shared with the stop header below so a DeliveryPlace stop pins at the
    // place, not the billing address (the previous inline check here only
    // ever branched on Contact vs Official and silently ignored a place).
    const { lat, lng } = resolveDetailStopAddress(st);
    return { lat, lng, label: st.clientName ?? '—', color: colorForClient(st.clientId ?? ''), kind: 'order', seq };
  }), [stopsSorted]);

  // The detail DTO already carries the shipment's own resolved start point, so
  // the map does not wait on the start-points query for it — only the homeward
  // end (the company) needs that lookup. While the query is still pending or
  // has failed, `companyEnd` stays undefined and the end falls back to the same
  // point as the start: a single combined marker rather than a second pin
  // plotted at (0, 0).
  const company = (startPoints.data ?? []).find((p) => startPointKindName(p.kind) === 'Company');
  const companyEnd = routeEndpointFrom(company);
  // The same entry, in the shape a predicted warehouse stop needs. Undefined while the
  // start-points query is still pending, in which case a predicted stop is drawn without
  // coordinates and gains them on the refetch.
  const companyPoint = company
    ? { name: company.name, latitude: company.latitude, longitude: company.longitude }
    : undefined;
  // A brewery whose address was never geocoded is a legal start point, so the
  // shipment's own resolved coordinates may be absent — in which case there is
  // nothing to plot and the map falls back to the company (always configured
  // with coordinates), or, failing even that, is not drawn at all.
  const startPointEnd = routeEndpointFrom({
    latitude: shipment.startPointLatitude,
    longitude: shipment.startPointLongitude,
    name: shipment.startPointName,
    address: shipment.startPointAddress,
  });
  const routeStart: RouteEndpoint | undefined = startPointEnd ?? companyEnd;
  const routeEnd: RouteEndpoint | undefined = companyEnd ?? routeStart;
  // The Vykládka header only prints the start point's name and address, so it
  // stays truthful even when there are no coordinates to draw with — it must
  // not inherit the map's company fallback.
  const startPointLabel = { name: shipment.startPointName ?? '—', address: shipment.startPointAddress };

  const extraRows = useMemo(() => (shipment.stockPurchases ?? []).map(extraRowFrom), [shipment.stockPurchases]);

  // Custom extras belong to the orders on the route; the nakládka only lists them.
  const customExtras = useMemo(
    () => stopsSorted.flatMap((st) => (st.customExtraItems ?? []).map((extra) => ({
      clientName: st.clientName ?? '—', extra,
    }))),
    [stopsSorted],
  );

  // Warned about rather than blocked: a booked delivery may still land in time. Only while
  // the draw is still a plan — once the run is loaded the pieces are off the shelf and the
  // comparison no longer has two comparable sides (see overdrawnStock).
  const overdrawn = useMemo(
    () => overdrawnStock(stopsSorted, shipStateName(shipment.state)),
    [stopsSorted, shipment.state],
  );
  const combinedRows = useMemo(
    () => [...stopsSorted.flatMap((st) => (st.products ?? []).map(productRowFrom)), ...extraRows],
    [stopsSorted, extraRows],
  );
  const aggRows = useMemo(() => aggregateRows(combinedRows), [combinedRows]);

  // One row per supplier good, summed across orders. Computed here rather than inside the card
  // because "Doložit" lists the garage side of the very same rows — hoisting it means there is
  // one aggregation feeding both, instead of two that could be given different input.
  // The split a pending write is asking for, so the stepper's own number and the stop list it
  // drives cannot briefly disagree about how many pieces come from the garage.
  const [pendingSupplierGoods, setPendingSupplierGoods] = useState<OutgoingShipmentSupplierGoodDto[] | null>(null);

  const supplierGoodRows = useMemo(
    () => aggregateSupplierGoods(pendingSupplierGoods ?? shipment.supplierGoods ?? []),
    [shipment.supplierGoods, pendingSupplierGoods],
  );



  // Two brewery-invoice columns are always on screen; the second usually has no
  // invoice behind it until a number is typed into it, which the server then
  // materialises. Anything beyond two comes from "+ Faktura pivovaru".
  const purchaseInvoices = useMemo(() => shipment.purchaseInvoices ?? [], [shipment.purchaseInvoices]);
  const loadingStates = useMemo(() => shipment.loadingStates ?? [], [shipment.loadingStates]);

  // Filter the loading list down to one brewery invoice: what to read out when the
  // pallet is being checked against that invoice rather than against the whole run.
  // One tab per column, so a third invoice gets a tab too.
  const [invoiceFilter, setInvoiceFilter] = useState<string>(ALL_INVOICES);
  useEffect(() => { setInvoiceFilter(ALL_INVOICES); }, [shipment.id]);

  const invoiceColumns = useMemo(() => columnsOf(purchaseInvoices), [purchaseInvoices]);
  const filterOptions = useMemo<SegOption<string>[]>(() => [
    // 'Nakládka', not 'Vše': it names what the view is rather than how much of it there is,
    // which is the only reading that pairs with 'Vykládka' beside it.
    { value: ALL_INVOICES, label: 'Nakládka' },
    ...invoiceColumns.map((column) => ({ value: String(column.sequence), label: `F${column.sequence}` })),
    { value: UNLOAD_VIEW, label: 'Vykládka' },
  ], [invoiceColumns]);

  // A deleted invoice must not leave the table filtered by a column that is gone.
  // Without the breakdown capability the filter is pinned to the unload view: the
  // aggregation is never rendered, so nothing can select it.
  const activeFilter = !canSeeLoadingBreakdown
    ? UNLOAD_VIEW
    : filterOptions.some((o) => o.value === invoiceFilter) ? invoiceFilter : ALL_INVOICES;

  // The driver's stop-by-stop unload order, for the Vykládka tab. Kept in
  // unloadOrder.ts (Task 10) rather than derived inline so it stays testable
  // without a rendering harness — this screen only shapes it into rows.
  const unloadStops = useMemo(
    () => unloadOrder(stopsSorted, shipment.stockPurchases ?? [], shipment.supplierGoods ?? []),
    [stopsSorted, shipment.stockPurchases, shipment.supplierGoods],
  );

  const visibleRows = useMemo(
    () => (activeFilter === ALL_INVOICES
      ? aggRows
      : rowsOnInvoice(aggRows, purchaseInvoices, Number(activeFilter))),
    [aggRows, activeFilter, purchaseInvoices],
  );

  // Footers total what is on screen; a filtered table whose sum counts hidden rows
  // is worse than no sum at all.
  const purchaseTotals = useMemo(() => columnTotals(visibleRows, purchaseInvoices), [visibleRows, purchaseInvoices]);
  // Per-column, over what the table shows. Counted per (row, column) pair: a product split
  // across two invoices is loaded twice, once for each pallet read out.
  const columnProgress = useMemo(
    () => columnsOf(purchaseInvoices).map((column) =>
      loadingProgress(visibleRows, purchaseInvoices, loadingStates, column.sequence)),
    [visibleRows, purchaseInvoices, loadingStates],
  );
  const totalQty = visibleRows.reduce((s, a) => s + a.quantity, 0);
  const sections = useMemo(() => groupByBreweryThenKind(visibleRows), [visibleRows]);
  const totalWeight = combinedRows.reduce((sum, r) => sum + r.weight * r.quantity, 0);

  const vehicle = shipment.vehicle;
  const overloaded = Boolean(vehicle?.maxWeight != null && totalWeight > vehicle.maxWeight);
  const assignedDrivers = shipment.drivers ?? [];

  const stateName = shipStateName(shipment.state);
  // "Do garáže" is content, not loading progress: goods bought and put on the truck, which
  // freeze when the truck is packed. Narrower than nakladkaEditable, which stays true through
  // Loaded and InTransit for the steppers and tick boxes that really are progress. The API has
  // always drawn the line here (ShipmentContentGuard counts stock purchases as frozen content);
  // the buttons were offered past it regardless and could only produce a 400.
  const stockPurchaseEditable = editable && stateName === 'Created';
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
  // Delivered is deliberately absent: it is terminal. Reverting out of it re-ran the
  // order transitions and freed already-delivered orders back to New, silently
  // unwinding an invoiced, reported run. The API rejects the transition, so offering
  // the button would only produce a 400.
  const revertTo = ({
    Loaded: S.Created,
    InTransit: S.Loaded,
  } as Record<string, OutgoingShipmentState>)[stateName ?? ''];
  const ghostBtnSx = { color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } } as const;

  // Every write this screen makes now has its own narrow endpoint — the state, the sourcing
  // stepper, the "Do garáže" stepper, the loading ticks, the checklist, the invoice split. The
  // full-object PUT it used to funnel all of them through belongs to the editor, which really
  // does rewrite the whole run; sending it from here meant a whole-shipment diff and rebuild
  // per click.

  // A transition sends the state and nothing else.
  function advance(next: OutgoingShipmentState) {
    setStateChange(next);
    setShipmentState.mutate(next, {
      onSuccess: () => enqueueSnackbar('Stav vývozu aktualizován.', { variant: 'success' }),
      onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
      onSettled: () => setStateChange(null),
    });
  }

  // The server names the file (`vyvoz-<date>-<name>.xlsx`/`.docx`) and the generated client reads
  // that name off Content-Disposition, so nothing here has to reconstruct it. The fallback only
  // covers a proxy that strips the header, and carries the right extension per format so the file
  // still opens in the right program.
  function runExport(format: ShipmentExportFormat) {
    setExportMenuAnchor(null);
    if (!shipment.id) return;

    exportShipment.mutate({ id: shipment.id, format }, {
      onSuccess: (file) => downloadBlob(
        file.data,
        file.fileName ?? (format === 'word' ? 'vyvoz.docx' : 'vyvoz.xlsx'),
      ),
      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Export se nepodařilo vytvořit'), { variant: 'error' }),
    });
  }

  // Adjust the "Zboží na sklad" quantity of an aggregated product by `delta`
  // (+1 / -1). Removes the item at zero.
  //
  // No stock-on-hand cap: these pieces are bought from the brewery *for* our
  // warehouse and are added to inventory when the shipment is delivered. Capping
  // them at what we already hold was the old "dokládka ze skladu" reading of this
  // feature, and it was backwards.
  //
  // Its own endpoint, keyed by product and taking an absolute quantity: the nakládka keeps one
  // line per product, so the product is the identity the screen already works in, and an
  // absolute write means a double-fired click lands on the same number rather than buying twice.
  function adjustStockPurchase(agg: AggRow, delta: number) {
    if (!agg.productId) return;

    const quantity = Math.max(0, agg.stockPurchaseQuantity + delta);
    commitStockPurchase(agg.productId, quantity, quantity === 0 ? 'Zboží na sklad odebráno.' : undefined);
  }

  /** The one write behind both "Do garáže" controls — the row stepper and the add dialog. */
  function commitStockPurchase(productId: string, quantity: number, successMessage?: string) {
    setStockPurchase.mutate({ productId, quantity }, {
      onSuccess: () => { if (successMessage) enqueueSnackbar(successMessage, { variant: 'success' }); },
      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Zboží na sklad se nepodařilo uložit'), { variant: 'error' }),
    });
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

    const quantityFromInventory = Math.max(0, Math.min(target.fromInventory + delta, target.quantity));

    // Deliberately no stock cap here: drawing more than is on hand is allowed and
    // surfaced by the banner, because a booked delivery may still arrive in time.
    //
    // One narrow write on its own endpoint, optimistic in the cache: the stepper is clicked
    // once per piece, and re-posting the whole run per click made each one wait on a
    // whole-shipment rebuild.
    setOrderItemSourcing.mutate({
      orderItemId: target.orderItemId!,
      quantityFromInventory,
      inventoryItemId: quantityFromInventory > 0 ? stockItem?.id ?? target.inventoryItemId : undefined,
    }, {
      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Zdroj kusů se nepodařilo uložit'), { variant: 'error' }),
    });
  }

  // Writes a new stop sequence. Optimistic in the cache, so the row moves under the cursor and
  // the map's pins renumber with it rather than after a round trip.
  function reorderStops(stopIds: string[]) {
    setPendingStopOrder(stopIds);
    reorderShipmentStops.mutate(stopIds, {
      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Pořadí zastávek se nepodařilo uložit'), { variant: 'error' }),
      onSettled: () => setPendingStopOrder(null),
    });
  }

  // Move one piece of a supplier good between the garage and the supplier. The row is a sum
  // across orders, so the write lands on one underlying line — see nextSourcingWrite for which.
  // The server re-derives the run's pickup stops from the result, so this is also what makes a
  // stop appear or disappear.
  function adjustSupplierGoodSourcing(row: SupplierGoodRow, delta: number) {
    const write = nextSourcingWrite(row, delta);
    if (!write) {
      enqueueSnackbar(
        delta > 0 ? 'Všechny kusy už jsou z garáže.' : 'Žádné kusy nejsou z garáže.',
        { variant: 'info' },
      );
      return;
    }

    // The split as it will be, and the route that follows from it. Both are applied before the
    // request goes out and dropped when it settles, by which point the cache holds the truth
    // either way — the server reconciles the stops itself and is the authority on them.
    const nextGoods = withSplitApplied(
      pendingSupplierGoods ?? shipment.supplierGoods ?? [],
      write.itemId,
      write.quantityFromGarage,
    );
    setPendingSupplierGoods(nextGoods);
    setPendingStops(predictPickupStops({
      stops: pendingStops ?? shipment.stops ?? [],
      supplierGoods: nextGoods,
      hasStockPurchases: (shipment.stockPurchases ?? []).length > 0,
      company: companyPoint,
    }));

    const settled = () => {
      setPendingSupplierGoods(null);
      setPendingStops(null);
    };

    // Deliberately no stock cap: drawing more than the garage holds is allowed and warned
    // about on the row, because a dovoz may still land before the truck is packed.
    setSupplierGoodSourcing.mutate(write, {
      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Zdroj kusů se nepodařilo uložit'), { variant: 'error' }),
      onSettled: settled,
    });
  }

  // The brewery's catalogue, not our stock: this buys goods we do not have yet.
  // The on-hand figure rides along as a hint, because knowing we already hold 40
  // is what decides whether to buy more.
  const purchasableProducts = useMemo(
    () => (productsQuery.data ?? []).filter((p) => p.id),
    [productsQuery.data],
  );
  const onHandByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of (inventoryQuery.data ?? []).flatMap((s) => s.items ?? [])) {
      if (item.productId) m.set(item.productId, (m.get(item.productId) ?? 0) + (item.quantity ?? 0));
    }
    return m;
  }, [inventoryQuery.data]);
  const onHandHint = useCallback((p: ProductListItemDto) => {
    const onHand = p.id ? onHandByProduct.get(p.id) ?? 0 : 0;
    return onHand > 0 ? `skladem ${onHand} ks` : undefined;
  }, [onHandByProduct]);

  function openStockPurchase() {
    setStockPurchaseProductId(null);
    setStockPurchaseQty('1');
    setStockPurchaseOpen(true);
  }

  function saveStockPurchase() {
    const qty = parseInt(stockPurchaseQty, 10) || 0;
    if (!stockPurchaseProductId) { enqueueSnackbar('Vyberte produkt', { variant: 'warning' }); return; }
    if (qty <= 0) { enqueueSnackbar('Zadejte počet kusů', { variant: 'warning' }); return; }

    // The dialog tops an existing line up rather than opening a second one for the same
    // product — the endpoint takes an absolute quantity, so the sum is worked out here.
    const already = (shipment.stockPurchases ?? [])
      .find((p) => p.productId === stockPurchaseProductId)?.quantity ?? 0;

    commitStockPurchase(stockPurchaseProductId, already + qty, 'Zboží na sklad přidáno do nakládky.');
    setStockPurchaseOpen(false);
  }

  // Both nakládka layouts commit through these — the table cells and the stacked
  // rows differ only in how they present the same two writes.
  function commitInvoiceLine(productId: string, sequence: number, quantity: number) {
    setPurchaseInvoiceLine.mutate({ sequence, productId, quantity }, {
      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Rozdělení se nepodařilo uložit'), { variant: 'error' }),
    });
  }

  function commitLoadingState(productId: string, sequence: number, state: LoadingStateName) {
    setLoadingState.mutate({ sequence, productId, state }, {
      onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Stav nakládky se nepodařilo uložit'), { variant: 'error' }),
    });
  }

  return (
    <Box>
      <DetailHeader
        onBack={onBack}
        backLabel={backLabel}
        title={shipment.name}
        lead={shipmentNumber(shipment.id)}
        leadMono
        status={<StatusPill tone={status.tone} label={status.label} />}
        meta={[shipment.deliveryDate ? fmtDate(shipment.deliveryDate) : 'termín neurčen']}
        actions={(
          <>
            {/* Not gated on `editable`: exporting is reading, and the office needs the file for
                runs it may no longer change. The route already gates view permission.

                One button opening a format menu rather than two buttons: the header already carries
                up to four lifecycle actions, and a fifth wraps it onto a second row. */}
            <Button
              variant="outlined"
              startIcon={exportShipment.isPending
                ? <CircularProgress size={16} color="inherit" />
                : <FileDownloadOutlinedIcon />}
              endIcon={exportShipment.isPending ? undefined : <ExpandMoreIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              disabled={exportShipment.isPending}
              aria-haspopup="menu"
              aria-expanded={exportMenuAnchor != null}
              sx={ghostBtnSx}
            >
              {exportShipment.isPending ? 'Exportuji…' : 'Export'}
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={exportMenuAnchor != null}
              onClose={() => setExportMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <MenuItem onClick={() => runExport('excel')}>
                <ListItemIcon><TableChartOutlinedIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Excel" secondary="List pro každého klienta" />
              </MenuItem>
              <MenuItem onClick={() => runExport('word')}>
                <ListItemIcon><DescriptionOutlinedIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Word" secondary="Stránka pro každého klienta" />
              </MenuItem>
            </Menu>
            {/* Every lifecycle button is disabled while a transition runs: they all post to the
                same endpoint, and a second click during the first would race the first one's
                own state change. The clicked button carries the spinner so it is obvious which
                one is working. */}
            {editable && forwardStep && (
              <Button
                variant={forwardStep.primary ? 'contained' : 'outlined'}
                startIcon={stateChange === forwardStep.to
                  ? <CircularProgress size={16} color="inherit" />
                  : forwardStep.icon}
                onClick={() => advance(forwardStep.to)}
                disabled={stateChange !== null}
              >
                {forwardStep.label}
              </Button>
            )}
            {editable && revertTo !== undefined && (
              <Button
                variant="outlined"
                startIcon={stateChange === revertTo ? <CircularProgress size={16} color="inherit" /> : <UndoIcon />}
                onClick={() => advance(revertTo)}
                disabled={stateChange !== null}
                sx={ghostBtnSx}
              >
                Vrátit
              </Button>
            )}
            {editable && shipmentActive && (
              <Button
                variant="outlined"
                color="error"
                startIcon={stateChange === OutgoingShipmentState.Cancelled
                  ? <CircularProgress size={16} color="inherit" />
                  : <BlockIcon />}
                onClick={() => setConfirmCancel(true)}
                disabled={stateChange !== null}
              >
                Zrušit vývoz
              </Button>
            )}
            {editable && stateName === 'Cancelled' && (
              <Button
                variant="outlined"
                startIcon={stateChange === OutgoingShipmentState.Created
                  ? <CircularProgress size={16} color="inherit" />
                  : <ReplayIcon />}
                onClick={() => advance(OutgoingShipmentState.Created)}
                disabled={stateChange !== null}
                sx={ghostBtnSx}
              >
                Znovu otevřít
              </Button>
            )}
            {editable && shipmentActive && (
              <Button variant="outlined" startIcon={<EditIcon />} onClick={onEdit} sx={ghostBtnSx}>
                Upravit
              </Button>
            )}
          </>
        )}
      />

      {routeStart ? (
        <RouteMap
          stops={routeStops}
          start={routeStart}
          end={routeEnd ?? routeStart}
          viaPoints={(shipment.routeViaPoints ?? []).map((p) => ({ lat: p.latitude ?? 0, lng: p.longitude ?? 0 }))}
          height={360}
          navigable
          // Veiled while a write the screen has predicted is still being confirmed. Both pending
          // values are cleared once the refetch has landed, so this covers exactly the window in
          // which the drawn route is catching up — including the road route, which re-resolves
          // whenever the stops change and would otherwise blink back to a straight line.
          busy={pendingStops !== null || pendingStopOrder !== null}
          overlay={(
            <OrdersOverviewCard
              stops={stopsSorted}
              onOpenOrder={onOpenOrder}
              // Sequence is content, so it follows the same freeze as the stock purchases:
              // editable only while the run is still being planned.
              reorderable={stockPurchaseEditable}
              onReorder={reorderStops}
            />
          )}
          overlayShowLabel="Zobrazit zastávky"
          overlayHideLabel="Skrýt zastávky"
        />
      ) : (
        // Same dashed placeholder ShipmentEditor draws while it has no locatable
        // origin — better than a route anchored at (0, 0).
        <Box
          sx={{
            height: 360, borderRadius: 2, border: '1px dashed', borderColor: 'divider',
            bgcolor: 'action.hover', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'text.disabled',
          }}
        >
          <Typography color="text.secondary">Trasa se zobrazí, jakmile se načte výchozí bod.</Typography>
        </Box>
      )}

      {/* Directly under the map, matching ShipmentEditor.tsx — a warning four
          cards down (its previous spot, at the bottom of the right column)
          is one nobody reads. `mt` only applied when the banner actually has
          something to show, so an empty wrapper never adds a stray gap. */}
      <Box sx={{ mt: hasAddressChanges ? 2.5 : 0 }}>
        <AddressChangedBanner shipmentId={shipment.id ?? ''} stops={stopsSorted} />
      </Box>

      {/* `minmax(0, …)` rather than a bare `1.5fr 1fr`: a grid item defaults to
          `min-width: auto`, so the nakládka table's intrinsic width — which grows with
          every brewery-invoice column pair — becomes the left track's floor and it
          never scrolls. On a 1194px tablet that resolved to 630/234 instead of 518/346
          and squeezed the right column into an unusable strip. Zeroing the minimum lets
          the fr shares hold and the table scroll inside its own TableContainer. */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, alignItems: 'start', mt: 2.5 }}>
        <Stack spacing={2}>
          {/* `clip`, not `hidden`: the table now runs to the card's edges, so the card is
              what rounds off the summary bar's fill — and `hidden` on a card this tall
              makes a scroll container that swallows the wheel and freezes the page. */}
          <Card sx={{ overflow: 'clip' }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Inventory2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Rozpis zboží</Typography>
            </Stack>
            {/* The gutters are the toolbar's, not the table's. The nakládka's tiers are
                keyed on its container's width and the design's widths are the card's —
                20px of padding each side would take an iPad's 521px card down to 479 and
                drop it a whole tier, to the phone layout. So the table runs to the card's
                own edges, as it does in the prototype, and pads its rows itself. */}
            <Box sx={{ pt: 2, pb: activeFilter === UNLOAD_VIEW ? 2 : 0 }}>
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap
                sx={{ mb: 1.5, px: { xs: 1.25, compact: 2.5 } }}
              >
                {/* A one-option toggle is worse than none, so it goes entirely rather
                    than rendering a lone Vykládka button. */}
                {canSeeLoadingBreakdown && (
                  <SegControl value={activeFilter} onChange={setInvoiceFilter} options={filterOptions} />
                )}
                <Box sx={{ flex: 1 }} />
                {/* Beside the views rather than up in the card's head, because both act on the
                    nakládka alone — hidden under Vykládka, where neither has anything to add. */}
                {nakladkaEditable && activeFilter !== UNLOAD_VIEW && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {stockPurchaseEditable && (
                      <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={openStockPurchase}
                        sx={ghostBtnSx}>
                        Zboží na sklad
                      </Button>
                    )}
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
              {activeFilter === UNLOAD_VIEW ? (
                <Box sx={{ px: { xs: 1.25, compact: 2.5 } }}>
                  <UnloadOrderList stops={unloadStops} startPoint={startPointLabel} onOpenOrder={onOpenOrder} />
                </Box>
              ) : (
                <NakladkaTable
                  sections={sections}
                  totalQuantity={totalQty}
                  emptyText={activeFilter === ALL_INVOICES
                    ? 'Zatím žádné produkty k naložení.'
                    : `Na faktuře F${activeFilter} zatím nejsou žádné kusy.`}
                  chipOf={(agg) => platoSizeChipText(agg.platoDegree, agg.packageSize)}
                  footer={(
                    <PurchaseInvoiceTotalsLines
                      totals={purchaseTotals}
                      progress={columnProgress}
                      invoices={purchaseInvoices}
                      editable={nakladkaEditable}
                      onDelete={(invoiceId) => deletePurchaseInvoice.mutate(invoiceId, {
                        onError: (e) => enqueueSnackbar(apiErrorMessage(e, 'Fakturu se nepodařilo smazat'), { variant: 'error' }),
                      })}
                    />
                  )}
                  renderSource={(agg) => (
                    <NakladkaSource
                      entries={breakdownSlots(
                        agg,
                        agg.orderQuantity > 0 && nakladkaEditable,
                        stockPurchaseEditable && nakladkaEditable,
                        (delta) => adjustSourcing(agg, delta),
                        (delta) => adjustStockPurchase(agg, delta),
                      )}
                    />
                  )}
                  renderInvoices={(agg) => (
                    <PurchaseInvoiceChips
                      row={agg}
                      invoices={purchaseInvoices}
                      states={loadingStates}
                      editable={nakladkaEditable}
                      onSet={(sequence, quantity) => commitInvoiceLine(agg.productId!, sequence, quantity)}
                      onSetState={(sequence, state) => commitLoadingState(agg.productId!, sequence, state)}
                    />
                  )}
                />
              )}
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
                  <Stack key={extra.id} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap>{extra.description}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{clientName}</Typography>
                      {extra.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{extra.note}</Typography>}
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
              instead of two mostly-empty rows.

              `auto-fit` and not an `sm` breakpoint: breakpoints measure the viewport, but
              what decides whether two cards fit here is this column's width. An `sm: '1fr 1fr'`
              still said "two columns" inside a 234px column on a tablet, giving two 109px
              cards whose nowrap lines ("Nosnost 7 000 kg", the driver phone) spilled out.
              auto-fit stacks them whenever the container is under ~400px, wherever it sits. */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', alignItems: 'stretch' }}>
            <Card sx={{ overflow: 'hidden', height: '100%' }}>
              <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Vůz</Typography>
              </Stack>
              <Box sx={{ p: 2 }}>
                {vehicle ? (
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
                ) : (
                  <Typography variant="body2" color="text.secondary">Vůz nepřiřazen</Typography>
                )}
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

          {/* Directly under "kdo a čím": these are collected before or on the way round,
              so they are read before the garage exchange further down. Renders nothing when
              no order on the run asks for any. */}
          <SupplierGoodsCard
            rows={supplierGoodRows}
            editable={nakladkaEditable}
            onAdjust={adjustSupplierGoodSourcing}
          />

          {/* Deliberately the whole loading list, not the invoice-filtered view: what
              the garage gives and takes has nothing to do with which brewery invoice
              the goods are billed on. */}
          <GarageCard
            title="Vyložit"
            icon={<WarehouseOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            rows={aggRows}
            quantityOf={(row) => row.stockPurchaseQuantity}
            emptyText="Nic se do garáže nevykládá."
          />

          <GarageCard
            title="Doložit"
            icon={<Inventory2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            rows={aggRows}
            quantityOf={(row) => row.fromInventory}
            emptyText="Nic se z garáže nenakládá."
            // Supplier goods whose pieces were sourced from the garage come off the same shelf
            // as the inventory-sourced beer, so the loader reads them off the same card.
            extraRows={supplierGoodRows.map((row) => ({
              key: row.key,
              name: row.name,
              chipText: row.size,
              quantity: row.fromGarage,
            }))}
          />

          <ReturnsCard stops={stopsSorted} />

          <PreparationStepsCard
            steps={shipment.preparationSteps ?? []}
            editable={nakladkaEditable}
            onToggle={(stepId, isDone) => {
              setPreparationStep.mutate({ stepId, isDone }, {
                onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
              });
            }}
          />
        </Stack>
      </Box>

      {/* Full width below the grid: the split needs the whole row, and its audience
          (the office doing the billing) is not the nakládka's. The wrapper goes with
          it when hidden, so no orphan margin is left behind. */}
      {canSeeInvoicing && (
        <Box sx={{ mt: 2.5 }}>
          <ShipmentInvoicing shipmentId={shipment.id!} editable={nakladkaEditable} stops={stopsSorted} />
        </Box>
      )}

      <Dialog open={stockPurchaseOpen} onClose={() => setStockPurchaseOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Zboží na sklad</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ fontSize: 13, mb: 2 }}>
            Nákup od pivovaru nad rámec objednávek — zboží se veze s vývozem a při doručení se naskladní.
          </Typography>
          <Stack spacing={2}>
            <ProductCombobox
              label="Produkt"
              value={stockPurchaseProductId}
              onChange={setStockPurchaseProductId}
              products={purchasableProducts}
              trailing={onHandHint}
              loading={productsQuery.isLoading}
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
        busy={stateChange !== null}
        onConfirm={() => { setConfirmCancel(false); advance(OutgoingShipmentState.Cancelled); }}
        onClose={() => setConfirmCancel(false)}
      />

      <StateChangeOverlay state={stateChange} />
    </Box>
  );
}

/**
 * What is happening while a shipment transition is in flight.
 *
 * A modal backdrop rather than an inline spinner: the transition rewrites things spread across
 * the whole screen — the run's state, its orders, the stock figures — so there is no one place
 * an inline indicator would belong, and blocking the screen also stops a second lifecycle
 * action being started against a shipment that is mid-move.
 */
function StateChangeOverlay({ state }: { state: OutgoingShipmentState | null }) {
  // Held so the wording does not blank out during the backdrop's fade-out.
  const [shown, setShown] = useState<StateChangeProgress | null>(null);
  useEffect(() => {
    if (state !== null) setShown(stateChangeProgress(state));
  }, [state]);

  return (
    <Backdrop
      open={state !== null}
      sx={(t) => ({ zIndex: t.zIndex.modal + 1, color: 'text.primary' })}
    >
      <Card sx={{ px: 3, py: 2.5, maxWidth: 380 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <CircularProgress size={22} sx={{ mt: 0.25, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{shown?.title}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {shown?.detail}
            </Typography>
          </Box>
        </Stack>
      </Card>
    </Backdrop>
  );
}
