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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { clientComboOptions } from 'src/features/clients/clientOptions';
import { groupByName, inDisplayOrder, type NameGroup } from './orderCatalogModel';
import { SearchField } from 'src/components/common/SearchField';
import { EmptyState } from 'src/components/common/EmptyState';
import { apiErrorMessage } from 'src/api/errors';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { initials, plural, fmtLiters, orderNumber } from 'src/lib/format';
import { kindLabel, addrKindValue } from 'src/lib/labels';
import {
  ProductKind,
  DeliveryAddressKind,
  CreateOrderDto,
  CreateOrderItemDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  OrderReturnDto,
  OrderNoteDto,
  OrderCustomExtraItemDto,
  type ProductListItemDto,
  type BreweryGroupDto,
  type KindGroupDto,
  type OrderItemReminderState,
} from 'src/generated/api-client';
import { useClients } from 'src/hooks/useClients';
import { useBreweries } from 'src/hooks/useBreweries';
import { useOrder, useClientProductHistory, useCreateOrder, useUpdateOrder } from 'src/hooks/useOrders';
import { useUnsavedChangesGuard, UnsavedChangesDialog } from 'src/components/common/UnsavedChangesGuard';
import { TOPBAR_H } from 'src/layout/Topbar';
import { OrderDeliveryAddressField } from './OrderDeliveryAddressField';

const KIND_TABS: ProductKind[] = [ProductKind.Keg, ProductKind.Bottle, ProductKind.Can, ProductKind.Multipack, ProductKind.Other];

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

/** Serialized snapshot of the savable form state, for unsaved-change detection. */
function serializeForm(
  clientId: string | null,
  date: Dayjs | null,
  cart: CartLine[],
  returns: DraftReturn[],
  notes: DraftNote[],
  extras: DraftExtra[],
  deliveryAddress: { kind: DeliveryAddressKind; placeId?: string },
): string {
  return JSON.stringify({
    clientId,
    date: date ? date.toISOString() : null,
    cart: cart.map((c) => ({ ...c, note: c.note?.trim() ?? '' })),
    returns: returns.map((r) => ({ name: r.name.trim(), quantity: r.quantity, note: r.note.trim() })),
    notes: notes.map((n) => n.text.trim()),
    extras: extras.map((e) => ({ description: e.description.trim(), quantity: e.quantity, note: e.note.trim() })),
    deliveryAddress: { kind: deliveryAddress.kind, placeId: deliveryAddress.placeId ?? null },
  });
}
function flattenKind(k: KindGroupDto): ProductListItemDto[] {
  return (k.packageSizes ?? []).flatMap((pkg) => pkg.items ?? []);
}

function clientInitials(name?: string): string {
  const [a, b] = (name ?? '').trim().split(/\s+/);
  return initials(a, b);
}

