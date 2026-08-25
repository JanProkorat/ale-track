import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Card, Chip, CircularProgress, IconButton, Stack,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
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
import { BreweryGroupPanel, CatalogGroupList, QtyControl } from './ProductCatalog';
import { SearchField } from 'src/components/common/SearchField';
import { EmptyState } from 'src/components/common/EmptyState';
import { apiErrorMessage } from 'src/api/errors';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { initials, fmtLiters, orderNumber } from 'src/lib/format';
import { kindLabel, addrKindValue, chargeKindLabel } from 'src/lib/labels';
import {
  DeliveryAddressKind,
  CreateOrderDto,
  CreateOrderItemDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  OrderReturnDto,
  OrderNoteDto,
  OrderCustomExtraItemDto,
  OrderSupplierGoodItemDto,
  type ProductListItemDto,
  type OrderItemReminderState,
  type SupplierGoodDto,
} from 'src/generated/api-client';
import { useClients, useClient } from 'src/hooks/useClients';
import { useClientDeliveryPlaces } from 'src/hooks/useDeliveryPlaces';
import { defaultAddressKind } from 'src/features/clients/deliveryAddress';
import { useBreweries } from 'src/hooks/useBreweries';
import { useProducts } from 'src/hooks/useProducts';
import { useSuppliers, useSuppliersMany } from 'src/hooks/useSuppliers';
import { groupSupplierGoods, primaryPrice, resolvedGoodMap } from './supplierGoodCatalogModel';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useOrder, useClientProductHistory, useCreateOrder, useUpdateOrder } from 'src/hooks/useOrders';
import { useClientLedger } from 'src/hooks/useClientLedger';
import { type ClientLedgerEntryDto } from 'src/generated/api-client';
import { ClientOpenItemsPreview } from 'src/features/clients/ClientOpenItemsPreview';
import { isSettleable, owedPieces } from 'src/features/clients/ledgerModel';
import { useUnsavedChangesGuard, UnsavedChangesDialog } from 'src/components/common/UnsavedChangesGuard';
import { TOPBAR_H } from 'src/layout/Topbar';
import { OrderDeliveryAddressField } from './OrderDeliveryAddressField';

interface CartLine {
  productId: string;
  quantity: number;
  reminderState?: OrderItemReminderState;
  /** Instruction for whoever loads or delivers this line. */
  note?: string;
}

/** A vratka row being edited. `id` is present only for rows already persisted. */
interface DraftReturn { id?: string; name: string; quantity: number; note: string }

/** An order note being edited. `id` is present only for notes already persisted. */
interface DraftNote { id?: string; text: string }

/** A custom extra being edited — something no brewery supplies. */
interface DraftExtra { id?: string; description: string; quantity: number; note: string }

/**
 * A supplier-good line being edited — gas, packaging, sanitation off a supplier's
 * price list. `id` is present only for lines already persisted; keeping it is what
 * lets the backend patch the row in place instead of replacing it.
 */
interface DraftGoodLine { id?: string; supplierGoodId: string; quantity: number; note?: string }

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
    cart: cart.map((c) => ({ ...c, note: c.note?.trim() ?? '' })),
    returns: returns.map((r) => ({ name: r.name.trim(), quantity: r.quantity, note: r.note.trim() })),
    notes: notes.map((n) => n.text.trim()),
    extras: extras.map((e) => ({ description: e.description.trim(), quantity: e.quantity, note: e.note.trim() })),
    deliveryAddress: { kind: deliveryAddress.kind, placeId: deliveryAddress.placeId ?? null },
    goodLines: goodLines.map((g) => ({ supplierGoodId: g.supplierGoodId, quantity: g.quantity, note: g.note?.trim() ?? '' })),
  });
}
function clientInitials(name?: string): string {
  const [a, b] = (name ?? '').trim().split(/\s+/);
  return initials(a, b);
}


/** One row of the "Další zboží" tab — a good off a supplier's price list. Priced by
 *  {@link primaryPrice}, with no client-price override: a supplier charges every
 *  client the same, so there is no ceník to strike through. */
