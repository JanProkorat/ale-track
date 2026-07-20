import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Breadcrumbs, Button, Card, Chip, CircularProgress, IconButton, Link, Stack,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNextOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/common/PageHeader';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { SearchField } from 'src/components/common/SearchField';
import { EmptyState } from 'src/components/common/EmptyState';
import { apiErrorMessage } from 'src/api/errors';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { initials, plural, fmtLiters, orderNumber } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import {
  ProductKind,
  CreateOrderDto,
  CreateOrderItemDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  type ProductListItemDto,
  type BreweryGroupDto,
  type KindGroupDto,
  type OrderItemReminderState,
} from 'src/generated/api-client';
import { useClients } from 'src/hooks/useClients';
import { useBreweries } from 'src/hooks/useBreweries';
import { useOrder, useClientProductHistory, useCreateOrder, useUpdateOrder } from 'src/hooks/useOrders';
import { TOPBAR_H } from 'src/layout/Topbar';

const KIND_TABS: ProductKind[] = [ProductKind.Keg, ProductKind.Bottle, ProductKind.Can, ProductKind.Multipack, ProductKind.Other];

interface CartLine {
  productId: string;
  quantity: number;
  reminderState?: OrderItemReminderState;
}
interface NameGroup {
  name: string;
  items: ProductListItemDto[];
}

/** Groups a flat product list by name so same-name/different-size variants
 * cluster into one card, in first-seen order — mirrors the prototype's
 * oeGroupList grouping. */
function groupByName(products: ProductListItemDto[]): NameGroup[] {
  const order: string[] = [];
  const byName = new Map<string, ProductListItemDto[]>();
  for (const p of products) {
    const name = p.name ?? '';
    if (!byName.has(name)) { byName.set(name, []); order.push(name); }
    byName.get(name)!.push(p);
  }
  return order.map((name) => ({ name, items: byName.get(name)! }));
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
    <Box sx={{ mb: 1.25 }}>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, width: '100%', textAlign: 'left',
          bgcolor: 'action.hover', border: 1, borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1.1,
          font: 'inherit', cursor: 'pointer', color: 'text.primary',
        }}
      >
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{brewery.breweryName}</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 600, fontSize: 12.5 }}>{products.length}</Typography>
        <Box sx={{ flex: 1 }} />
        <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
      </Box>
      {open && (
        <Box sx={{ mt: 1.1 }}>
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
  const [requiredDate, setRequiredDate] = useState<Dayjs | null>(mode === 'create' ? dayjs().add(3, 'day') : null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [fallbackNames, setFallbackNames] = useState<Record<string, string>>({});
  const [catalogTab, setCatalogTab] = useState<'history' | 'browse'>('history');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<ProductKind | 'all'>('all');
  const [brewOpen, setBrewOpen] = useState<Record<string, boolean>>({});
  const autoTabClientRef = useRef<string | null>(null);
  const loadedOrderRef = useRef(false);

  // Preload the draft from the existing order once its detail arrives (edit mode).
  useEffect(() => {
    if (mode !== 'edit' || loadedOrderRef.current || !orderQuery.data) return;
    const o = orderQuery.data;
    loadedOrderRef.current = true;
    setClientId(o.client?.id ?? null);
    setRequiredDate(o.requiredDeliveryDate ? dayjs(o.requiredDeliveryDate) : null);
    setCart((o.orderItems ?? []).map((it) => ({ productId: it.productId ?? '', quantity: it.quantity ?? 1, reminderState: it.reminderState })));
    setFallbackNames(Object.fromEntries((o.orderItems ?? []).map((it) => [it.productId ?? '', it.productName ?? '—'])));
    autoTabClientRef.current = o.client?.id ?? null;
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

  const clientOptions: ComboOption[] = clients.map((c) => ({ value: c.id ?? '', label: c.name ?? '' }));
  const selectedClient = clients.find((c) => c.id === clientId);

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

  const matchesSearch = (p: ProductListItemDto) => {
    const q = search.trim().toLowerCase();
    return !q || (p.name ?? '').toLowerCase().includes(q);
  };

  const recentAll = historyQuery.data?.recent ?? [];
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

  const handleSave = async () => {
    if (!clientId) { enqueueSnackbar('Vyberte klienta', { variant: 'warning' }); return; }
    if (cart.length === 0) { enqueueSnackbar('Přidejte alespoň jeden produkt', { variant: 'warning' }); return; }
    try {
      if (mode === 'edit' && orderId) {
        await updateOrder.mutateAsync({
          id: orderId,
          data: new UpdateOrderDto({
            clientId,
            requiredDeliveryDate: requiredDate ? requiredDate.toDate() : undefined,
            orderItems: cart.map((c) => new UpdateOrderItemDto({ productId: c.productId, quantity: c.quantity, reminderState: c.reminderState })),
          }),
        });
        enqueueSnackbar('Objednávka uložena.', { variant: 'success' });
        onDone(orderId);
      } else {
        const newId = await createOrder.mutateAsync(new CreateOrderDto({
          clientId,
          requiredDeliveryDate: requiredDate ? requiredDate.toDate() : undefined,
          orderItems: cart.map((c) => new CreateOrderItemDto({ productId: c.productId, quantity: c.quantity, reminderState: c.reminderState })),
        }));
        enqueueSnackbar('Objednávka vytvořena.', { variant: 'success' });
        onDone(newId);
      }
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const title = mode === 'edit' ? `Úprava ${orderNumber(orderId)}` : 'Nová objednávka';

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 16 }} />} sx={{ mb: 1.5, fontSize: 13 }}>
        <Link component="button" type="button" underline="hover" color="text.secondary" onClick={onCancel} sx={{ fontSize: 13 }}>
          Objednávky
        </Link>
        <Typography color="text.primary" sx={{ fontSize: 13 }}>{title}</Typography>
      </Breadcrumbs>

      <PageHeader
        eyebrow="Prodej"
        title={title}
        subtitle="Vyberte produkty — nejdřív se nabízí dříve objednané."
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
        {/* Self-contained scroll pane (lg+): the catalog is capped to the
            viewport and sticks in place, its body scrolls internally, and
            overscrollBehavior: 'contain' stops that scroll from chaining to the
            page at the ends. So a wheel over the catalog scrolls only the
            catalog; a wheel anywhere else scrolls the page. On xs it flows
            normally in the page (single column). */}
        <Card sx={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
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
              <EmptyState title="Vyberte klienta" description="Katalog produktů se zobrazí po výběru klienta vpravo." dense />
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
                      items: (b.kinds ?? [])
                        .filter((k) => kindFilter === 'all' || k.kind === kindFilter)
                        .flatMap(flattenKind)
                        .filter(matchesSearch),
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

        <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: TOPBAR_H + 16 } }}>
          <Card sx={{ p: 2.5 }}>
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
                      <Button size="small" onClick={() => setClientId(null)}>Změnit</Button>
                    )}
                  </Stack>
                ) : (
                  <Combobox value={clientId} onChange={setClientId} options={clientOptions} placeholder="Vyberte klienta…" fullWidth />
                )}
              </Box>

              <DatePicker
                label="Požadovaný termín dodání"
                value={requiredDate}
                onChange={setRequiredDate}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Stack>
          </Card>

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
                    return (
                      <Stack key={c.productId} direction="row" spacing={1.25} alignItems="center" sx={{ px: 2.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
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
                        <IconButton size="small" onClick={() => removeProduct(c.productId)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 26, height: 26, color: 'error.main' }} aria-label="Odebrat">
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Stack>
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
        </Stack>
      </Box>
    </Box>
  );
}
