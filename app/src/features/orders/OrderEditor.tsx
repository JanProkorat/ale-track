import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Card, Chip, CircularProgress, IconButton, ListItemText, Menu, MenuItem, Stack,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PropaneOutlinedIcon from '@mui/icons-material/PropaneOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { clientComboOptions } from 'src/features/clients/clientOptions';
import {
  KIND_TABS, breweryPanels, countsByKind, groupByBrewery, inDisplayOrder, matchesQuery,
  type KindTab,
} from './orderCatalogModel';
import { BreweryGroupPanel, CatalogGroupList } from './ProductCatalog';
import { SearchField } from 'src/components/common/SearchField';
import { EmptyState } from 'src/components/common/EmptyState';
import { apiErrorMessage } from 'src/api/errors';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { initials, fmtLiters, orderNumber, plural } from 'src/lib/format';
import { kindLabel, addrKindValue, lineKindLabel, lineKindName } from 'src/lib/labels';
import {
  DeliveryAddressKind,
  CreateOrderDto,
  CreateOrderItemDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  type UpdateOrderResultDto,
  OrderReturnDto,
  OrderNoteDto,
  OrderCustomExtraItemDto,
  OrderSupplierGoodItemDto,
  type ProductListItemDto,
  type OrderItemReminderState,
  OrderLineKind,
} from 'src/generated/api-client';
import { useClients, useClient } from 'src/hooks/useClients';
import { useClientDeliveryPlaces } from 'src/hooks/useDeliveryPlaces';
import { defaultAddressKind } from 'src/features/clients/deliveryAddress';
import { useBreweries } from 'src/hooks/useBreweries';
import { useProducts } from 'src/hooks/useProducts';
import { useSuppliers, useSuppliersMany } from 'src/hooks/useSuppliers';
import { groupSupplierGoods, primaryPrice, resolvedGoodMap } from './supplierGoodCatalogModel';
import { SupplierGoodPanel } from './SupplierGoodCatalog';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useOrder, useClientProductHistory, useCreateOrder, useUpdateOrder } from 'src/hooks/useOrders';
import { useClientLedger } from 'src/hooks/useClientLedger';
import { type ClientLedgerEntryDto } from 'src/generated/api-client';
import { ClientOpenItemsPreview } from 'src/features/clients/ClientOpenItemsPreview';
import { LedgerTag } from 'src/features/clients/LedgerDiff';
import {
  billablePieces,
  extraLineName,
  isBillable,
  isExtraSettleable,
  ledgerNoteText,
  ledgerTodo,
  isGoodSettleable,
  isReturnSettleable,
  isSettleable,
  owedPieces,
  lineNameKey,
  returnLineName,
} from 'src/features/clients/ledgerModel';
import { useUnsavedChangesGuard, UnsavedChangesDialog } from 'src/components/common/UnsavedChangesGuard';
import { TOPBAR_H } from 'src/layout/Topbar';
import { OrderDeliveryAddressField } from './OrderDeliveryAddressField';

/**
 * How a cart row is addressed: the product AND what the line is for.
 *
 * One product can sit on an order twice — once as goods to deliver, once as pieces the client
 * already took and only owes money for. Keying rows by the product alone merged the two, and the
 * merged row was loaded: billing pieces is not the same instruction as carrying them. The server
 * matches on the same pair.
 */
function cartKey(line: { productId: string; lineKind?: OrderLineKind }): string {
  return `${line.productId}|${lineKindName(line.lineKind)}`;
}

/** Whether a row is an ordinary one — the only kind the catalog's own +/− touches. */
function isNormalLine(line: { lineKind?: OrderLineKind }): boolean {
  return lineKindName(line.lineKind) === 'Normal';
}

interface CartLine {
  productId: string;
  quantity: number;
  reminderState?: OrderItemReminderState;
  /** Instruction for whoever loads or delivers this line. */
  note?: string;
  /**
   * Whether the line is for the goods, the money, or both. Undefined means an ordinary line —
   * the same as {@link OrderLineKind.Normal}, and what every line added from the catalog is.
   */
  lineKind?: OrderLineKind;
}

/** A vratka row being edited. `id` is present only for rows already persisted. */
interface DraftReturn { id?: string; name: string; quantity: number; note: string }

/**
 * What adding an open point to this draft actually did, so undoing it can put the draft back.
 *
 * A row is not always opened: an add tops up a row that was already there for its own sake, and
 * dropping such a row on undo would delete something nobody asked to delete. So the quantity
 * before the add is recorded, and null means "there was no row".
 */
interface LedgerAdd {
  entryId: string;
  target: 'cart' | 'goods' | 'extras' | 'returns' | 'notes';
  /** Product id, good id, the vratka's folded name, or the note's text — whatever addresses it. */
  key: string;
  /** Which of the two lines of one product was touched. Irrelevant for a vratka. */
  lineKind: OrderLineKind;
  previousQuantity: number | null;
}

/** An order note being edited. `id` is present only for notes already persisted. */
interface DraftNote { id?: string; text: string }

/** A custom extra being edited — something no brewery supplies. */
interface DraftExtra { id?: string; description: string; quantity: number; note: string }

/**
 * A supplier-good line being edited — gas, packaging, sanitation off a supplier's
 * price list. `id` is present only for lines already persisted; keeping it is what
 * lets the backend patch the row in place instead of replacing it.
 */
interface DraftGoodLine {
  id?: string;
  supplierGoodId: string;
  quantity: number;
  note?: string;
  lineKind?: OrderLineKind;
}

/** What a loaded order already told us about a good, for rendering a line before (or
 *  without) the supplier's live price list. */
interface GoodFallback { goodName: string; goodSize?: string; supplierName: string; unitPriceWithVat?: number }

/** Serialized snapshot of the savable form state, for unsaved-change detection. */
function serializeForm(
  clientId: string | null,
  date: Dayjs | null,
  cart: CartLine[],
  returns: DraftReturn[],
  notes: DraftNote[],
  extras: DraftExtra[],
  deliveryAddress: { kind: DeliveryAddressKind; placeId?: string },
  goodLines: DraftGoodLine[],
): string {
  return JSON.stringify({
    clientId,
    date: date ? date.toISOString() : null,
    // The kind is normalised to its name: undefined and Normal mean the same thing, and comparing
    // the raw values would call a form dirty for picking "Normální" on a line that already was.
    cart: cart.map((c) => ({ ...c, note: c.note?.trim() ?? '', lineKind: lineKindName(c.lineKind) })),
    returns: returns.map((r) => ({ name: r.name.trim(), quantity: r.quantity, note: r.note.trim() })),
    notes: notes.map((n) => n.text.trim()),
    extras: extras.map((e) => ({ description: e.description.trim(), quantity: e.quantity, note: e.note.trim() })),
    deliveryAddress: { kind: deliveryAddress.kind, placeId: deliveryAddress.placeId ?? null },
    goodLines: goodLines.map((g) => ({
      supplierGoodId: g.supplierGoodId,
      quantity: g.quantity,
      note: g.note?.trim() ?? '',
      lineKind: lineKindName(g.lineKind),
    })),
  });
}
/**
 * What to tell the operator their save undid on the run, or nothing.
 *
 * Both marks mean somebody checked something: a Fakturace row closed, a line counted into the van.
 * Saying so is the whole point — the office would otherwise find a row it had finished quietly
 * open again, with no idea why.
 */
function shipmentWorkUndone(result: UpdateOrderResultDto): string | undefined {
  const parts: string[] = [];

  if (result.invoicingUnmarked) parts.push('fakturace už není označená jako hotová');

  // The run-wide reset says the stronger thing, so it stands in for the per-line ticks it comes
  // with: telling somebody a product must be loaded again and, separately, that two of its lines
  // lost a tick is one fact told twice.
  const reset = result.loadingProductsReset ?? 0;
  const cleared = result.loadingChecksCleared ?? 0;

  if (reset > 0) {
    parts.push(`nakládka se u ${reset} ${plural(reset, 'produktu', 'produktů', 'produktů')} vrátila na nenaloženo`);
  } else if (cleared > 0) {
    parts.push(`u ${cleared} ${plural(cleared, 'položky', 'položek', 'položek')} padla kontrola nakládky`);
  }

  if (parts.length === 0) return undefined;

  return `Ve vývozu se kvůli změně počtů ${parts.join(' a ')} — zkontrolujte to.`;
}

function clientInitials(name?: string): string {
  const [a, b] = (name ?? '').trim().split(/\s+/);
  return initials(a, b);
}


/** History-first order builder: pick a client, then add products from their
 * order history or the full catalog (browsed by brewery/kind), review the
 * cart, and save. Matches the prototype's viewOrderEditor/oe* functions. */