function SupplierGoodRow({
  good, supplierName, qty, formatMoney, onAdd, onChange,
}: {
  good: SupplierGoodDto;
  supplierName: string;
  qty: number;
  formatMoney: (czk: number) => string;
  onAdd: () => void;
  onChange: (delta: number) => void;
}) {
  const price = primaryPrice(good);
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, border: 1, borderRadius: 2,
      borderColor: qty > 0 ? 'warning.main' : 'divider',
      bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent'),
    }}
    >
      <PropaneOutlinedIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{good.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          {good.size && <Chip size="small" label={good.size} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />}
          <Chip size="small" label={supplierName} sx={{ height: 20, fontSize: 11 }} />
          {price?.kind != null && (
            <Chip size="small" label={chargeKindLabel(price.kind)} sx={{ height: 20, fontSize: 11 }} />
          )}
          {price ? (
            <Typography sx={{ fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(price.price)}</Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">bez ceny</Typography>
          )}
        </Stack>
      </Box>
      <QtyControl qty={qty} onAdd={onAdd} onChange={onChange} />
    </Box>
  );
}

/** A supplier and its goods, collapsible — the "Další zboží" counterpart of
 *  {@link BreweryGroupPanel}, and deliberately the same shape so the two browse
 *  tabs read as one control. */
