import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Card, Chip, CircularProgress, Collapse, IconButton, Stack,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import ArrowUpIcon from '@mui/icons-material/KeyboardArrowUpOutlined';
import ArrowDownIcon from '@mui/icons-material/KeyboardArrowDownOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { Combobox } from 'src/components/common/Combobox';
import { SearchField } from 'src/components/common/SearchField';
import { EmptyState } from 'src/components/common/EmptyState';
import { RouteMap, type RouteStop, type RouteEndpoint } from 'src/components/common/RouteMap';
import { apiErrorMessage } from 'src/api/errors';
import { plural, fmtLiters, deliveryNumber } from 'src/lib/format';
import {
  kindLabel, startPointKindName, deliveryStopKindName, chargeKindLabel, chargeKindName,
} from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { useAuth } from 'src/auth/AuthProvider';
import { SUPPLIER_COLOR, CUSTOM_COLOR } from './stopVisuals';
import { supplierRoutePoint } from './supplierRoutePoint';
import { DeliveryCart } from './DeliveryCart';
import { buildCartRows, type CartRow } from './deliveryCartModel';
import { buildStopOptions, parseStopOption } from './deliveryStopOptions';
import {
  serializeDelivery, stopWireFields, lineWireFields, sameLine,
  type DraftLine, type DraftStop,
} from './deliveryDraft';
import {
  ProductKind,
  CreateProductsDeliveryDto,
  CreateProductDeliveryStopDto,
  CreateProductDeliveryItemDto,
  UpdateProductDeliveryDto,
  UpdateProductDeliveryStopDto,
  UpdateProductDeliveryItemDto,
  ProductDeliveryState,
  SupplierChargeKind,
  type BreweryProductListItemDto,
  type SupplierDto,
} from 'src/generated/api-client';
import { CustomStopDialog, type CustomStopResult } from 'src/components/common/CustomStopDialog';
import { useBreweries } from 'src/hooks/useBreweries';
import { useSuppliers, useSuppliersMany } from 'src/hooks/useSuppliers';
import { useBreweryProductsMany } from 'src/hooks/useBreweryProducts';
import { useDrivers } from 'src/hooks/useDrivers';
import { useVehicles } from 'src/hooks/useVehicles';
import { useDelivery, useCreateDelivery, useUpdateDelivery } from 'src/hooks/useDeliveries';
import { useShipmentStartPoints } from 'src/hooks/useShipments';
import { useUnsavedChangesGuard, UnsavedChangesDialog } from 'src/components/common/UnsavedChangesGuard';

const KIND_TABS: ProductKind[] = [ProductKind.Keg, ProductKind.Bottle, ProductKind.Can, ProductKind.Multipack, ProductKind.Other];

let seq = 0;
const newKey = () => `ds-${++seq}`;