function QtyControl({ qty, onAdd, onChange }: { qty: number; onAdd: () => void; onChange: (delta: number) => void }) {
  if (qty <= 0) {
    return (
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon fontSize="small" />}
        onClick={onAdd}
        sx={{ flexShrink: 0, color: 'text.primary', borderColor: 'divider', fontWeight: 700, bgcolor: 'background.paper' }}
      >
        Přidat
      </Button>
    );
  }
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
      <IconButton size="small" onClick={() => onChange(-1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 30, height: 30 }} aria-label="Ubrat">
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{qty}</Typography>
      <IconButton size="small" onClick={() => onChange(1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 30, height: 30 }} aria-label="Přidat">
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function ProductRow({
  product, qty, historyBadge, color, formatMoney, onAdd, onChange,
}: {
  product: ProductListItemDto;
  qty: number;
  historyBadge: boolean;
  color?: string;
  formatMoney: (v?: number) => string;
  onAdd: () => void;
  onChange: (delta: number) => void;
}) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, border: 1, borderRadius: 2,
      borderColor: qty > 0 ? 'warning.main' : 'divider',
      bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent'),
    }}
    >
      <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{product.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          <Chip size="small" label={kindLabel(product.kind)} sx={{ height: 20, fontSize: 11 }} />
          {product.packageSize != null && <Chip size="small" label={fmtLiters(product.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />}
          <Typography sx={{ fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(product.priceWithVat)}</Typography>
          {historyBadge && <Typography sx={{ fontSize: 11, color: 'info.main', fontWeight: 700 }}>dříve objednáno</Typography>}
        </Stack>
      </Box>
      <QtyControl qty={qty} onAdd={onAdd} onChange={onChange} />
    </Box>
  );
}

function VariantCard({
  group, historyBadge, color, cartMap, formatMoney, onAdd, onChange,
}: {
  group: NameGroup;
  historyBadge: boolean;
  color?: string;
  cartMap: Map<string, CartLine>;
  formatMoney: (v?: number) => string;
  onAdd: (productId: string) => void;
  onChange: (productId: string, delta: number) => void;
}) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.1, bgcolor: 'action.hover' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{group.name}</Typography>
        {historyBadge && <Typography sx={{ fontSize: 11, color: 'info.main', fontWeight: 700 }}>dříve objednáno</Typography>}
        <Box sx={{ flex: 1 }} />
        <Chip size="small" label={`${group.items.length} ${plural(group.items.length, 'velikost', 'velikosti', 'velikostí')}`} sx={{ height: 20, fontSize: 11 }} />
      </Stack>
      <Stack>
        {group.items.map((v) => {
          const qty = cartMap.get(v.id ?? '')?.quantity ?? 0;
          return (
            <Stack
              key={v.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent') }}
            >
              <Chip size="small" label={kindLabel(v.kind)} sx={{ height: 20, fontSize: 11 }} />
              <Chip size="small" label={fmtLiters(v.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
              <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>{v.description ?? ''}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(v.priceWithVat)}</Typography>
              <QtyControl qty={qty} onAdd={() => onAdd(v.id ?? '')} onChange={(d) => onChange(v.id ?? '', d)} />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

function CatalogGroupList({
  products, historyBadge, cartMap, colorForBrewery, formatMoney, onAdd, onChange,
}: {
  products: ProductListItemDto[];
  historyBadge: boolean;
  cartMap: Map<string, CartLine>;
  colorForBrewery: (breweryId?: string) => string | undefined;
  formatMoney: (v?: number) => string;
  onAdd: (productId: string) => void;
  onChange: (productId: string, delta: number) => void;
}) {
  const groups = groupByName(products);
  return (
    <Stack spacing={1.1}>
      {groups.map((g) => (g.items.length > 1 ? (
        <VariantCard
          key={g.name}
          group={g}
          historyBadge={historyBadge}
          color={colorForBrewery(g.items[0].breweryId)}
          cartMap={cartMap}
          formatMoney={formatMoney}
          onAdd={onAdd}
          onChange={onChange}
        />
      ) : (
        <ProductRow
          key={g.items[0].id}
          product={g.items[0]}
          qty={cartMap.get(g.items[0].id ?? '')?.quantity ?? 0}
          historyBadge={historyBadge}
          color={colorForBrewery(g.items[0].breweryId)}
          formatMoney={formatMoney}
          onAdd={() => onAdd(g.items[0].id ?? '')}
          onChange={(d) => onChange(g.items[0].id ?? '', d)}
        />
      )))}
    </Stack>
  );
}

function BreweryGroupPanel({
  brewery, products, color, open, onToggle, cartMap, formatMoney, onAdd, onChange,
}: {
  brewery: BreweryGroupDto;
  products: ProductListItemDto[];
  color?: string;
  open: boolean;
  onToggle: () => void;
  cartMap: Map<string, CartLine>;
  formatMoney: (v?: number) => string;
  onAdd: (productId: string) => void;
  onChange: (productId: string, delta: number) => void;
}) {
  return (
    // The whole brewery — header + its products — is one bordered card, so the
    // products clearly live *inside* the brewery rather than beside it.
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
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{brewery.breweryName}</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 600, fontSize: 12.5 }}>{products.length}</Typography>
        <Box sx={{ flex: 1 }} />
      </Box>
      {open && (
        <Box sx={{ p: 1.5, bgcolor: 'background.default' }}>
          <CatalogGroupList
            products={products}
            historyBadge={false}
            cartMap={cartMap}
            colorForBrewery={() => color}
            formatMoney={formatMoney}
            onAdd={onAdd}
            onChange={onChange}
          />
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
  const [catalogTab, setCatalogTab] = useState<'history' | 'browse'>('history');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<ProductKind | 'all'>('all');
  const [brewOpen, setBrewOpen] = useState<Record<string, boolean>>({});
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const autoTabClientRef = useRef<string | null>(null);
  const loadedOrderRef = useRef(false);
  // Baseline of the savable state to compare against for unsaved changes.
  const baselineRef = useRef<string | null>(null);

  // Create mode has a stable initial baseline right away; edit mode sets it once
  // the order loads (below).
  useEffect(() => {
    if (mode === 'create') baselineRef.current = serializeForm(clientId, requiredDate, cart, returns, notes, extras, deliveryAddress);
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
    setNotes(loadedNotes);
    setExtras(loadedExtras);
    setFallbackNames(Object.fromEntries((o.orderItems ?? []).map((it) => [it.productId ?? '', it.productName ?? '—'])));
    autoTabClientRef.current = loadedClientId;
    baselineRef.current = serializeForm(loadedClientId, loadedDate, loadedCart, loadedReturns, loadedNotes, loadedExtras, loadedDeliveryAddress);
  }, [mode, orderQuery.data]);

  const historyQuery = useClientProductHistory(clientId ?? undefined);

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

  // Full product lookup (recent + every browse item) so the cart can render
  // names/prices/totals without any extra fetch per line.
  const productMap = useMemo(() => {
    const m = new Map<string, ProductListItemDto>();
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
  }, [historyQuery.data]);

  const cartMap = useMemo(() => new Map(cart.map((c) => [c.productId, c])), [cart]);
  const cartTotalQty = cart.reduce((n, c) => n + c.quantity, 0);
  const cartTotalPrice = cart.reduce((sum, c) => sum + (productMap.get(c.productId)?.priceWithVat ?? 0) * c.quantity, 0);

  const clientOptions: ComboOption[] = useMemo(() => clientComboOptions(clients), [clients]);
  const selectedClient = clients.find((c) => c.id === clientId);

  // The old delivery-address choice belongs to the old client — a saved
  // place id or a contact address doesn't carry over, and the backend would
  // reject a place that isn't the new client's.
  const changeClient = (next: string | null) => {
    setClientId(next);
    setDeliveryAddress({ kind: DeliveryAddressKind.Official });
  };

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
  const setCartNote = (productId: string, note: string) => setCart((prev) => prev
    .map((c) => (c.productId === productId ? { ...c, note } : c)));

  // Which cart lines have their note field revealed. A line that already carries a
  // note counts as revealed without an entry, so a loaded order shows its notes.
  const isNoteOpen = (line: CartLine) => noteOpen[line.productId] ?? Boolean(line.note);
  const toggleNote = (line: CartLine) => setNoteOpen((prev) => ({ ...prev, [line.productId]: !isNoteOpen(line) }));

  const matchesSearch = (p: ProductListItemDto) => {
    const q = search.trim().toLowerCase();
    return !q || (p.name ?? '').toLowerCase().includes(q);
  };

  // Sorted before the search filter, so the list and the tab's own count agree on
  // one order — the same one "Procházet dle pivovaru" uses.
  const recentAll = useMemo(() => inDisplayOrder(historyQuery.data?.recent ?? []), [historyQuery.data]);
  const recent = recentAll.filter(matchesSearch);
  const breweries = historyQuery.data?.breweries ?? [];

  const kindCounts = useMemo(() => {
    const counts = new Map<ProductKind, number>();
    for (const b of breweries) {
      for (const k of b.kinds ?? []) {
        const kind = k.kind ?? ProductKind.Other;
        const n = flattenKind(k).filter(matchesSearch).length;
        if (n) counts.set(kind, (counts.get(kind) ?? 0) + n);
      }
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breweries, search]);

  const busy = createOrder.isPending || updateOrder.isPending;

  const snapshot = serializeForm(clientId, requiredDate, cart, returns, notes, extras, deliveryAddress);
  const dirty = baselineRef.current !== null && snapshot !== baselineRef.current;
  const { blocker, allowNext } = useUnsavedChangesGuard(dirty);

  // Persist only (no navigation); returns the saved id or null on failure.
  const persist = async (): Promise<string | null> => {
    if (!clientId) { enqueueSnackbar('Vyberte klienta', { variant: 'warning' }); return null; }
    if (cart.length === 0) { enqueueSnackbar('Přidejte alespoň jeden produkt', { variant: 'warning' }); return null; }
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
            deliveryAddressKind: deliveryAddress.kind,
            clientDeliveryPlaceId: deliveryAddress.placeId,
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
          deliveryAddressKind: deliveryAddress.kind,
          clientDeliveryPlaceId: deliveryAddress.placeId,
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

  const handleSave = async () => {
    const id = await persist();
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
            <Button variant="contained" startIcon={<CheckIcon />} onClick={handleSave} disabled={busy}>
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
                  <Typography sx={{ fontWeight: 700, fontSize: 13.5, flex: 1, minWidth: 0 }} noWrap>{selectedClient.name}</Typography>
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
            <ToggleButtonGroup
              exclusive
              size="small"
              value={catalogTab}
              onChange={(_e, v: 'history' | 'browse' | null) => v && setCatalogTab(v)}
              sx={{ mb: 1.75, flexWrap: 'wrap' }}
            >
              <ToggleButton value="history" sx={{ gap: 0.75, textTransform: 'none', fontWeight: 700 }}>
                <HistoryIcon fontSize="small" />&nbsp;Dříve objednané{recentAll.length > 0 ? ` (${recentAll.length})` : ''}
              </ToggleButton>
              <ToggleButton value="browse" sx={{ gap: 0.75, textTransform: 'none', fontWeight: 700 }}>
                <StorefrontIcon fontSize="small" />&nbsp;Procházet dle pivovaru
              </ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ mb: 1.75 }}>
              <SearchField value={search} onChange={setSearch} placeholder="Hledat produkt…" width="100%" />
            </Box>

            {!clientId ? (
              // No "vpravo": the client card is above the catalog on a phone and
              // beside it on lg, so a positional word is wrong half the time.
              <EmptyState title="Vyberte klienta" description="Katalog produktů se zobrazí po výběru klienta." dense />
            ) : historyQuery.isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={28} /></Box>
            ) : catalogTab === 'history' ? (
              recent.length === 0 ? (
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
                  cartMap={cartMap}
                  colorForBrewery={(id) => (id ? colorByBreweryId.get(id) : undefined)}
                  formatMoney={formatMoney}
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
                  onChange={(_e, v: ProductKind | 'all' | null) => v !== null && setKindFilter(v)}
                  sx={{ mb: 1.75, flexWrap: 'wrap' }}
                >
                  <ToggleButton value="all" sx={{ textTransform: 'none', fontWeight: 700 }}>Vše</ToggleButton>
                  {KIND_TABS.filter((k) => (kindCounts.get(k) ?? 0) > 0).map((k) => (
                    <ToggleButton key={k} value={k} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      {kindLabel(k)}
                      <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>{kindCounts.get(k)}</Box>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                {(() => {
                  const panels = breweries
                    .map((b) => ({
                      brewery: b,
                      items: inDisplayOrder((b.kinds ?? [])
                        .filter((k) => kindFilter === 'all' || k.kind === kindFilter)
                        .flatMap(flattenKind)
                        .filter(matchesSearch)),
                    }))
                    .filter((p) => p.items.length > 0);
                  if (panels.length === 0) return <EmptyState title="Žádné produkty v této kategorii" dense />;
                  return panels.map(({ brewery, items }) => (
                    <BreweryGroupPanel
                      key={brewery.breweryId}
                      brewery={brewery}
                      products={items}
                      color={brewery.breweryId ? colorByBreweryId.get(brewery.breweryId) : undefined}
                      open={brewOpen[brewery.breweryId ?? ''] !== false}
                      onToggle={() => setBrewOpen((prev) => ({ ...prev, [brewery.breweryId ?? '']: prev[brewery.breweryId ?? ''] === false }))}
                      cartMap={cartMap}
                      formatMoney={formatMoney}
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
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <ShoppingCartOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Košík</Typography>
              <Chip size="small" label={`${cartTotalQty} ks`} />
            </Stack>
            {cart.length === 0 ? (
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

      <UnsavedChangesDialog blocker={blocker} onSave={() => persist().then((id) => id != null)} busy={busy} />
    </Box>
  );
}