export function OrderEditor({
  mode,
  orderId,
  onDone,
  onCancel,
}: {
  mode: 'create' | 'edit';
  orderId?: string;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();

  const clientsQuery = useClients();
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const orderQuery = useOrder(mode === 'edit' ? orderId : undefined);
  const breweriesQuery = useBreweries();
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();

  const [clientId, setClientId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<{ kind: DeliveryAddressKind; placeId?: string }>(
    { kind: DeliveryAddressKind.Official },
  );
  // Name of the order's chosen place as loaded from the server — kept only to
  // label the delivery-address field's "(smazáno)" entry with the real name
  // when that place has since been soft-deleted off the client (and so no
  // longer appears in the client's own delivery-places list). Undefined in
  // create mode, where there is nothing loaded to remember.
  const [loadedPlaceName, setLoadedPlaceName] = useState<string | undefined>(undefined);
  const [requiredDate, setRequiredDate] = useState<Dayjs | null>(mode === 'create' ? dayjs().add(3, 'day') : null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [returns, setReturns] = useState<DraftReturn[]>([]);
  const [notes, setNotes] = useState<DraftNote[]>([]);
  const [extras, setExtras] = useState<DraftExtra[]>([]);
  const [fallbackNames, setFallbackNames] = useState<Record<string, string>>({});
  const [goodLines, setGoodLines] = useState<DraftGoodLine[]>([]);
  const [goodFallback, setGoodFallback] = useState<Record<string, GoodFallback>>({});
  const [catalogTab, setCatalogTab] = useState<'history' | 'browse' | 'suppliers'>('history');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindTab | 'all'>('all');
  const [brewOpen, setBrewOpen] = useState<Record<string, boolean>>({});
  const [supOpen, setSupOpen] = useState<Record<string, boolean>>({});
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const autoTabClientRef = useRef<string | null>(null);
  const loadedOrderRef = useRef(false);
  // Baseline of the savable state to compare against for unsaved changes.
  const baselineRef = useRef<string | null>(null);

  // Create mode has a stable initial baseline right away; edit mode sets it once
  // the order loads (below).
  useEffect(() => {
    if (mode === 'create') baselineRef.current = serializeForm(clientId, requiredDate, cart, returns, notes, extras, deliveryAddress, goodLines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload the draft from the existing order once its detail arrives (edit mode).
  useEffect(() => {
    if (mode !== 'edit' || loadedOrderRef.current || !orderQuery.data) return;
    const o = orderQuery.data;
    loadedOrderRef.current = true;
    const loadedClientId = o.client?.id ?? null;
    const loadedDate = o.requiredDeliveryDate ? dayjs(o.requiredDeliveryDate) : null;
    const loadedCart: CartLine[] = (o.orderItems ?? []).map((it) => ({
      productId: it.productId ?? '',
      quantity: it.quantity ?? 1,
      reminderState: it.reminderState,
      note: it.note ?? undefined,
      lineKind: it.lineKind,
    }));
    const loadedDeliveryAddress = {
      kind: addrKindValue(o.deliveryAddress?.kind),
      placeId: o.deliveryAddress?.placeId ?? undefined,
    };
    setClientId(loadedClientId);
    setDeliveryAddress(loadedDeliveryAddress);
    setLoadedPlaceName(o.deliveryAddress?.placeName ?? undefined);
    setRequiredDate(loadedDate);
    const loadedReturns: DraftReturn[] = (o.returns ?? []).map((r) => ({ id: r.id, name: r.name ?? '', quantity: r.quantity ?? 1, note: r.note ?? '' }));
    const loadedNotes: DraftNote[] = (o.notes ?? []).map((n) => ({ id: n.id, text: n.text ?? '' }));
    setCart(loadedCart);
    setReturns(loadedReturns);
    const loadedExtras: DraftExtra[] = (o.customExtraItems ?? []).map((e) => ({ id: e.id, description: e.description ?? '', quantity: e.quantity ?? 1, note: e.note ?? '' }));
    const loadedGoodLines: DraftGoodLine[] = (o.supplierGoodItems ?? []).map((g) => ({
      id: g.id,
      supplierGoodId: g.supplierGoodId ?? '',
      quantity: g.quantity ?? 1,
      note: g.note ?? undefined,
      lineKind: g.lineKind,
    }));
    setNotes(loadedNotes);
    setExtras(loadedExtras);
    setGoodLines(loadedGoodLines);
    setFallbackNames(Object.fromEntries((o.orderItems ?? []).map((it) => [it.productId ?? '', it.productName ?? '—'])));
    // The detail response already names and prices each good. Kept as a fallback so a
    // loaded line renders before the suppliers' price lists arrive — and keeps rendering
    // if the good has since been taken off the supplier.
    setGoodFallback(Object.fromEntries((o.supplierGoodItems ?? []).map((g) => [g.supplierGoodId ?? '', {
      goodName: g.goodName ?? '—',
      goodSize: g.goodSize ?? undefined,
      supplierName: g.supplierName ?? '',
      unitPriceWithVat: g.unitPriceWithVat ?? undefined,
    }])));
    autoTabClientRef.current = loadedClientId;
    baselineRef.current = serializeForm(loadedClientId, loadedDate, loadedCart, loadedReturns, loadedNotes, loadedExtras, loadedDeliveryAddress, loadedGoodLines);
  }, [mode, orderQuery.data]);

  const historyQuery = useClientProductHistory(clientId ?? undefined);

  // 'open', not 'all': this is a to-do list, and it is read before the cart is built rather
  // than at the save button — beside the existing product-history read.
  const ledgerQuery = useClientLedger(clientId ?? undefined, 'open');
  // Memoised: the fallback array is a fresh value every render, which would make the in-cart
  // lookup below recompute each time.
  const openLedger = useMemo(() => ledgerQuery.data ?? [], [ledgerQuery.data]);

  /**
   * Reads the promises this order already carries into the draft, once.
   *
   * The save posts `settledLedgerEntryIds` as the authoritative set — anything this order carries
   * that is not in it gets released. So an untouched reopen-and-save was quietly dropping every
   * promise the order had made, and the undo button had nothing to take back either.
   */
  useEffect(() => {
    if (mode !== 'edit' || !orderId || seededPromisesRef.current) return;
    if (ledgerQuery.data === undefined) return;

    seededPromisesRef.current = true;
    const carried = openLedger
      .filter((e) => e.id != null && e.resolvedByOrderId === orderId)
      .map((e) => e.id!);

    if (carried.length > 0) setSettledEntryIds((prev) => [...new Set([...prev, ...carried])]);
  }, [mode, orderId, ledgerQuery.data, openLedger]);

  // Which open points this draft promises to settle. Held in the draft and sent on save: the
  // server links them to the order and closes them only when it actually arrives, because
  // promising is not delivering.
  const [settledEntryIds, setSettledEntryIds] = useState<string[]>([]);
  /** Undo information for the promises above. See {@link LedgerAdd}. */
  const [ledgerAdds, setLedgerAdds] = useState<LedgerAdd[]>([]);
  /** Whether the promises this order already carries have been read into the draft. */
  const seededPromisesRef = useRef(false);
  /**
   * Which cart row's kind is being chosen. One menu for the whole cart rather than one per row:
   * a Menu per line mounts a popover per line, and a twenty-line cart pays for twenty of them.
   */
  const [kindMenu, setKindMenu] = useState<{ anchor: HTMLElement; key: string; isGood: boolean } | null>(null);
  const [confirmShortfall, setConfirmShortfall] = useState(false);

  // Auto-pick the catalog tab once, right after a client is (re)selected —
  // history if they have any, else browse — mirrors the prototype's
  // oePickClient. Guarded so it fires once per selection, not on every refetch.
  useEffect(() => {
    if (!historyQuery.data || autoTabClientRef.current !== clientId) return;
    setCatalogTab((historyQuery.data.recent?.length ?? 0) > 0 ? 'history' : 'browse');
    autoTabClientRef.current = null;
  }, [historyQuery.data, clientId]);

  const colorByBreweryId = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of breweriesQuery.data ?? []) if (b.id && b.color) m.set(b.id, b.color);
    return m;
  }, [breweriesQuery.data]);

  const allProductsQuery = useProducts();

  // Full product lookup, so the cart can render names/prices/totals without an extra
  // fetch per line.
  //
  // Fed by *both* catalog sources, not just the history one. The catalog can be browsed
  // with no client chosen, and then it reads the plain product list — a lookup that knew
  // only the client-history query (disabled until there is a client) left every line added
  // that way showing "—" and 0 Kč, cart total included.
  //
  // The plain list goes in first so a history entry overwrites it: that response is the
  // only one carrying the client's negotiated price.
  const productMap = useMemo(() => {
    const m = new Map<string, ProductListItemDto>();
    for (const p of allProductsQuery.data ?? []) if (p.id) m.set(p.id, p);
    const data = historyQuery.data;
    if (data) {
      for (const p of data.recent ?? []) if (p.id) m.set(p.id, p);
      for (const b of data.breweries ?? []) {
        for (const k of b.kinds ?? []) {
          for (const pkg of k.packageSizes ?? []) {
            for (const p of pkg.items ?? []) if (p.id) m.set(p.id, p);
          }
        }
      }
    }
    return m;
  }, [historyQuery.data, allProductsQuery.data]);

  // Suppliers' price lists for the "Další zboží" tab. Two steps because the list
  // endpoint carries goods *names* but not their ids or prices; the same
  // list-then-details pattern the dovoz editor uses, sharing one cache with it.
  const suppliersQuery = useSuppliers();
  const supplierIds = useMemo(
    () => (suppliersQuery.data ?? []).map((s) => s.id).filter((id): id is string => Boolean(id)),
    [suppliersQuery.data],
  );
  const { bySupplier: supplierDetails } = useSuppliersMany(supplierIds);
  // Sorted by name so the panels keep one order while the details stream in.
  const loadedSuppliers = useMemo(
    () => supplierIds.map((id) => supplierDetails.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s)),
    // supplierDetails is a fresh Map per render (see useSuppliersMany), so it cannot be a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplierIds, supplierIds.map((id) => supplierDetails.has(id)).join(',')],
  );
  const goodMap = useMemo(() => resolvedGoodMap(loadedSuppliers), [loadedSuppliers]);
  const supplierGroups = useMemo(() => groupSupplierGoods(loadedSuppliers, search), [loadedSuppliers, search]);

  /** A good line's unit price: live off the price list, falling back to what the loaded
   *  order recorded when the list has not arrived (or the good is gone). */
  const goodUnitPrice = (goodId: string): number | undefined =>
    primaryPrice(goodMap.get(goodId)?.good)?.price ?? goodFallback[goodId]?.unitPriceWithVat;

  // What the catalog needs of the cart: how many of each product are in it. Ordinary rows only —
  // the catalog's +/− adds goods to deliver, and a bill-only row is not that.
  const cartQuantities = useMemo(
    () => new Map(cart.filter(isNormalLine).map((c) => [c.productId, c.quantity])),
    [cart],
  );
  const goodQtyOf = (goodId: string) => goodLines.find((g) => g.supplierGoodId === goodId)?.quantity ?? 0;
  const cartTotalQty = cart.reduce((n, c) => n + c.quantity, 0) + goodLines.reduce((n, g) => n + g.quantity, 0);
  const cartTotalPrice = cart.reduce((sum, c) => sum + (productMap.get(c.productId)?.priceWithVat ?? 0) * c.quantity, 0)
    + goodLines.reduce((sum, g) => sum + (goodUnitPrice(g.supplierGoodId) ?? 0) * g.quantity, 0);

  const clientOptions: ComboOption[] = useMemo(() => clientComboOptions(clients), [clients]);
  const selectedClient = clients.find((c) => c.id === clientId);

  // Fed to `defaultAddressKind` below once a client is freshly picked — `clients` (the list
  // endpoint) carries no address fields, so the client's official/contact addresses and
  // places are only available once this detail query resolves.
  const selectedClientDetailQuery = useClient(clientId ?? undefined);
  const selectedClientPlacesQuery = useClientDeliveryPlaces(clientId ?? undefined);
  // Set by `changeClient` to the newly picked client id, and cleared once that client's
  // address data has arrived and the picker has been defaulted — mirrors `autoTabClientRef`
  // above. Never set on the initial order load (edit mode): that effect sets `deliveryAddress`
  // itself, from the order's own saved choice, and must not be overridden by this one.
  const pendingDefaultAddressClientRef = useRef<string | null>(null);

  // The old delivery-address choice belongs to the old client — a saved
  // place id or a contact address doesn't carry over, and the backend would
  // reject a place that isn't the new client's. Defaults to Official right away (most
  // clients have one), corrected below once the new client's own data has loaded.
  const changeClient = (next: string | null) => {
    setClientId(next);
    setDeliveryAddress({ kind: DeliveryAddressKind.Official });
    pendingDefaultAddressClientRef.current = next;
  };

  // Corrects the just-picked client's delivery address to a kind it can actually satisfy —
  // a client invoiced through a payer has no official address, and leaving the default at
  // Official would produce an order whose stop renders a blank destination.
  useEffect(() => {
    if (!clientId || pendingDefaultAddressClientRef.current !== clientId) return;
    if (!selectedClientDetailQuery.data || selectedClientPlacesQuery.isLoading) return;
    const { addressKind, deliveryPlaceId } = defaultAddressKind(
      selectedClientDetailQuery.data.officialAddress,
      selectedClientDetailQuery.data.contactAddress,
      selectedClientPlacesQuery.data ?? [],
    );
    setDeliveryAddress({ kind: addressKind, placeId: deliveryPlaceId });
    pendingDefaultAddressClientRef.current = null;
  }, [clientId, selectedClientDetailQuery.data, selectedClientPlacesQuery.isLoading, selectedClientPlacesQuery.data]);

  /** From the catalog: always the ordinary row, never a bill-only one. */
  const addProduct = (productId: string) => {
    if (!productId) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === productId && isNormalLine(c));
      if (existing) {
        return prev.map((c) => (c.productId === productId && isNormalLine(c)
          ? { ...c, quantity: c.quantity + 1 }
          : c));
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  /** The catalog's +/-, which likewise steps the ordinary row. */
  const changeQty = (productId: string, delta: number) => {
    setCart((prev) => prev
      .map((c) => (c.productId === productId && isNormalLine(c) ? { ...c, quantity: c.quantity + delta } : c))
      .filter((c) => c.quantity > 0));
  };

  /** A row's own +/-, which steps exactly the row it belongs to. */
  const changeRowQty = (key: string, delta: number) => {
    setCart((prev) => prev
      .map((c) => (cartKey(c) === key ? { ...c, quantity: c.quantity + delta } : c))
      .filter((c) => c.quantity > 0));
  };

  const removeRow = (key: string) => {
    const row = cart.find((c) => cartKey(c) === key);
    setCart((prev) => prev.filter((c) => cartKey(c) !== key));
    if (row) releaseRow('cart', row.productId, row.lineKind ?? OrderLineKind.Normal);
  };

  /**
   * Which row of the draft would settle a point — the pair {@link promise} records, derived.
   *
   * Derived rather than only remembered, because a promise made on an earlier save has no record
   * in this session: the order comes back carrying it and the draft has to be able to find the
   * row it belongs to anyway.
   */
  const rowFor = (entry: ClientLedgerEntryDto): Omit<LedgerAdd, 'entryId' | 'previousQuantity'> & { needed: number } | undefined => {
    const action = ledgerTodo(entry, formatMoney).action;

    if (action === 'order' && entry.productId) {
      return { target: 'cart', key: entry.productId, lineKind: OrderLineKind.Private, needed: owedPieces(entry) };
    }
    if (action === 'goods' && entry.supplierGoodId) {
      return { target: 'goods', key: entry.supplierGoodId, lineKind: OrderLineKind.Private, needed: owedPieces(entry) };
    }
    if (action === 'extras') {
      return {
        target: 'extras',
        key: lineNameKey(extraLineName(entry)),
        lineKind: OrderLineKind.Normal,
        needed: owedPieces(entry),
      };
    }
    if (action === 'returns') {
      return {
        target: 'returns',
        key: lineNameKey(returnLineName(entry)),
        lineKind: OrderLineKind.Normal,
        needed: owedPieces(entry),
      };
    }
    if (action === 'bill') {
      return entry.productId
        ? { target: 'cart', key: entry.productId, lineKind: OrderLineKind.BillOnly, needed: billablePieces(entry) }
        : {
          target: 'goods',
          key: entry.supplierGoodId!,
          lineKind: OrderLineKind.BillOnly,
          needed: billablePieces(entry),
        };
    }
    if (action === 'none') {
      return {
        target: 'notes',
        key: ledgerNoteText(entry, formatMoney),
        lineKind: OrderLineKind.Normal,
        needed: 0,
      };
    }

    return undefined;
  };

  /** Records the promise and how to take it back. */
  const promise = (entry: ClientLedgerEntryDto, add: Omit<LedgerAdd, 'entryId'>) => {
    if (!entry.id) return;
    const entryId = entry.id;
    setSettledEntryIds((prev) => (prev.includes(entryId) ? prev : [...prev, entryId]));
    setLedgerAdds((prev) => (prev.some((a) => a.entryId === entryId)
      ? prev
      : [...prev, { entryId, ...add }]));
  };

  /**
   * Drops the promise on every point that was settled by a row which has just been removed.
   *
   * The other direction of the undo button: pulling the vratka or the cart line out by hand means
   * the order is not settling that point after all, and leaving the promise standing would close
   * the point on delivery with nothing delivered for it.
   */
  const releaseRow = (target: LedgerAdd['target'], key: string, lineKind?: OrderLineKind) => {
    const matches = (candidate: { target: LedgerAdd['target']; key: string; lineKind: OrderLineKind }) =>
      candidate.target === target && candidate.key === key
      && (lineKind === undefined || candidate.lineKind === lineKind);

    // Both the promises made in this session and the ones the order arrived with: after a save
    // and a reopen only the second kind exists, and removing the row it settled has to release
    // it just the same.
    const ids = [
      ...ledgerAdds.filter(matches).map((a) => a.entryId),
      ...openLedger
        .filter((e) => e.id != null && settledEntryIds.includes(e.id))
        .filter((e) => {
          const row = rowFor(e);
          return row != null && matches(row);
        })
        .map((e) => e.id!),
    ];
    if (ids.length === 0) return;

    setSettledEntryIds((prev) => prev.filter((id) => !ids.includes(id)));
    setLedgerAdds((prev) => prev.filter((a) => !ids.includes(a.entryId)));
  };

  /**
   * Puts what is still owed on the order as a private line, and remembers the promise.
   *
   * Private, not ordinary: the shortfall is recorded once the run's invoicing is filed, so the
   * client has already been billed for the pieces that never arrived. Billing them again on the
   * next order would charge twice for one delivery — these pieces travel and go on no invoice.
   *
   * A line of its own, not a top-up of the ordinary one: a client who orders five and is owed one
   * should get six on the van — five billed and one free. Raising the ordinary line to
   * max(five, one) shipped five and billed five, so the missing piece never arrived at all.
   */
  const addOwedToOrder = (entry: ClientLedgerEntryDto) => {
    const productId = entry.productId;
    if (!productId) return;

    const owed = owedPieces(entry);
    const isTheRow = (c: CartLine) => c.productId === productId
      && lineKindName(c.lineKind) === 'Private';
    const previous = cart.find(isTheRow)?.quantity ?? null;

    setCart((prev) => {
      if (!prev.some(isTheRow)) {
        return [...prev, { productId, quantity: owed, lineKind: OrderLineKind.Private }];
      }
      return prev.map((c) => (isTheRow(c) ? { ...c, quantity: Math.max(c.quantity, owed) } : c));
    });

    promise(entry, {
      target: 'cart', key: productId, lineKind: OrderLineKind.Private, previousQuantity: previous,
    });
  };

  /**
   * Sets what a cart row is for: the goods, the money, or both.
   *
   * Retyping a row releases any open point that was settled by it. The promise was made about a
   * row of a particular kind — bill-only pieces settle money, delivered pieces settle goods — so
   * once the kind changes the row is the operator's own and the point is open again. Pressing the
   * card's button re-promises it.
   */
  const setLineKind = (target: { key: string; isGood: boolean }, kind: OrderLineKind) => {
    const previousKind = kindOf(target);

    if (target.isGood) {
      setGoodLines((prev) => prev.map((g) => (g.supplierGoodId === target.key ? { ...g, lineKind: kind } : g)));
      if (previousKind !== kind) releaseRow('goods', target.key, previousKind);
    } else {
      const row = cart.find((c) => cartKey(c) === target.key);
      setCart((prev) => prev.map((c) => (cartKey(c) === target.key ? { ...c, lineKind: kind } : c)));
      if (row && previousKind !== kind) releaseRow('cart', row.productId, previousKind);
    }

    setKindMenu(null);
  };

  /** The kind of the row the menu is open on, so the current choice can be ticked. */
  const kindOf = (target: { key: string; isGood: boolean } | null): OrderLineKind => {
    if (!target) return OrderLineKind.Normal;
    const found = target.isGood
      ? goodLines.find((g) => g.supplierGoodId === target.key)?.lineKind
      : cart.find((c) => cartKey(c) === target.key)?.lineKind;
    return found ?? OrderLineKind.Normal;
  };

  /**
   * Puts pieces the client already took, and has not paid for, on this order as a bill-only line.
   *
   * A line of its own rather than more of an existing one: these pieces must not be loaded, and a
   * quantity added to the ordinary line would be. The price is the client's current one, resolved
   * exactly as any new line's is.
   */
  const addToBill = (entry: ClientLedgerEntryDto) => {
    const billable = billablePieces(entry);
    if (billable <= 0) return;

    if (entry.productId) {
      const productId = entry.productId;
      setCart((prev) => {
        const existing = prev.find((c) => c.productId === productId
          && lineKindName(c.lineKind) === 'BillOnly');
        if (!existing) {
          return [...prev, { productId, quantity: billable, lineKind: OrderLineKind.BillOnly }];
        }
        return prev.map((c) => (c.productId === productId && lineKindName(c.lineKind) === 'BillOnly'
          ? { ...c, quantity: Math.max(c.quantity, billable) }
          : c));
      });
    } else if (entry.supplierGoodId) {
      const goodId = entry.supplierGoodId;
      setGoodLines((prev) => {
        const existing = prev.find((g) => g.supplierGoodId === goodId
          && lineKindName(g.lineKind) === 'BillOnly');
        if (!existing) {
          return [...prev, { supplierGoodId: goodId, quantity: billable, lineKind: OrderLineKind.BillOnly }];
        }
        return prev.map((g) => (g.supplierGoodId === goodId && lineKindName(g.lineKind) === 'BillOnly'
          ? { ...g, quantity: Math.max(g.quantity, billable) }
          : g));
      });
    } else {
      return;
    }

    promise(entry, entry.productId
      ? {
        target: 'cart',
        key: entry.productId,
        lineKind: OrderLineKind.BillOnly,
        previousQuantity: cart.find((c) => c.productId === entry.productId
          && lineKindName(c.lineKind) === 'BillOnly')?.quantity ?? null,
      }
      : {
        target: 'goods',
        key: entry.supplierGoodId!,
        lineKind: OrderLineKind.BillOnly,
        previousQuantity: goodLines.find((g) => g.supplierGoodId === entry.supplierGoodId
          && lineKindName(g.lineKind) === 'BillOnly')?.quantity ?? null,
      });
  };

  /**
   * Puts a supplier good that is still owed on the order's own goods lines, and promises the
   * entry. The counterpart of {@link addOwedToOrder} for the other catalog.
   */
  const addOwedGoodToOrder = (entry: ClientLedgerEntryDto) => {
    const goodId = entry.supplierGoodId;
    const owed = owedPieces(entry);
    if (!goodId || owed <= 0) return;

    // Private for the reason addOwedToOrder is: the earlier run billed these pieces.
    const isTheRow = (g: DraftGoodLine) => g.supplierGoodId === goodId
      && lineKindName(g.lineKind) === 'Private';
    const previous = goodLines.find(isTheRow)?.quantity ?? null;

    setGoodLines((prev) => {
      if (!prev.some(isTheRow)) {
        return [...prev, { supplierGoodId: goodId, quantity: owed, lineKind: OrderLineKind.Private }];
      }
      return prev.map((g) => (isTheRow(g) ? { ...g, quantity: Math.max(g.quantity, owed) } : g));
    });

    promise(entry, {
      target: 'goods', key: goodId, lineKind: OrderLineKind.Private, previousQuantity: previous,
    });
  };

  /**
   * Opens a Položky navíc row for a shortfall on one, and promises the entry.
   *
   * A row of that list rather than a note: an extra is free text and a count, so what the order
   * needs is another row exactly like the one that came up short. Nothing is said here about the
   * money — what an extra costs is not modelled yet.
   */
  const addOwedToExtras = (entry: ClientLedgerEntryDto) => {
    const owed = owedPieces(entry);
    if (owed <= 0) return;

    const description = extraLineName(entry);
    const key = lineNameKey(description);
    const previous = extras.find((e) => lineNameKey(e.description) === key)?.quantity ?? null;

    setExtras((prev) => {
      if (!prev.some((e) => lineNameKey(e.description) === key)) {
        return [...prev, { description, quantity: owed, note: '' }];
      }
      return prev.map((e) => (lineNameKey(e.description) === key
        ? { ...e, quantity: Math.max(e.quantity, owed) }
        : e));
    });

    promise(entry, {
      target: 'extras', key, lineKind: OrderLineKind.Normal, previousQuantity: previous,
    });
  };

  /**
   * Opens a vratka row for empties the client did not hand back, and promises the entry.
   *
   * A vratka rather than a cart line: there is no product to price, only a name and a count. The
   * name is the key the row is matched back by, so an existing row of the same name is topped up
   * instead of a second one being opened beside it.
   */
  const addOwedToReturns = (entry: ClientLedgerEntryDto) => {
    const owed = owedPieces(entry);
    if (owed <= 0) return;

    const name = returnLineName(entry);
    const previous = returns.find((r) => lineNameKey(r.name) === lineNameKey(name))?.quantity ?? null;
    setReturns((prev) => {
      const existing = prev.find((r) => lineNameKey(r.name) === lineNameKey(name));
      if (!existing) return [...prev, { name, quantity: owed, note: '' }];
      return prev.map((r) => (lineNameKey(r.name) === lineNameKey(name)
        ? { ...r, quantity: Math.max(r.quantity, owed) }
        : r));
    });

    promise(entry, {
      target: 'returns',
      key: lineNameKey(name),
      lineKind: OrderLineKind.Normal,
      previousQuantity: previous,
    });
  };

  /**
   * Writes an open point onto the order as a note, and promises it.
   *
   * No line: cash to collect, a deposit to hand back and a plain remark have nothing to load and
   * nothing to bill. What the delivery needs is for somebody to be told, so the order carries the
   * sentence and the point closes when the order arrives.
   */
  const addLedgerNote = (entry: ClientLedgerEntryDto) => {
    const text = ledgerNoteText(entry, formatMoney);
    if (notes.some((n) => n.text.trim() === text)) return;

    setNotes((prev) => [...prev, { text }]);
    promise(entry, {
      target: 'notes', key: text, lineKind: OrderLineKind.Normal, previousQuantity: null,
    });
  };

  /**
   * Takes a promise back, and with it what adding it did to the draft.
   *
   * The row goes only if the add opened it. One that was already there for its own sake is put
   * back to the count it had — deleting it would throw away something nobody asked to delete.
   * A promise made by an earlier save has no record here: there is nothing in this draft to undo,
   * so only the promise is dropped and the line stays for the operator to adjust.
   */
  const unpromiseLedgerEntry = (entry: ClientLedgerEntryDto) => {
    const recorded = ledgerAdds.find((a) => a.entryId === entry.id);

    if (recorded) {
      restoreRow(recorded);
    } else {
      // A promise from an earlier save has no record of what adding it did, so it is undone by
      // the arithmetic that made it: the add raised the row by what the point needed, so this
      // lowers it by the same and drops a row that empties out.
      const derived = rowFor(entry);
      if (derived) lowerRow(derived);
    }

    setSettledEntryIds((prev) => prev.filter((id) => id !== entry.id));
    setLedgerAdds((prev) => prev.filter((a) => a.entryId !== entry.id));
  };

  /** Puts a row back where it was before the add: to its old count, or gone if it had none. */
  const restoreRow = (add: LedgerAdd) => {
    const sameKind = (kind?: OrderLineKind) => lineKindName(kind) === lineKindName(add.lineKind);

    if (add.target === 'cart') {
      const isTheRow = (c: CartLine) => c.productId === add.key && sameKind(c.lineKind);
      setCart((prev) => (add.previousQuantity == null
        ? prev.filter((c) => !isTheRow(c))
        : prev.map((c) => (isTheRow(c) ? { ...c, quantity: add.previousQuantity! } : c))));
    } else if (add.target === 'goods') {
      const isTheRow = (g: DraftGoodLine) => g.supplierGoodId === add.key && sameKind(g.lineKind);
      setGoodLines((prev) => (add.previousQuantity == null
        ? prev.filter((g) => !isTheRow(g))
        : prev.map((g) => (isTheRow(g) ? { ...g, quantity: add.previousQuantity! } : g))));
    } else if (add.target === 'extras') {
      setExtras((prev) => (add.previousQuantity == null
        ? prev.filter((e) => lineNameKey(e.description) !== add.key)
        : prev.map((e) => (lineNameKey(e.description) === add.key
          ? { ...e, quantity: add.previousQuantity! }
          : e))));
    } else if (add.target === 'returns') {
      setReturns((prev) => (add.previousQuantity == null
        ? prev.filter((r) => lineNameKey(r.name) !== add.key)
        : prev.map((r) => (lineNameKey(r.name) === add.key
          ? { ...r, quantity: add.previousQuantity! }
          : r))));
    } else {
      setNotes((prev) => prev.filter((n) => n.text.trim() !== add.key));
    }
  };

  /** Takes back exactly what the point needed, dropping the row when nothing is left of it. */
  const lowerRow = (row: { target: LedgerAdd['target']; key: string; lineKind: OrderLineKind; needed: number }) => {
    const sameKind = (kind?: OrderLineKind) => lineKindName(kind) === lineKindName(row.lineKind);
    const lowered = (quantity: number) => quantity - row.needed;

    if (row.target === 'cart') {
      const isTheRow = (c: CartLine) => c.productId === row.key && sameKind(c.lineKind);
      setCart((prev) => prev
        .map((c) => (isTheRow(c) ? { ...c, quantity: lowered(c.quantity) } : c))
        .filter((c) => c.quantity > 0));
    } else if (row.target === 'goods') {
      const isTheRow = (g: DraftGoodLine) => g.supplierGoodId === row.key && sameKind(g.lineKind);
      setGoodLines((prev) => prev
        .map((g) => (isTheRow(g) ? { ...g, quantity: lowered(g.quantity) } : g))
        .filter((g) => g.quantity > 0));
    } else if (row.target === 'extras') {
      setExtras((prev) => prev
        .map((e) => (lineNameKey(e.description) === row.key ? { ...e, quantity: lowered(e.quantity) } : e))
        .filter((e) => e.quantity > 0));
    } else if (row.target === 'returns') {
      setReturns((prev) => prev
        .map((r) => (lineNameKey(r.name) === row.key ? { ...r, quantity: lowered(r.quantity) } : r))
        .filter((r) => r.quantity > 0));
    } else {
      setNotes((prev) => prev.filter((n) => n.text.trim() !== row.key));
    }
  };

  // How much of each promised entry's product the cart holds, so the row can say
  // "dluh 3 ks · přidáno 2 ks" and the save can ask about the shortfall.
  const inCartByEntryId = useMemo(() => {
    // Keyed by product AND kind: one product can sit in the cart twice, and a debt is carried by
    // the private line. Keying by product alone reported whichever line came last.
    const byRow = new Map(cart.map((c) => [cartKey(c), c.quantity]));
    return new Map(
      openLedger
        .filter((e) => e.id && e.productId)
        .map((e) => [
          e.id!,
          byRow.get(cartKey({ productId: e.productId!, lineKind: OrderLineKind.Private })) ?? 0,
        ]),
    );
  }, [cart, openLedger]);

  // The same for the goods lines, keyed by the good the entry points at.
  const inGoodsByEntryId = useMemo(() => {
    const byGood = new Map(goodLines
      .filter((g) => lineKindName(g.lineKind) === 'Private')
      .map((g) => [g.supplierGoodId, g.quantity]));
    return new Map(
      openLedger
        .filter((e) => e.id && isGoodSettleable(e))
        .map((e) => [e.id!, byGood.get(e.supplierGoodId!) ?? 0]),
    );
  }, [goodLines, openLedger]);

  // The same for the bill-only rows, so a billable entry can say how much of it the draft
  // already carries. Both catalogs, because either can be the thing that was taken.
  const inBillByEntryId = useMemo(() => {
    const billedProducts = new Map(cart
      .filter((c) => lineKindName(c.lineKind) === 'BillOnly')
      .map((c) => [c.productId, c.quantity]));
    const billedGoods = new Map(goodLines
      .filter((g) => lineKindName(g.lineKind) === 'BillOnly')
      .map((g) => [g.supplierGoodId, g.quantity]));

    return new Map(
      openLedger
        .filter((e) => e.id && isBillable(e))
        .map((e) => [
          e.id!,
          (e.productId ? billedProducts.get(e.productId) : billedGoods.get(e.supplierGoodId!)) ?? 0,
        ]),
    );
  }, [cart, goodLines, openLedger]);

  // The same for the Položky navíc, keyed by the row's description.
  const inExtrasByEntryId = useMemo(() => {
    const byName = new Map(extras.map((e) => [lineNameKey(e.description), e.quantity]));
    return new Map(
      openLedger
        .filter((e) => e.id && isExtraSettleable(e))
        .map((e) => [e.id!, byName.get(lineNameKey(extraLineName(e))) ?? 0]),
    );
  }, [extras, openLedger]);

  // The same for the vratky, keyed by the row's name — a vratka has no id to match on until it
  // is saved, and the name is what opened the row in the first place.
  const inReturnsByEntryId = useMemo(() => {
    const byName = new Map(returns.map((r) => [lineNameKey(r.name), r.quantity]));
    return new Map(
      openLedger
        .filter((e) => e.id && isReturnSettleable(e))
        .map((e) => [e.id!, byName.get(lineNameKey(returnLineName(e))) ?? 0]),
    );
  }, [returns, openLedger]);

  // Supplier-good lines mirror the product handlers, keyed by good id. A line's `id`
  // survives quantity edits so the backend patches the row rather than replacing it.
  const addGood = (goodId: string) => {
    if (!goodId) return;
    setGoodLines((prev) => {
      const existing = prev.find((g) => g.supplierGoodId === goodId);
      if (existing) return prev.map((g) => (g.supplierGoodId === goodId ? { ...g, quantity: g.quantity + 1 } : g));
      return [...prev, { supplierGoodId: goodId, quantity: 1 }];
    });
  };
  const changeGoodQty = (goodId: string, delta: number) => {
    setGoodLines((prev) => prev
      .map((g) => (g.supplierGoodId === goodId ? { ...g, quantity: g.quantity + delta } : g))
      .filter((g) => g.quantity > 0));
  };
  const removeGood = (goodId: string) => {
    const row = goodLines.find((g) => g.supplierGoodId === goodId);
    setGoodLines((prev) => prev.filter((g) => g.supplierGoodId !== goodId));
    if (row) releaseRow('goods', goodId, row.lineKind ?? OrderLineKind.Normal);
  };
  const setCartNote = (key: string, note: string) => setCart((prev) => prev
    .map((c) => (cartKey(c) === key ? { ...c, note } : c)));

  // Which cart lines have their note field revealed. A line that already carries a
  // note counts as revealed without an entry, so a loaded order shows its notes.
  const isNoteOpen = (line: CartLine) => noteOpen[cartKey(line)] ?? Boolean(line.note);
  const toggleNote = (line: CartLine) => setNoteOpen((prev) => ({ ...prev, [cartKey(line)]: !isNoteOpen(line) }));

  const matchesSearch = (p: ProductListItemDto) => matchesQuery(p, search);

  // Sorted before the search filter, so the list and the tab's own count agree on
  // one order — the same one "Procházet dle pivovaru" uses.
  const recentAll = useMemo(() => inDisplayOrder(historyQuery.data?.recent ?? []), [historyQuery.data]);
  const recent = recentAll.filter(matchesSearch);
  // Browsing the catalog does not depend on the client — only "Dříve objednané" does.
  // Without one, the history endpoint is disabled, so the nesting is rebuilt from the
  // unconditional product list. With one, the endpoint's own grouping wins: it is the only
  // source carrying that client's negotiated prices.
  const breweries = clientId
    ? historyQuery.data?.breweries ?? []
    : groupByBrewery(allProductsQuery.data ?? []);
  // Whichever query actually backs the catalog right now. Keyed on the history query alone,
  // the spinner never showed without a client — a disabled query does not report isLoading —
  // and the browse tab flashed an empty catalog while the product list was still in flight.
  const catalogLoading = clientId ? historyQuery.isLoading : allProductsQuery.isLoading;

  const kindCounts = useMemo(
    () => countsByKind(breweries, matchesSearch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [breweries, search],
  );

  const busy = createOrder.isPending || updateOrder.isPending;

  const snapshot = serializeForm(clientId, requiredDate, cart, returns, notes, extras, deliveryAddress, goodLines);
  const dirty = baselineRef.current !== null && snapshot !== baselineRef.current;
  const { blocker, allowNext } = useUnsavedChangesGuard(dirty);

  /**
   * Promised entries the cart does not fully cover.
   *
   * Resolution is binary: an entry assigned to an order closes whole when that order arrives,
   * so a debt of three settled with two loses the third. That cost cannot be prevented in a
   * binary model — it can only be made visible before it is paid.
   */
  const shortfalls = openLedger
    .filter((e) => e.id && settledEntryIds.includes(e.id)
      && (isSettleable(e) || isGoodSettleable(e) || isExtraSettleable(e)
        || isReturnSettleable(e) || isBillable(e)))
    .map((e) => ({
      entry: e,
      owed: isBillable(e) ? billablePieces(e) : owedPieces(e),
      // Whichever list is carrying it — a vratka promised for 5 crates and opened for 4 loses the
      // fifth exactly as a cart line would, and so does a goods line.
      inCart: (isSettleable(e)
        ? inCartByEntryId.get(e.id!)
        : isGoodSettleable(e)
          ? inGoodsByEntryId.get(e.id!)
          : isExtraSettleable(e)
            ? inExtrasByEntryId.get(e.id!)
            : isBillable(e)
              ? inBillByEntryId.get(e.id!)
              : inReturnsByEntryId.get(e.id!)) ?? 0,
    }))
    .filter((x) => x.inCart < x.owed);

  /**
   * Persist only (no navigation); returns the saved id or null on failure.
   *
   * `ignoreShortfall` is an argument rather than state on purpose: the confirmation dialog's
   * handler closes over the render that opened it, so a flag set beside it would still read
   * false when the save re-ran.
   */
  const persist = async ({ ignoreShortfall = false } = {}): Promise<string | null> => {
    if (!clientId) { enqueueSnackbar('Vyberte klienta', { variant: 'warning' }); return null; }
    if (shortfalls.length > 0 && !ignoreShortfall) { setConfirmShortfall(true); return null; }
    // Either kind of line counts: a client asking only for a CO₂ refill has ordered.
    if (cart.length === 0 && goodLines.length === 0) { enqueueSnackbar('Přidejte alespoň jednu položku', { variant: 'warning' }); return null; }
    // Blank-name rows are scratch rows the user never filled in — drop them
    // rather than fail validation on save.
    const returnsPayload = returns
      .filter((r) => r.name.trim())
      .map((r) => new OrderReturnDto({ id: r.id, name: r.name.trim(), quantity: r.quantity, note: r.note.trim() || undefined }));

    const notesPayload = notes
      .filter((n) => n.text.trim())
      .map((n) => new OrderNoteDto({ id: n.id, text: n.text.trim() }));

    const extrasPayload = extras
      .filter((e) => e.description.trim())
      .map((e) => new OrderCustomExtraItemDto({
        id: e.id,
        description: e.description.trim(),
        quantity: e.quantity,
        note: e.note.trim() || undefined,
      }));

    // Only the id, the good and the quantity are written; the name and price on the DTO
    // are read-only fields the server resolves.
    const supplierGoodsPayload = goodLines.map((g) => new OrderSupplierGoodItemDto({
      id: g.id,
      supplierGoodId: g.supplierGoodId,
      quantity: g.quantity,
      note: g.note?.trim() || undefined,
      lineKind: g.lineKind ?? OrderLineKind.Normal,
    }));

    try {
      let savedId: string;
      if (mode === 'edit' && orderId) {
        const result = await updateOrder.mutateAsync({
          id: orderId,
          data: new UpdateOrderDto({
            clientId,
            requiredDeliveryDate: requiredDate ? requiredDate.toDate() : undefined,
            orderItems: cart.map((c) => new UpdateOrderItemDto({
              productId: c.productId,
              quantity: c.quantity,
              reminderState: c.reminderState,
              note: c.note?.trim() || undefined,
              lineKind: c.lineKind ?? OrderLineKind.Normal,
            })),
            returns: returnsPayload,
            notes: notesPayload,
            customExtraItems: extrasPayload,
            supplierGoodItems: supplierGoodsPayload,
            deliveryAddressKind: deliveryAddress.kind,
            clientDeliveryPlaceId: deliveryAddress.placeId,
            settledLedgerEntryIds: settledEntryIds,
          }),
        });
        savedId = orderId;
        enqueueSnackbar('Objednávka uložena.', { variant: 'success' });

        // What this save undid on the run. Said out loud because it is somebody else's work: a
        // Fakturace row that had been checked off, a line counted into the van. The server
        // decides it — the alternative was a copy of that rule here, drifting.
        const undone = shipmentWorkUndone(result);
        if (undone) enqueueSnackbar(undone, { variant: 'warning' });
      } else {
        savedId = await createOrder.mutateAsync(new CreateOrderDto({
          clientId,
          requiredDeliveryDate: requiredDate ? requiredDate.toDate() : undefined,
          orderItems: cart.map((c) => new CreateOrderItemDto({
            productId: c.productId,
            quantity: c.quantity,
            reminderState: c.reminderState,
            note: c.note?.trim() || undefined,
            lineKind: c.lineKind ?? OrderLineKind.Normal,
          })),
          returns: returnsPayload,
          notes: notesPayload,
          customExtraItems: extrasPayload,
          supplierGoodItems: supplierGoodsPayload,
          deliveryAddressKind: deliveryAddress.kind,
          clientDeliveryPlaceId: deliveryAddress.placeId,
          settledLedgerEntryIds: settledEntryIds,
        }));
        enqueueSnackbar('Objednávka vytvořena.', { variant: 'success' });
      }
      baselineRef.current = snapshot; // now clean
      return savedId;
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
      return null;
    }
  };

  const handleSave = async (opts?: { ignoreShortfall?: boolean }) => {
    const id = await persist(opts);
    if (id != null) { allowNext(); onDone(id); }
  };

  const title = mode === 'edit' ? `Úprava ${orderNumber(orderId)}` : 'Nová objednávka';

  return (
    <Box>
      {/* Back runs the same onCancel the Zrušit button does, so the router-level
          unsaved-changes guard still intercepts a dirty editor. */}
      <DetailHeader
        onBack={onCancel}
        backLabel="Zpět na objednávky"
        title={title}
        meta={['Vyberte produkty — nejdřív se nabízí dříve objednané.']}
        actions={(
          <>
            <Button onClick={onCancel} color="inherit" disabled={busy}>Zrušit</Button>
            <Button variant="contained" startIcon={<CheckIcon />} onClick={() => handleSave()} disabled={busy}>
              {busy ? 'Ukládám…' : mode === 'edit' ? 'Uložit změny' : 'Vytvořit objednávku'}
            </Button>
          </>
        )}
      />

      {/* The right column is the tight one: a cart row carries a name and five controls, and at
          380px the name was the only part that could give, so it ellipsized. The catalog on the
          left has slack to spare — its rows leave a gap between the label and the +/− — so the
          width comes out of it rather than out of the product names. */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 440px', xl: '1fr 480px' }, alignItems: 'start' }}>
        {/* Client, delivery address and term. First in DOM order so it leads on a
            phone: the catalog stays empty until a client is picked, so the picker
            cannot sit below the thing it unlocks. Explicit placement puts it back
            at the top of the right column on lg. */}
        <Card sx={{ p: 2.5, gridColumn: { lg: 2 }, gridRow: { lg: 1 } }}>
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.75 }}>
                Klient <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              </Typography>
              {clientId && selectedClient ? (
                <Stack
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  sx={{ p: 1.25, border: 1, borderColor: 'warning.main', borderRadius: 1.5, bgcolor: (t) => t.vars!.palette.brand.amberTint }}
                >
                  <Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800, fontSize: 12, bgcolor: 'background.paper' }}>
                    {clientInitials(selectedClient.name)}
                  </Box>
                  {/* The trading name comes along for the same reason the picker shows it:
                      two clients can share a name, and this card is the only thing standing
                      between the reader and an order billed to the wrong one. */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{selectedClient.name}</Typography>
                    {selectedClient.businessName && (
                      <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>
                        {selectedClient.businessName}
                      </Typography>
                    )}
                  </Box>
                  {mode === 'create' && (
                    <Button size="small" onClick={() => changeClient(null)}>Změnit</Button>
                  )}
                </Stack>
              ) : (
                <Combobox value={clientId} onChange={changeClient} options={clientOptions} placeholder="Vyberte klienta…" fullWidth collapsibleGroups />
              )}
            </Box>

            <OrderDeliveryAddressField
              clientId={clientId}
              value={deliveryAddress}
              onChange={setDeliveryAddress}
              deletedPlaceName={loadedPlaceName}
            />

            <DatePicker
              label="Požadovaný termín dodání"
              value={requiredDate}
              onChange={setRequiredDate}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Stack>
        </Card>

        {/* Self-contained scroll pane (lg+): the catalog is capped to the
            viewport and sticks in place, its body scrolls internally, and
            overscrollBehavior: 'contain' stops that scroll from chaining to the
            page at the ends. So a wheel over the catalog scrolls only the
            catalog; a wheel anywhere else scrolls the page. On xs it flows
            normally in the page (single column). It spans both right-column rows
            so the client card above does not shorten it. */}
        <Card sx={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gridColumn: { lg: 1 },
          gridRow: { lg: '1 / span 2' },
          position: { lg: 'sticky' },
          top: { lg: TOPBAR_H + 16 },
          maxHeight: { lg: `calc(100vh - ${TOPBAR_H + 32}px)` },
        }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider', flex: '0 0 auto' }}>
            <HistoryIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Katalog produktů</Typography>
          </Stack>
          <Box sx={{ p: 2.5, flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {/* A container, not a viewport breakpoint: what decides whether the three tabs
                fit is this column's width, and the column stays narrow even on a 1194px
                iPad in landscape. Keyed on the viewport, the labels stayed long exactly
                where they needed to shrink. */}
            <Box sx={{ containerType: 'inline-size' }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={catalogTab}
              onChange={(_e, v: 'history' | 'browse' | 'suppliers' | null) => v && setCatalogTab(v)}
              sx={{
                mb: 1.75,
                // Fill the column instead of leaving a ragged tail. `display: flex` because
                // the group is inline-flex by default, and flex-basis 0 so the three share
                // the width evenly. Wrapping stays as the fallback: flex items will not
                // shrink past their own content, so a very narrow column still breaks
                // rather than overflowing.
                display: 'flex',
                flexWrap: 'wrap',
                '& .MuiToggleButtonGroup-grouped': { flex: '1 1 0', minWidth: 'max-content' },
              }}
            >
              {/* Two labels per tab: the prototype's wording by default, swapped for a short
                  form once this column is too narrow to hold all three side by side. The
                  full label is the base so a browser without @container support — and
                  happy-dom, which the tests query by label — keeps the prototype text. */}
              <ToggleButton value="history" sx={{ gap: 0.75, textTransform: 'none', fontWeight: 700 }}>
                <HistoryIcon fontSize="small" />&nbsp;
                <Box component="span" sx={{ display: 'inline', '@container (max-width: 519.98px)': { display: 'none' } }}>Dříve objednané</Box>
                <Box component="span" sx={{ display: 'none', '@container (max-width: 519.98px)': { display: 'inline' } }}>Dříve</Box>
                {recentAll.length > 0 ? `\u00a0(${recentAll.length})` : ''}
              </ToggleButton>
              <ToggleButton value="browse" sx={{ gap: 0.75, textTransform: 'none', fontWeight: 700 }}>
                <StorefrontIcon fontSize="small" />&nbsp;
                <Box component="span" sx={{ display: 'inline', '@container (max-width: 519.98px)': { display: 'none' } }}>Procházet dle pivovaru</Box>
                <Box component="span" sx={{ display: 'none', '@container (max-width: 519.98px)': { display: 'inline' } }}>Dle pivovaru</Box>
              </ToggleButton>
              <ToggleButton value="suppliers" sx={{ gap: 0.75, textTransform: 'none', fontWeight: 700 }}>
                <LocalShippingOutlinedIcon fontSize="small" />&nbsp;
                <Box component="span" sx={{ display: 'inline', '@container (max-width: 519.98px)': { display: 'none' } }}>Další zboží</Box>
                <Box component="span" sx={{ display: 'none', '@container (max-width: 519.98px)': { display: 'inline' } }}>Zboží</Box>
              </ToggleButton>
            </ToggleButtonGroup>
            </Box>

            <Box sx={{ mb: 1.75 }}>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={catalogTab === 'suppliers' ? 'Hledat zboží nebo dodavatele…' : 'Hledat produkt…'}
                width="100%"
              />
            </Box>

            {catalogTab === 'suppliers' ? (
              // Ahead of the history gate below: this tab reads the suppliers' price
              // lists, not the client's order history, so it must not wait on it.
              suppliersQuery.isLoading || (supplierIds.length > 0 && loadedSuppliers.length === 0) ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={28} /></Box>
              ) : supplierGroups.length === 0 ? (
                <EmptyState
                  icon={<LocalShippingOutlinedIcon />}
                  title={search.trim() ? 'Nic nenalezeno' : 'Žádné zboží dodavatelů'}
                  description={search.trim() ? 'Zkuste jiné hledání.' : 'Dodavatelé zatím nemají v ceníku žádné zboží.'}
                  dense
                />
              ) : (
                supplierGroups.map((g) => (
                  <SupplierGoodPanel
                    key={g.supplierId}
                    supplierName={g.supplierName}
                    goods={g.goods}
                    open={supOpen[g.supplierId] !== false}
                    onToggle={() => setSupOpen((prev) => ({ ...prev, [g.supplierId]: prev[g.supplierId] === false }))}
                    qtyOf={goodQtyOf}
                    formatMoney={formatMoney}
                    onAdd={addGood}
                    onChange={changeGoodQty}
                  />
                ))
              )
            ) : catalogLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={28} /></Box>
            ) : catalogTab === 'history' ? (
              // The only client-dependent tab: it lists what this client ordered before.
              // No "vpravo": the client card is above the catalog on a phone and beside it
              // on lg, so a positional word would be wrong half the time.
              !clientId ? (
                <EmptyState
                  title="Vyberte klienta"
                  description="Dříve objednané se zobrazí po výběru klienta. Katalog můžete procházet i bez toho."
                  dense
                />
              ) : recent.length === 0 ? (
                recentAll.length === 0 ? (
                  <EmptyState
                    icon={<HistoryIcon />}
                    title="Zatím žádná historie"
                    description={'Tento klient ještě nic neobjednal — přepněte na „Procházet dle pivovaru“.'}
                    dense
                  />
                ) : (
                  <EmptyState title="Nic nenalezeno" description="Zkuste jiné hledání." dense />
                )
              ) : (
                <CatalogGroupList
                  products={recent}
                  historyBadge
                  quantities={cartQuantities}
                  colorForBrewery={(id) => (id ? colorByBreweryId.get(id) : undefined)}
                  onAdd={addProduct}
                  onChange={changeQty}
                />
              )
            ) : (
              <>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={kindFilter}
                  onChange={(_e, v: KindTab | 'all' | null) => v !== null && setKindFilter(v)}
                  sx={{
                    mb: 1.75,
                    // Fills the column, like the tab strip above. Every kind renders whether
                    // or not this client's catalog has any, so the row is a fixed six buttons
                    // and the widths do not shift as the data changes.
                    display: 'flex',
                    flexWrap: 'wrap',
                    '& .MuiToggleButtonGroup-grouped': { flex: '1 1 0', minWidth: 'max-content' },
                  }}
                >
                  <ToggleButton value="all" sx={{ textTransform: 'none', fontWeight: 700 }}>Vše</ToggleButton>
                  {KIND_TABS.map((k) => (
                    <ToggleButton key={k} value={k} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      {kindLabel(k)}
                      <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>{kindCounts.get(k) ?? 0}</Box>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                {(() => {
                  const panels = breweryPanels(breweries, kindFilter, matchesSearch);
                  if (panels.length === 0) return <EmptyState title="Žádné produkty v této kategorii" dense />;
                  return panels.map(({ brewery, items }) => (
                    <BreweryGroupPanel
                      key={brewery.breweryId}
                      brewery={brewery}
                      products={items}
                      color={brewery.breweryId ? colorByBreweryId.get(brewery.breweryId) : undefined}
                      open={brewOpen[brewery.breweryId ?? ''] !== false}
                      onToggle={() => setBrewOpen((prev) => ({ ...prev, [brewery.breweryId ?? '']: prev[brewery.breweryId ?? ''] === false }))}
                      quantities={cartQuantities}
                      onAdd={addProduct}
                      onChange={changeQty}
                    />
                  ));
                })()}
              </>
            )}
          </Box>
        </Card>

        {/* Deliberately NOT position: sticky. This column stacks the client, the
            cart, Vratky, Položky navíc and Poznámky; on a populated order — one
            already in planning, say — that runs taller than the viewport. A
            sticky element taller than the screen pins in place and its bottom
            becomes unreachable, so Vratky and everything under it rendered but
            could never be scrolled to. Letting the column scroll with the
            document costs the cart staying in view while browsing the catalog,
            and buys back the three cards below it. A max-height with its own
            overflow would keep the stickiness, but nested scroll containers are
            their own trap here — see app/CLAUDE.md. */}
        <Stack spacing={2} sx={{ gridColumn: { lg: 2 }, gridRow: { lg: 2 } }}>
          {/* Above the cart, not beside the save button: whoever builds the next order needs to
              see what is outstanding before they start filling it. */}
          <ClientOpenItemsPreview
            entries={openLedger}
            inCartByEntryId={inCartByEntryId}
            inGoodsByEntryId={inGoodsByEntryId}
            inExtrasByEntryId={inExtrasByEntryId}
            inBillByEntryId={inBillByEntryId}
            inReturnsByEntryId={inReturnsByEntryId}
            onAddToOrder={addOwedToOrder}
            onAddToGoods={addOwedGoodToOrder}
            onAddToExtras={addOwedToExtras}
            onAddToReturns={addOwedToReturns}
            onAddToBill={addToBill}
            onAddNote={addLedgerNote}
            promisedEntryIds={settledEntryIds}
            currentOrderId={mode === 'edit' ? orderId : undefined}
            onUnpromise={unpromiseLedgerEntry}
          />

          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <ShoppingCartOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Košík</Typography>
              <Chip size="small" label={`${cartTotalQty} ks`} />
            </Stack>
            {cart.length === 0 && goodLines.length === 0 ? (
              <EmptyState icon={<ShoppingCartOutlinedIcon />} title="Košík je prázdný" description="Přidejte produkty z katalogu." dense />
            ) : (
              <>
                <Stack>
                  {cart.map((c) => {
                    const p = productMap.get(c.productId);
                    const name = p?.name ?? fallbackNames[c.productId] ?? '—';
                    const color = p?.breweryId ? colorByBreweryId.get(p.breweryId) : undefined;
                    const lineTotal = (p?.priceWithVat ?? 0) * c.quantity;
                    const noteShown = isNoteOpen(c);
                    return (
                      // Two rows per line: the product itself, and — once revealed — its note.
                      // Keeping the note out of the way unless it is wanted is what stops a
                      // twenty-line cart from doubling in height.
                      <Box key={cartKey(c)} sx={{ px: 2.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap title={name}>{name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {[kindLabel(p?.kind), p?.packageSize != null ? fmtLiters(p.packageSize) : undefined, formatMoney(lineTotal)].filter(Boolean).join(' · ')}
                              {p?.listPriceWithVat != null && (
                                <Box component="span" sx={{ color: (t) => t.vars!.palette.brand.amberStrong }}> · vlastní cena</Box>
                              )}
                            </Typography>
                            {/* Its own line, below the packaging and the money: beside the name it
                                took the width the name needed, and the name is what the reader is
                                looking for. */}
                            {lineKindLabel(c.lineKind) && (
                              <Box sx={{ mt: 0.25 }}>
                                <LedgerTag tone="info" label={lineKindLabel(c.lineKind)!} />
                              </Box>
                            )}
                          </Box>
                          <IconButton size="small" onClick={() => changeRowQty(cartKey(c), -1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }} aria-label="Ubrat">
                            <RemoveIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                          <Typography sx={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.quantity}</Typography>
                          <IconButton size="small" onClick={() => changeRowQty(cartKey(c), 1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }} aria-label="Přidat">
                            <AddIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => toggleNote(c)}
                            sx={{
                              border: 1, borderRadius: 1.5, width: 26, height: 26,
                              borderColor: c.note?.trim() ? 'warning.main' : 'divider',
                              color: c.note?.trim() ? 'warning.dark' : 'inherit',
                            }}
                            aria-label={noteShown ? 'Skrýt poznámku' : 'Přidat poznámku'}
                          >
                            <StickyNote2OutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => setKindMenu({ anchor: e.currentTarget, key: cartKey(c), isGood: false })}
                            sx={{
                              border: 1, borderRadius: 1.5, width: 26, height: 26,
                              borderColor: lineKindLabel(c.lineKind) ? 'warning.main' : 'divider',
                              color: lineKindLabel(c.lineKind) ? 'warning.dark' : 'inherit',
                            }}
                            aria-label={`Druh položky ${name}`}
                          >
                            <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => removeRow(cartKey(c))} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26, color: 'error.main' }} aria-label="Odebrat">
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Stack>
                        {noteShown && (
                          <TextField
                            size="small"
                            fullWidth
                            placeholder="Poznámka k položce (nepovinné)"
                            value={c.note ?? ''}
                            onChange={(e) => setCartNote(cartKey(c), e.target.value)}
                            slotProps={{ htmlInput: { 'aria-label': `Poznámka k položce ${name}` } }}
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Box>
                    );
                  })}
                  {/* Supplier goods sit in the same cart, below the beer. No brewery dot
                      and no note field: they carry no brewery, and the loading table they
                      would instruct never shows them. */}
                  {goodLines.map((g) => {
                    const resolved = goodMap.get(g.supplierGoodId);
                    const fallback = goodFallback[g.supplierGoodId];
                    const name = resolved?.good.name ?? fallback?.goodName ?? '—';
                    const size = resolved?.good.size ?? fallback?.goodSize;
                    const supplierName = resolved?.supplierName ?? fallback?.supplierName ?? '';
                    const lineTotal = (goodUnitPrice(g.supplierGoodId) ?? 0) * g.quantity;
                    return (
                      <Box key={g.supplierGoodId} sx={{ px: 2.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <PropaneOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap title={name}>{name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {[supplierName, size, formatMoney(lineTotal)].filter(Boolean).join(' · ')}
                            </Typography>
                            {lineKindLabel(g.lineKind) && (
                              <Box sx={{ mt: 0.25 }}>
                                <LedgerTag tone="info" label={lineKindLabel(g.lineKind)!} />
                              </Box>
                            )}
                          </Box>
                          <IconButton size="small" onClick={() => changeGoodQty(g.supplierGoodId, -1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }} aria-label="Ubrat">
                            <RemoveIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                          <Typography sx={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.quantity}</Typography>
                          <IconButton size="small" onClick={() => changeGoodQty(g.supplierGoodId, 1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }} aria-label="Přidat">
                            <AddIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => setKindMenu({ anchor: e.currentTarget, key: g.supplierGoodId, isGood: true })}
                            sx={{
                              border: 1, borderRadius: 1.5, width: 26, height: 26,
                              borderColor: lineKindLabel(g.lineKind) ? 'warning.main' : 'divider',
                              color: lineKindLabel(g.lineKind) ? 'warning.dark' : 'inherit',
                            }}
                            aria-label={`Druh položky ${name}`}
                          >
                            <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => removeGood(g.supplierGoodId)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26, color: 'error.main' }} aria-label="Odebrat">
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, py: 1.75 }}>
                  <Typography sx={{ fontWeight: 700 }}>Celkem s DPH</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 17, color: 'warning.dark' }}>{formatMoney(cartTotalPrice)}</Typography>
                </Stack>
              </>
            )}
          </Card>

          {/* Vratky — empty kegs/bottles the client hands back against this
              order. Planned here with the order; the vývoz only displays them. */}
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <UndoIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Vratky</Typography>
              <Button
                size="small"
                startIcon={<AddIcon fontSize="small" />}
                onClick={() => setReturns((rs) => [...rs, { name: '', quantity: 1, note: '' }])}
              >
                Přidat
              </Button>
            </Stack>
            <Stack spacing={1.25} sx={{ p: 2 }}>
              {returns.length === 0 ? (
                <Typography sx={{ fontSize: 13 }} color="text.secondary">
                  Žádné vratky. Přidejte položky, které klient vrací (prázdné sudy, lahve…).
                </Typography>
              ) : returns.map((r, i) => (
                // Two lines per row, boxed so a row doesn't visually merge with the next.
                <Stack key={i} spacing={1} sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      placeholder="Např. prázdné sudy 50 l"
                      value={r.name}
                      onChange={(e) => setReturns((rs) => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      value={r.quantity}
                      onChange={(e) => setReturns((rs) => rs.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))}
                      slotProps={{ htmlInput: { min: 1, style: { width: 56, textAlign: 'right' }, 'aria-label': 'Počet' } }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        setReturns((rs) => rs.filter((_, j) => j !== i));
                        releaseRow('returns', lineNameKey(r.name));
                      }}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26, color: 'error.main' }}
                      aria-label="Odebrat vratku"
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Poznámka (nepovinné)"
                    value={r.note}
                    onChange={(e) => setReturns((rs) => rs.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                  />
                </Stack>
              ))}
            </Stack>
          </Card>

          {/* Položky navíc — things the client wants that no brewery supplies. */}
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Inventory2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Položky navíc</Typography>
              <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => setExtras((es) => [...es, { description: '', quantity: 1, note: '' }])}>
                Přidat
              </Button>
            </Stack>
            <Stack spacing={1.25} sx={{ p: 2 }}>
              {extras.length === 0 ? (
                <Typography sx={{ fontSize: 13 }} color="text.secondary">
                  Žádné položky navíc. Přidejte, co klient chce a pivovar nedodává (tácky, sklo…).
                </Typography>
              ) : extras.map((e, i) => (
                // Two lines per row, boxed like a Vratka so a row doesn't visually
                // merge with the next once the note field is under it.
                <Stack key={i} spacing={1} sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      placeholder="Např. tácky"
                      value={e.description}
                      onChange={(ev) => setExtras((es) => es.map((x, j) => (j === i ? { ...x, description: ev.target.value } : x)))}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      value={e.quantity}
                      onChange={(ev) => setExtras((es) => es.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(ev.target.value) || 1) } : x)))}
                      slotProps={{ htmlInput: { min: 1, style: { width: 56, textAlign: 'right' }, 'aria-label': 'Počet' } }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        setExtras((es) => es.filter((_, j) => j !== i));
                        releaseRow('extras', lineNameKey(e.description));
                      }}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26, color: 'error.main' }}
                      aria-label="Odebrat položku navíc"
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Poznámka (nepovinné)"
                    value={e.note}
                    onChange={(ev) => setExtras((es) => es.map((x, j) => (j === i ? { ...x, note: ev.target.value } : x)))}
                  />
                </Stack>
              ))}
            </Stack>
          </Card>

          {/* Poznámky — any number of free-form notes on the order. */}
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <StickyNote2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Poznámky</Typography>
              <Button
                size="small"
                startIcon={<AddIcon fontSize="small" />}
                onClick={() => setNotes((ns) => [...ns, { text: '' }])}
              >
                Přidat
              </Button>
            </Stack>
            <Stack spacing={1.25} sx={{ p: 2 }}>
              {notes.length === 0 ? (
                <Typography sx={{ fontSize: 13 }} color="text.secondary">
                  Žádné poznámky. Přidejte pokyny k objednávce (např. dovézt dopoledne…).
                </Typography>
              ) : notes.map((n, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="Např. dovézt dopoledne…"
                    value={n.text}
                    onChange={(e) => setNotes((ns) => ns.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setNotes((ns) => ns.filter((_, j) => j !== i));
                      releaseRow('notes', n.text.trim());
                    }}
                    sx={{ mt: 0.5, border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26, color: 'error.main', flexShrink: 0 }}
                    aria-label="Odebrat poznámku"
                  >
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Card>
        </Stack>
      </Box>

      {/* Binary resolution has a cost, and this is where it is made visible: a debt of three
          settled with two closes whole and loses the third. The operator either tops it up or
          knowingly closes it and opens a new entry for the remainder. */}
      <ConfirmDialog
        open={confirmShortfall}
        title="Dluh není dorovnaný"
        destructive={false}
        confirmLabel="Uložit i tak"
        message={(
          <Stack spacing={1}>
            <Typography variant="body2">
              Zařazené body se po doručení objednávky uzavřou celé. Zbytek se ztratí — pokud ho
              chcete dořešit, dorovnejte množství, nebo po uložení založte na zbytek nový záznam.
            </Typography>
            {shortfalls.map(({ entry, owed, inCart }) => (
              <Typography key={entry.id} variant="body2" sx={{ fontWeight: 700 }}>
                {entry.productName ?? entry.lineName ?? 'Položka'} — dluh {owed} ks, přidáno {inCart} ks
              </Typography>
            ))}
          </Stack>
        )}
        onConfirm={() => {
          setConfirmShortfall(false);
          void handleSave({ ignoreShortfall: true });
        }}
        onClose={() => setConfirmShortfall(false)}
      />

      {/* What a line is for. Two of the three combinations of goods and money have a use:
          bill-only settles pieces the client already took at the door, private carries pieces
          that were already paid for. Both are settlements of an earlier delivery, which is why
          they live on the line rather than on the order. */}
      <Menu
        anchorEl={kindMenu?.anchor ?? null}
        open={kindMenu !== null}
        onClose={() => setKindMenu(null)}
      >
        {[
          { kind: OrderLineKind.Normal, label: 'Normální', hint: 'Naloží se i fakturuje' },
          { kind: OrderLineKind.BillOnly, label: 'Jen fakturace', hint: 'Nenaloží se, jen se dofakturuje' },
          { kind: OrderLineKind.Private, label: 'Soukromě', hint: 'Naloží se, ale nefakturuje' },
        ].map((option) => (
          <MenuItem
            key={lineKindName(option.kind)}
            selected={kindOf(kindMenu) === option.kind}
            onClick={() => kindMenu && setLineKind(kindMenu, option.kind)}
          >
            <ListItemText primary={option.label} secondary={option.hint} />
          </MenuItem>
        ))}
      </Menu>

      <UnsavedChangesDialog blocker={blocker} onSave={() => persist().then((id) => id != null)} busy={busy} />
    </Box>
  );
}