function QtyControl({ qty, onAdd, onChange }: { qty: number; onAdd: () => void; onChange: (delta: number) => void }) {
  if (qty <= 0) {
    return (
      <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={onAdd}
        sx={{ flexShrink: 0, color: 'text.primary', borderColor: 'divider', fontWeight: 700, bgcolor: 'background.paper' }}>
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

/** One brewery stop: its product catalog (search + kind filter), with a qty control per product.
 * The catalog arrives as a prop — the editor loads every stop's at once so the cart can price
 * lines from all of them (see useBreweryProductsMany). */
function StopCard({
  stop, index, total, color, breweryName, products, loading, onRemove, onMove, onItemsChange,
}: {
  stop: DraftStop;
  index: number;
  total: number;
  color?: string;
  breweryName: string;
  products: BreweryProductListItemDto[];
  loading: boolean;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onItemsChange: (items: DraftLine[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<ProductKind | 'all'>('all');
  const [collapsed, setCollapsed] = useState(false);

  const qtyOf = (productId: string) => stop.items.find((i) => i.source === 'product' && i.productId === productId)?.quantity ?? 0;
  const isThis = (i: DraftLine, productId: string) => i.source === 'product' && i.productId === productId;
  const addItem = (productId: string) => {
    const ex = stop.items.find((i) => isThis(i, productId));
    onItemsChange(ex
      ? stop.items.map((i) => (isThis(i, productId) ? { ...i, quantity: i.quantity + 1 } : i))
      : [...stop.items, { source: 'product', productId, quantity: 1 }]);
  };
  const changeQty = (productId: string, delta: number) => {
    onItemsChange(stop.items
      .map((i) => (isThis(i, productId) ? { ...i, quantity: i.quantity + delta } : i))
      .filter((i) => i.quantity > 0));
  };

  const matches = (p: BreweryProductListItemDto) => {
    const q = search.trim().toLowerCase();
    return !q || (p.name ?? '').toLowerCase().includes(q);
  };
  const kindCounts = useMemo(() => {
    const m = new Map<ProductKind, number>();
    for (const p of products) if (matches(p)) { const k = p.kind ?? ProductKind.Other; m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search]);
  const shown = products.filter((p) => matches(p) && (kind === 'all' || p.kind === kind));

  // Group same-name variants (different sizes) into one card, first-seen order.
  const groups = useMemo(() => {
    const order: string[] = [];
    const byName = new Map<string, BreweryProductListItemDto[]>();
    for (const p of shown) {
      const name = p.name ?? '';
      if (!byName.has(name)) { byName.set(name, []); order.push(name); }
      byName.get(name)!.push(p);
    }
    return order.map((name) => ({ name, items: byName.get(name)! }));
     
  }, [shown]);

  const itemCount = stop.items.length;
  const ks = stop.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={() => setCollapsed((v) => !v)}
        sx={{ px: 2, py: 1.5, borderBottom: collapsed ? 0 : 1, borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0, transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
        <Box sx={{ width: 26, height: 26, borderRadius: 1.5, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, bgcolor: `${color ?? '#7C3AED'}22`, color: color ?? '#7C3AED' }}>{index + 1}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0 }} noWrap>{breweryName}</Typography>
        <Chip size="small" label={`${itemCount} ${plural(itemCount, 'položka', 'položky', 'položek')} · ${ks} ks`} sx={{ fontWeight: 600 }} />
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMove(-1); }} disabled={index === 0} aria-label="Nahoru"><ArrowUpIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMove(1); }} disabled={index === total - 1} aria-label="Dolů"><ArrowDownIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }} sx={{ color: 'error.main' }} aria-label="Odebrat pivovar"><DeleteIcon fontSize="small" /></IconButton>
      </Stack>

      <Collapse in={!collapsed} unmountOnExit>
      <Box sx={{ p: 2 }}>
        <Box sx={{ mb: 1.5 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Hledat produkt v pivovaru…" width="100%" />
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : products.length === 0 ? (
          <EmptyState title="Pivovar nemá produkty" dense />
        ) : (
          <>
            <ToggleButtonGroup exclusive size="small" value={kind} onChange={(_e, v: ProductKind | 'all' | null) => v !== null && setKind(v)} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
              <ToggleButton value="all" sx={{ textTransform: 'none', fontWeight: 700 }}>Vše</ToggleButton>
              {KIND_TABS.filter((k) => (kindCounts.get(k) ?? 0) > 0).map((k) => (
                <ToggleButton key={k} value={k} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  {kindLabel(k)}<Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>{kindCounts.get(k)}</Box>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {groups.length === 0 ? (
              <EmptyState title="Nic nenalezeno" dense />
            ) : (
              <Stack spacing={1}>
                {groups.map((g) => (
                  <Box key={g.name} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                    {g.items.length > 1 && (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, bgcolor: 'action.hover' }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
                        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{g.name}</Typography>
                        <Box sx={{ flex: 1 }} />
                        <Chip size="small" label={`${g.items.length} ${plural(g.items.length, 'velikost', 'velikosti', 'velikostí')}`} sx={{ height: 20, fontSize: 11 }} />
                      </Stack>
                    )}
                    {g.items.map((v) => {
                      const qty = qtyOf(v.id ?? '');
                      return (
                        <Stack key={v.id} direction="row" spacing={1} alignItems="center"
                          sx={{ px: 1.5, py: 1, borderTop: g.items.length > 1 ? 1 : 0, borderColor: 'divider', bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent') }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            {g.items.length === 1 && <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{v.name}</Typography>}
                            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: g.items.length === 1 ? 0.5 : 0 }}>
                              <Chip size="small" label={kindLabel(v.kind)} sx={{ height: 20, fontSize: 11 }} />
                              {v.packageSize != null && <Chip size="small" label={fmtLiters(v.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />}
                            </Stack>
                          </Box>
                          <QtyControl qty={qty} onAdd={() => addItem(v.id ?? '')} onChange={(d) => changeQty(v.id ?? '', d)} />
                        </Stack>
                      );
                    })}
                  </Box>
                ))}
              </Stack>
            )}
          </>
        )}
      </Box>
      </Collapse>
    </Card>
  );
}

/** One supplier stop: its price list, with a qty control per charge kind.
 *
 * A good is listed once with a row per price rather than once per price, mirroring how the ceník
 * reads and how the brewery card above groups a product's sizes. There are no kind filter tabs —
 * a good has no ProductKind to filter by, only a free-text size — so search alone. */
function SupplierStopCard({
  stop, index, total, supplierName, supplier, loading, onRemove, onMove, onItemsChange,
}: {
  stop: DraftStop;
  index: number;
  total: number;
  supplierName: string;
  supplier: SupplierDto | undefined;
  loading: boolean;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onItemsChange: (items: DraftLine[]) => void;
}) {
  const { formatMoney } = useCurrency();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const goods = supplier?.goods ?? [];
  const q = search.trim().toLowerCase();
  const shown = goods.filter((g) => !q
    || (g.name ?? '').toLowerCase().includes(q)
    || (g.description ?? '').toLowerCase().includes(q));

  const isThis = (i: DraftLine, goodId: string, kind: SupplierChargeKind) =>
    i.source === 'good' && i.supplierGoodId === goodId && chargeKindName(i.chargeKind) === chargeKindName(kind);
  const qtyOf = (goodId: string, kind: SupplierChargeKind) =>
    stop.items.find((i) => isThis(i, goodId, kind))?.quantity ?? 0;
  const addItem = (goodId: string, kind: SupplierChargeKind) => {
    const ex = stop.items.find((i) => isThis(i, goodId, kind));
    onItemsChange(ex
      ? stop.items.map((i) => (isThis(i, goodId, kind) ? { ...i, quantity: i.quantity + 1 } : i))
      : [...stop.items, { source: 'good', supplierGoodId: goodId, chargeKind: kind, quantity: 1 }]);
  };
  const changeQty = (goodId: string, kind: SupplierChargeKind, delta: number) => {
    onItemsChange(stop.items
      .map((i) => (isThis(i, goodId, kind) ? { ...i, quantity: i.quantity + delta } : i))
      .filter((i) => i.quantity > 0));
  };

  const itemCount = stop.items.length;
  const ks = stop.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={() => setCollapsed((v) => !v)}
        sx={{ px: 2, py: 1.5, borderBottom: collapsed ? 0 : 1, borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0, transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
        <Box sx={{ width: 26, height: 26, borderRadius: 1.5, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, bgcolor: `${SUPPLIER_COLOR}22`, color: SUPPLIER_COLOR }}>{index + 1}</Box>
        <Stack sx={{ flex: 1, minWidth: 0 }} direction="row" alignItems="center" spacing={0.75}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, minWidth: 0 }} noWrap>{supplierName}</Typography>
          <Chip size="small" label="Dodavatel" sx={{ height: 20, fontSize: 11 }} />
        </Stack>
        <Chip size="small" label={`${itemCount} ${plural(itemCount, 'položka', 'položky', 'položek')} · ${ks} ks`} sx={{ fontWeight: 600 }} />
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMove(-1); }} disabled={index === 0} aria-label="Nahoru"><ArrowUpIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMove(1); }} disabled={index === total - 1} aria-label="Dolů"><ArrowDownIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }} sx={{ color: 'error.main' }} aria-label="Odebrat dodavatele"><DeleteIcon fontSize="small" /></IconButton>
      </Stack>

      <Collapse in={!collapsed} unmountOnExit>
        <Box sx={{ p: 2 }}>
          <Box sx={{ mb: 1.5 }}>
            <SearchField value={search} onChange={setSearch} placeholder="Hledat zboží u dodavatele…" width="100%" />
          </Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : goods.length === 0 ? (
            <EmptyState title="Dodavatel nemá zboží v ceníku" dense />
          ) : shown.length === 0 ? (
            <EmptyState title="Nic nenalezeno" dense />
          ) : (
            <Stack spacing={1}>
              {shown.map((g) => {
                const prices = g.prices ?? [];
                return (
                  <Box key={g.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, bgcolor: 'action.hover' }}>
                      <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: SUPPLIER_COLOR, flexShrink: 0 }} />
                      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{g.name}</Typography>
                      {g.size && <Chip size="small" label={g.size} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />}
                      <Box sx={{ flex: 1 }} />
                      {prices.length > 1 && (
                        <Chip size="small" label={`${prices.length} ${plural(prices.length, 'cena', 'ceny', 'cen')}`} sx={{ height: 20, fontSize: 11 }} />
                      )}
                    </Stack>
                    {prices.map((p) => {
                      const qty = qtyOf(g.id ?? '', p.kind!);
                      return (
                        <Stack
                          key={chargeKindName(p.kind)}
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent') }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Chip size="small" label={chargeKindLabel(p.kind)} sx={{ height: 20, fontSize: 11 }} />
                              <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{formatMoney(p.priceWithVat ?? 0)}</Typography>
                            </Stack>
                            {p.note && <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>{p.note}</Typography>}
                          </Box>
                          <QtyControl
                            qty={qty}
                            onAdd={() => addItem(g.id ?? '', p.kind!)}
                            onChange={(d) => changeQty(g.id ?? '', p.kind!, d)}
                          />
                        </Stack>
                      );
                    })}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Card>
  );
}