function SupplierGoodPanel({
  supplierName, goods, open, onToggle, qtyOf, formatMoney, onAdd, onChange,
}: {
  supplierName: string;
  goods: SupplierGoodDto[];
  open: boolean;
  onToggle: () => void;
  qtyOf: (goodId: string) => number;
  formatMoney: (czk: number) => string;
  onAdd: (goodId: string) => void;
  onChange: (goodId: string, delta: number) => void;
}) {
  return (
    <Box sx={{ mb: 1.25, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, width: '100%', textAlign: 'left',
          bgcolor: 'action.hover', border: 0, borderBottom: open ? 1 : 0, borderColor: 'divider',
          px: 1.5, py: 1.25, font: 'inherit', cursor: 'pointer', color: 'text.primary',
        }}
      >
        <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
        <LocalShippingOutlinedIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{supplierName}</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 600, fontSize: 12.5 }}>{goods.length}</Typography>
        <Box sx={{ flex: 1 }} />
      </Box>
      {open && (
        <Box sx={{ p: 1.5, bgcolor: 'background.default' }}>
          <Stack spacing={1.1}>
            {goods.map((g) => (
              <SupplierGoodRow
                key={g.id}
                good={g}
                supplierName={supplierName}
                qty={qtyOf(g.id ?? '')}
                formatMoney={formatMoney}
                onAdd={() => onAdd(g.id ?? '')}
                onChange={(d) => onChange(g.id ?? '', d)}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
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

  // Which open points this draft promises to settle. Held in the draft and sent on save: the
  // server links them to the order and closes them only when it actually arrives, because
  // promising is not delivering.
  const [settledEntryIds, setSettledEntryIds] = useState<string[]>([]);
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

  // What the catalog needs of the cart: how many of each product are in it.
  const cartQuantities = useMemo(
    () => new Map(cart.map((c) => [c.productId, c.quantity])),
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

  const addProduct = (productId: string) => {
    if (!productId) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === productId);
      if (existing) return prev.map((c) => (c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, { productId, quantity: 1 }];
    });
  };
  const changeQty = (productId: string, delta: number) => {
    setCart((prev) => prev
      .map((c) => (c.productId === productId ? { ...c, quantity: c.quantity + delta } : c))
      .filter((c) => c.quantity > 0));
  };
  const removeProduct = (productId: string) => setCart((prev) => prev.filter((c) => c.productId !== productId));

  /**
   * Tops the cart up to what the entry says is owed and remembers the promise.
   *
   * Tops up rather than adds: the product may already be in the cart for its own sake, and
   * adding the debt on top would order it twice.
   */
  const addOwedToOrder = (entry: ClientLedgerEntryDto) => {
    const productId = entry.productId;
    if (!productId) return;

    const owed = owedPieces(entry);
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === productId);
      if (!existing) return [...prev, { productId, quantity: owed }];
      return prev.map((c) => (c.productId === productId
        ? { ...c, quantity: Math.max(c.quantity, owed) }
        : c));
    });

    setSettledEntryIds((prev) => (entry.id && !prev.includes(entry.id) ? [...prev, entry.id] : prev));
  };

  // How much of each promised entry's product the cart holds, so the row can say
  // "dluh 3 ks · přidáno 2 ks" and the save can ask about the shortfall.
  const inCartByEntryId = useMemo(() => {
    const byProduct = new Map(cart.map((c) => [c.productId, c.quantity]));
    return new Map(
      openLedger
        .filter((e) => e.id && e.productId)
        .map((e) => [e.id!, byProduct.get(e.productId!) ?? 0]),
    );
  }, [cart, openLedger]);

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
  const removeGood = (goodId: string) => setGoodLines((prev) => prev.filter((g) => g.supplierGoodId !== goodId));
  const setCartNote = (productId: string, note: string) => setCart((prev) => prev
    .map((c) => (c.productId === productId ? { ...c, note } : c)));

  // Which cart lines have their note field revealed. A line that already carries a
  // note counts as revealed without an entry, so a loaded order shows its notes.
  const isNoteOpen = (line: CartLine) => noteOpen[line.productId] ?? Boolean(line.note);
  const toggleNote = (line: CartLine) => setNoteOpen((prev) => ({ ...prev, [line.productId]: !isNoteOpen(line) }));

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
    .filter((e) => e.id && settledEntryIds.includes(e.id) && isSettleable(e))
    .map((e) => ({ entry: e, owed: owedPieces(e), inCart: inCartByEntryId.get(e.id!) ?? 0 }))
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
    }));

    try {
      let savedId: string;
      if (mode === 'edit' && orderId) {
        await updateOrder.mutateAsync({
          id: orderId,
          data: new UpdateOrderDto({
            clientId,
            requiredDeliveryDate: requiredDate ? requiredDate.toDate() : undefined,
            orderItems: cart.map((c) => new UpdateOrderItemDto({
              productId: c.productId,
              quantity: c.quantity,
              reminderState: c.reminderState,
              note: c.note?.trim() || undefined,
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
      } else {
        savedId = await createOrder.mutateAsync(new CreateOrderDto({
          clientId,
          requiredDeliveryDate: requiredDate ? requiredDate.toDate() : undefined,
          orderItems: cart.map((c) => new CreateOrderItemDto({
            productId: c.productId,
            quantity: c.quantity,
            reminderState: c.reminderState,
            note: c.note?.trim() || undefined,
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

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, alignItems: 'start' }}>
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
            onAddToOrder={addOwedToOrder}
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
                      <Box key={c.productId} sx={{ px: 2.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {[kindLabel(p?.kind), p?.packageSize != null ? fmtLiters(p.packageSize) : undefined, formatMoney(lineTotal)].filter(Boolean).join(' · ')}
                              {p?.listPriceWithVat != null && (
                                <Box component="span" sx={{ color: (t) => t.vars!.palette.brand.amberStrong }}> · vlastní cena</Box>
                              )}
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={() => changeQty(c.productId, -1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }} aria-label="Ubrat">
                            <RemoveIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                          <Typography sx={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.quantity}</Typography>
                          <IconButton size="small" onClick={() => changeQty(c.productId, 1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }} aria-label="Přidat">
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
                          <IconButton size="small" onClick={() => removeProduct(c.productId)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26, color: 'error.main' }} aria-label="Odebrat">
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Stack>
                        {noteShown && (
                          <TextField
                            size="small"
                            fullWidth
                            placeholder="Poznámka k položce (nepovinné)"
                            value={c.note ?? ''}
                            onChange={(e) => setCartNote(c.productId, e.target.value)}
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
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {[supplierName, size, formatMoney(lineTotal)].filter(Boolean).join(' · ')}
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={() => changeGoodQty(g.supplierGoodId, -1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }} aria-label="Ubrat">
                            <RemoveIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                          <Typography sx={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.quantity}</Typography>
                          <IconButton size="small" onClick={() => changeGoodQty(g.supplierGoodId, 1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26 }} aria-label="Přidat">
                            <AddIcon sx={{ fontSize: 15 }} />
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
                      onClick={() => setReturns((rs) => rs.filter((_, j) => j !== i))}
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
                      onClick={() => setExtras((es) => es.filter((_, j) => j !== i))}
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
                    onClick={() => setNotes((ns) => ns.filter((_, j) => j !== i))}
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

      <UnsavedChangesDialog blocker={blocker} onSave={() => persist().then((id) => id != null)} busy={busy} />
    </Box>
  );
}