/** Dovoz editor: pick breweries, then products per brewery; date, vehicle,
 * drivers, and a live pickup-route preview. Mirrors the prototype's deHTML. */
export function DeliveryEditor({
  mode,
  deliveryId,
  onDone,
  onCancel,
}: {
  mode: 'create' | 'edit';
  deliveryId?: string;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { canSee } = useAuth();
  const canSeeSuppliers = canSee('suppliers');
  const deliveryQuery = useDelivery(mode === 'edit' ? deliveryId : undefined);
  const breweriesQuery = useBreweries();
  // Skipped entirely without the permission — the endpoint would refuse it, and a rejected query
  // behind a group the user cannot be shown is a retry loop with nothing to show for it.
  const suppliersQuery = useSuppliers({}, { enabled: canSeeSuppliers });
  const driversQuery = useDrivers();
  const vehiclesQuery = useVehicles();
  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();
  const startPoints = useShipmentStartPoints();

  const [deliveryDate, setDeliveryDate] = useState<Dayjs | null>(mode === 'create' ? dayjs().add(1, 'day') : null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [driverIds, setDriverIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [stops, setStops] = useState<DraftStop[]>([]);
  const [pickStop, setPickStop] = useState<string | null>(null);
  const [customStopOpen, setCustomStopOpen] = useState(false);
  const loadedRef = useRef(false);
  const baselineRef = useRef<string | null>(null);

  // Preserve the existing delivery's state across an edit save.
  const editState = deliveryQuery.data?.state;

  useEffect(() => {
    if (mode === 'create') baselineRef.current = serializeDelivery(deliveryDate, vehicleId, driverIds, note, stops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || loadedRef.current || !deliveryQuery.data) return;
    const d = deliveryQuery.data;
    loadedRef.current = true;
    const loadedDate = d.deliveryDate ? dayjs(d.deliveryDate) : null;
    const loadedVehicle = d.vehicle?.id ?? null;
    const loadedDrivers = (d.drivers ?? []).map((dr) => dr.id ?? '').filter(Boolean);
    const loadedNote = d.note ?? '';
    // Through deliveryStopKindName, not `=== DeliveryStopKind.Custom`: the API serializes enums as
    // strings while the generated enum is numeric, so the direct comparison never matched and a
    // custom waypoint came back as a brewery stop with no brewery.
    const loadedStops: DraftStop[] = (d.stops ?? []).map((s) => {
      const base = { key: newKey(), publicId: s.id, note: s.note ?? '' };
      switch (deliveryStopKindName(s.kind)) {
        case 'Custom':
          return {
            ...base,
            kind: 'custom' as const,
            breweryId: '',
            supplierId: '',
            items: [],
            label: s.label ?? '',
            lat: s.latitude ?? undefined,
            lng: s.longitude ?? undefined,
          };
        case 'Supplier':
          return {
            ...base,
            kind: 'supplier' as const,
            breweryId: '',
            supplierId: s.supplier?.id ?? '',
            items: (s.products ?? []).map((p): DraftLine => ({
              source: 'good',
              supplierGoodId: p.supplierGoodId ?? '',
              chargeKind: p.chargeKind!,
              quantity: p.quantity ?? 1,
              note: p.note ?? undefined,
            })),
          };
        default:
          return {
            ...base,
            kind: 'brewery' as const,
            breweryId: s.brewery?.id ?? '',
            supplierId: '',
            items: (s.products ?? []).map((p): DraftLine => ({
              source: 'product',
              productId: p.productId ?? '',
              quantity: p.quantity ?? 1,
              note: p.note ?? undefined,
            })),
          };
      }
    });
    setDeliveryDate(loadedDate);
    setVehicleId(loadedVehicle);
    setDriverIds(loadedDrivers);
    setNote(loadedNote);
    setStops(loadedStops);
    baselineRef.current = serializeDelivery(loadedDate, loadedVehicle, loadedDrivers, loadedNote, loadedStops);
  }, [mode, deliveryQuery.data]);

  const breweries = useMemo(() => breweriesQuery.data ?? [], [breweriesQuery.data]);
  const breweryById = useMemo(() => new Map(breweries.map((b) => [b.id ?? '', b])), [breweries]);
  const usedBreweryIds = useMemo(() => new Set(stops.filter((s) => s.kind === 'brewery').map((s) => s.breweryId)), [stops]);
  const suppliers = useMemo(() => suppliersQuery.data ?? [], [suppliersQuery.data]);
  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id ?? '', s.name ?? ''])), [suppliers]);
  const usedSupplierIds = useMemo(() => new Set(stops.filter((s) => s.kind === 'supplier').map((s) => s.supplierId)), [stops]);

  // Every stop's catalogue, loaded together: the stop cards browse them and the cart prices from
  // them, so one fetch per place serves both.
  const breweryProducts = useBreweryProductsMany(useMemo(() => [...usedBreweryIds].filter(Boolean), [usedBreweryIds]));
  const supplierDetails = useSuppliersMany(useMemo(() => [...usedSupplierIds].filter(Boolean), [usedSupplierIds]));

  const stopOptions = buildStopOptions({
    breweries,
    suppliers,
    usedBreweryIds,
    usedSupplierIds,
    canSeeSuppliers,
  });

  const addStop = (option: string) => {
    const picked = parseStopOption(option);
    if (!picked) return;
    if (picked.kind === 'brewery' && !usedBreweryIds.has(picked.id)) {
      setStops((prev) => [...prev, { key: newKey(), kind: 'brewery', breweryId: picked.id, supplierId: '', note: '', items: [] }]);
    } else if (picked.kind === 'supplier' && !usedSupplierIds.has(picked.id)) {
      setStops((prev) => [...prev, { key: newKey(), kind: 'supplier', breweryId: '', supplierId: picked.id, note: '', items: [] }]);
    }
    setPickStop(null);
  };
  const addCustomStop = (stop: CustomStopResult) => {
    // showCompanyOption={false} below hides the company toggle entirely, so
    // `stop` is always the custom variant in practice — narrowed here only to
    // satisfy CustomStopResult's type, not as a domain-specific guard.
    if (stop.kind !== 'custom') return;
    setStops((prev) => [...prev, { key: newKey(), kind: 'custom', breweryId: '', supplierId: '', note: stop.note ?? '', items: [], label: stop.label, lat: stop.lat, lng: stop.lng }]);
    setCustomStopOpen(false);
  };
  const removeStop = (key: string) => setStops((prev) => prev.filter((s) => s.key !== key));
  const moveStop = (key: string, dir: -1 | 1) => setStops((prev) => {
    const i = prev.findIndex((s) => s.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const setStopItems = (key: string, items: DraftLine[]) => setStops((prev) => prev.map((s) => (s.key === key ? { ...s, items } : s)));
  const toggleDriver = (id: string) => setDriverIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // The cart edits the owning stop's line rather than a copy, so it and the stop card stay two
  // views of one list. A quantity taken to zero removes the line, matching what the stop card's
  // own minus button does.
  const editCartLine = (row: CartRow, edit: (line: DraftLine) => DraftLine | null) => setStops((prev) => prev.map((s) => {
    if (s.key !== row.stopKey) return s;
    return {
      ...s,
      items: s.items.flatMap((i) => {
        if (!sameLine(i, row.line)) return [i];
        const next = edit(i);
        return next ? [next] : [];
      }),
    };
  }));

  const cartRows = buildCartRows(stops, {
    byBrewery: breweryProducts.byBrewery,
    bySupplier: supplierDetails.bySupplier,
    breweryColor: new Map(breweries.map((b) => [b.id ?? '', b.color])),
  });

  const routeStops: RouteStop[] = stops.map((s): RouteStop => {
    if (s.kind === 'custom') {
      return { lat: s.lat, lng: s.lng, label: s.label || 'Vlastní zastávka', color: CUSTOM_COLOR, kind: 'custom' };
    }
    if (s.kind === 'supplier') {
      const point = supplierRoutePoint(supplierDetails.bySupplier.get(s.supplierId));
      return {
        lat: point.lat,
        lng: point.lng,
        label: supplierNameById.get(s.supplierId) || 'Dodavatel',
        color: SUPPLIER_COLOR,
        kind: 'order',
      };
    }
    const b = breweryById.get(s.breweryId);
    return { lat: b?.latitude ?? undefined, lng: b?.longitude ?? undefined, label: b?.name ?? 'Pivovar', color: b?.color ?? '#7C3AED', kind: 'order' };
  });

  // Same reasoning as DeliveryDetail: a dovoz starts and ends at the company,
  // so both RouteMap endpoints are this one point. While that reference-data
  // query hasn't resolved, prefer a stop's own real coordinates (a brewery
  // already picked for this delivery) over a synthetic (0, 0) — only a
  // brand-new, stop-less delivery with the query still pending has nothing
  // real to fall back to; RouteMap is skipped entirely then (see the render
  // below) rather than draw a route anchored at null island.
  const company = (startPoints.data ?? []).find((p) => startPointKindName(p.kind) === 'Company');
  const firstLocatedStop = routeStops.find((s) => s.lat != null && s.lng != null);
  const companyPoint: RouteEndpoint | undefined = company
    ? { lat: company.latitude ?? 0, lng: company.longitude ?? 0, name: company.name ?? '—', address: company.address }
    : (firstLocatedStop ? { lat: firstLocatedStop.lat!, lng: firstLocatedStop.lng!, name: firstLocatedStop.label } : undefined);

  const busy = createDelivery.isPending || updateDelivery.isPending;

  const snapshot = serializeDelivery(deliveryDate, vehicleId, driverIds, note, stops);
  const dirty = baselineRef.current !== null && snapshot !== baselineRef.current;
  const { blocker, allowNext } = useUnsavedChangesGuard(dirty);

  // Persist only (no navigation); returns the saved id or null on failure.
  const persist = async (): Promise<string | null> => {
    if (stops.length === 0) { enqueueSnackbar('Přidejte alespoň jednu zastávku', { variant: 'warning' }); return null; }
    if (stops.some((s) => s.kind === 'brewery' && s.items.length === 0)) { enqueueSnackbar('Každý pivovar musí mít alespoň jeden produkt', { variant: 'warning' }); return null; }
    if (stops.some((s) => s.kind === 'supplier' && s.items.length === 0)) { enqueueSnackbar('Každý dodavatel musí mít alespoň jednu položku', { variant: 'warning' }); return null; }
    if (!deliveryDate) { enqueueSnackbar('Vyberte datum dovozu', { variant: 'warning' }); return null; }
    try {
      let savedId: string;
      if (mode === 'edit' && deliveryId) {
        await updateDelivery.mutateAsync({
          id: deliveryId,
          data: new UpdateProductDeliveryDto({
            deliveryDate: deliveryDate.toDate(),
            state: editState ?? ProductDeliveryState.InPlanning,
            driverIds,
            vehicleId: vehicleId ?? undefined,
            note: note.trim() || undefined,
            stops: stops.map((s) => new UpdateProductDeliveryStopDto({
              publicId: s.publicId,
              ...stopWireFields(s),
              products: s.items.map((it) => new UpdateProductDeliveryItemDto(lineWireFields(it))),
            })),
          }),
        });
        savedId = deliveryId;
        enqueueSnackbar('Dovoz uložen.', { variant: 'success' });
      } else {
        savedId = await createDelivery.mutateAsync(new CreateProductsDeliveryDto({
          deliveryDate: deliveryDate.toDate(),
          driverIds,
          vehicleId: vehicleId ?? undefined,
          note: note.trim() || undefined,
          stops: stops.map((s) => new CreateProductDeliveryStopDto({
            ...stopWireFields(s),
            products: s.items.map((it) => new CreateProductDeliveryItemDto(lineWireFields(it))),
          })),
        }));
        enqueueSnackbar('Dovoz vytvořen.', { variant: 'success' });
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

  const title = mode === 'edit' ? `Úprava dovozu ${deliveryNumber(deliveryId)}` : 'Nový dovoz';

  return (
    <Box>
      {/* Back runs the same onCancel the Zrušit button does, so the router-level
          unsaved-changes guard still intercepts a dirty editor. */}
      <DetailHeader
        onBack={onCancel}
        backLabel="Zpět na dovozy zboží"
        title={title}
        meta={[canSeeSuppliers
          ? 'Vyberte pivovary, dodavatele a zboží k dovezení. V jednom dovozu lze objet více míst.'
          : 'Vyberte pivovary a produkty k naskladnění. V jednom dovozu lze objet více pivovarů.']}
        actions={(
          <>
            <Button onClick={onCancel} color="inherit" disabled={busy}>Zrušit</Button>
            <Button variant="contained" startIcon={<CheckIcon />} onClick={handleSave} disabled={busy}>
              {busy ? 'Ukládám…' : mode === 'edit' ? 'Uložit' : 'Vytvořit dovoz'}
            </Button>
          </>
        )}
      />

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, alignItems: 'start' }}>
        <Stack spacing={2}>
          {stops.length > 0 && (
            <Card sx={{ overflow: 'hidden' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <RouteOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Plánovaná trasa svozu</Typography>
                <Box sx={{ flex: 1 }} />
                <Chip size="small" label="sklad → pivovary → sklad" />
              </Stack>
              <Box sx={{ p: 2 }}>
                {companyPoint ? (
                  <RouteMap stops={routeStops} start={companyPoint} end={companyPoint} height={280} />
                ) : (
                  <Box
                    sx={{
                      height: 280, borderRadius: 2, border: '1px dashed', borderColor: 'divider',
                      bgcolor: 'action.hover', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'text.disabled',
                    }}
                  >
                    <Typography color="text.secondary">Trasa se zobrazí, jakmile se načte výchozí bod.</Typography>
                  </Box>
                )}
              </Box>
            </Card>
          )}

          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.disabled' }}>
              Zastávky v dovozu ({stops.length})
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" startIcon={<PlaceOutlinedIcon fontSize="small" />} onClick={() => setCustomStopOpen(true)}
              sx={{ color: 'text.primary', borderColor: 'divider', fontWeight: 700 }}>
              Vlastní zastávka
            </Button>
          </Stack>

          {stopOptions.length > 0 ? (
            <Combobox
              value={pickStop}
              onChange={(v) => v && addStop(v)}
              options={stopOptions}
              placeholder={canSeeSuppliers
                ? 'Přidat pivovar nebo dodavatele — začněte psát název…'
                : 'Přidat pivovar — začněte psát název…'}
              fullWidth
            />
          ) : (
            <Typography color="text.disabled" sx={{ fontSize: 13 }}>
              {canSeeSuppliers ? 'Všechny pivovary a dodavatelé už jsou v dovozu.' : 'Všechny pivovary už jsou v dovozu.'}
            </Typography>
          )}

          {stops.length === 0 ? (
            <EmptyState icon={<WarehouseOutlinedIcon />} title="Zatím žádná zastávka" description="Přidejte pivovar nebo dodavatele polem nahoře, nebo vlastní zastávku tlačítkem." dense />
          ) : (
            stops.map((s, i) => {
              if (s.kind === 'custom') {
                return (
                  <CustomStopCard
                    key={s.key}
                    stop={s}
                    index={i}
                    total={stops.length}
                    onRemove={() => removeStop(s.key)}
                    onMove={(dir) => moveStop(s.key, dir)}
                  />
                );
              }
              if (s.kind === 'supplier') {
                return (
                  <SupplierStopCard
                    key={s.key}
                    stop={s}
                    index={i}
                    total={stops.length}
                    supplierName={supplierNameById.get(s.supplierId) || '—'}
                    supplier={supplierDetails.bySupplier.get(s.supplierId)}
                    loading={supplierDetails.loading.has(s.supplierId)}
                    onRemove={() => removeStop(s.key)}
                    onMove={(dir) => moveStop(s.key, dir)}
                    onItemsChange={(items) => setStopItems(s.key, items)}
                  />
                );
              }
              return (
                <StopCard
                  key={s.key}
                  stop={s}
                  index={i}
                  total={stops.length}
                  color={breweryById.get(s.breweryId)?.color}
                  breweryName={breweryById.get(s.breweryId)?.name ?? '—'}
                  products={breweryProducts.byBrewery.get(s.breweryId) ?? []}
                  loading={breweryProducts.loading.has(s.breweryId)}
                  onRemove={() => removeStop(s.key)}
                  onMove={(dir) => moveStop(s.key, dir)}
                  onItemsChange={(items) => setStopItems(s.key, items)}
                />
              );
            })
          )}
        </Stack>

        {/* Deliberately NOT position: sticky, for the reason OrderEditor's right column records:
            this column now stacks the date/vehicle card, the drivers card and the cart, and on a
            dovoz with a few stops that runs taller than the viewport. A sticky element taller than
            the screen pins in place and its bottom becomes unreachable — the cart's total and its
            last lines would render and never be scrollable to. */}
        <Stack spacing={2}>
          <Card sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <DatePicker
                label="Datum dovozu"
                value={deliveryDate}
                onChange={setDeliveryDate}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
              <Combobox
                label="Vůz"
                value={vehicleId}
                onChange={setVehicleId}
                options={(vehiclesQuery.data ?? []).map((v) => ({ value: v.id ?? '', label: v.name ?? '' }))}
                placeholder="— vyberte vůz —"
              />
              <TextField
                label="Poznámka"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Např. vrátit prázdné sudy…"
                size="small"
                fullWidth
                multiline
                minRows={2}
              />
            </Stack>
          </Card>

          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Řidiči</Typography>
            </Stack>
            <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(driversQuery.data ?? []).length === 0 ? (
                <Typography color="text.disabled" sx={{ fontSize: 13 }}>Žádní řidiči</Typography>
              ) : (
                (driversQuery.data ?? []).map((dr) => {
                  const on = driverIds.includes(dr.id ?? '');
                  const color = dr.color ?? '#7C3AED';
                  return (
                    <Chip
                      key={dr.id}
                      clickable
                      onClick={() => toggleDriver(dr.id ?? '')}
                      icon={on ? <CheckIcon sx={{ fontSize: 15 }} /> : undefined}
                      label={`${dr.firstName ?? ''} ${dr.lastName ?? ''}`.trim()}
                      variant={on ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: 600, height: 34,
                        borderColor: on ? color : 'divider',
                        bgcolor: on ? `${color}22` : 'transparent',
                        '& .MuiChip-icon': { color },
                      }}
                    />
                  );
                })
              )}
            </Box>
          </Card>

          <DeliveryCart
            rows={cartRows}
            onChangeQuantity={(row, delta) => editCartLine(row, (line) => (
              line.quantity + delta > 0 ? { ...line, quantity: line.quantity + delta } : null
            ))}
            onChangeNote={(row, note) => editCartLine(row, (line) => ({ ...line, note }))}
            onRemove={(row) => editCartLine(row, () => null)}
          />
        </Stack>
      </Box>

      {/* Deliveries have no company-stop concept of their own (a delivery already
          always ends at the company) — showCompanyOption={false} hides that toggle
          entirely, leaving this dialog exactly as it was before that option existed,
          rather than disabling it with a tooltip that would be untrue here. */}
      <CustomStopDialog open={customStopOpen} onClose={() => setCustomStopOpen(false)} onAdd={addCustomStop} showCompanyOption={false} />

      <UnsavedChangesDialog blocker={blocker} onSave={() => persist().then((id) => id != null)} busy={busy} />
    </Box>
  );
}

/** A custom (non-brewery) route stop: label + coordinates, no product catalog. */
function CustomStopCard({
  stop, index, total, onRemove, onMove,
}: {
  stop: DraftStop;
  index: number;
  total: number;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const CUSTOM_COLOR = '#1A2B4C';
  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ width: 26, height: 26, borderRadius: 1.5, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, bgcolor: `${CUSTOM_COLOR}22`, color: CUSTOM_COLOR }}>{index + 1}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>{stop.label || 'Vlastní zastávka'}</Typography>
            <Chip size="small" icon={<PlaceOutlinedIcon sx={{ fontSize: 13 }} />} label="Vlastní" sx={{ height: 20, fontSize: 11 }} />
          </Stack>
          {stop.note && <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{stop.note}</Typography>}
          {stop.lat != null && stop.lng != null && (
            <Typography sx={{ fontSize: 11, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</Typography>
          )}
        </Box>
        <IconButton size="small" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Nahoru"><ArrowUpIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Dolů"><ArrowDownIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={onRemove} sx={{ color: 'error.main' }} aria-label="Odebrat zastávku"><DeleteIcon fontSize="small" /></IconButton>
      </Stack>
    </Card>
  );
}
