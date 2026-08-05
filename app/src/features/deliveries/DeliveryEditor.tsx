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
import { kindLabel, startPointKindName } from 'src/lib/labels';
import {
  ProductKind,
  CreateProductsDeliveryDto,
  CreateProductDeliveryStopDto,
  CreateProductDeliveryItemDto,
  UpdateProductDeliveryDto,
  UpdateProductDeliveryStopDto,
  UpdateProductDeliveryItemDto,
  ProductDeliveryState,
  DeliveryStopKind,
  type BreweryProductListItemDto,
} from 'src/generated/api-client';
import { CustomStopDialog } from 'src/components/common/CustomStopDialog';
import { useBreweries } from 'src/hooks/useBreweries';
import { useBreweryProducts } from 'src/hooks/useBreweryProducts';
import { useDrivers } from 'src/hooks/useDrivers';
import { useVehicles } from 'src/hooks/useVehicles';
import { useDelivery, useCreateDelivery, useUpdateDelivery } from 'src/hooks/useDeliveries';
import { useShipmentStartPoints } from 'src/hooks/useShipments';
import { useUnsavedChangesGuard, UnsavedChangesDialog } from 'src/components/common/UnsavedChangesGuard';
import { TOPBAR_H } from 'src/layout/Topbar';

const KIND_TABS: ProductKind[] = [ProductKind.Keg, ProductKind.Bottle, ProductKind.Can, ProductKind.Multipack, ProductKind.Other];

interface DraftItem { productId: string; quantity: number }
/** A route stop: either a brewery (with its own product list) or a custom
 * free-form waypoint (label + coordinates, no products). */
interface DraftStop {
  key: string;
  publicId?: string;
  kind: 'brewery' | 'custom';
  breweryId: string; // '' for custom stops
  note: string;
  items: DraftItem[]; // [] for custom stops
  label?: string; // custom stops only
  lat?: number; // custom stops only
  lng?: number; // custom stops only
}

/** Serialized snapshot of the savable state, for unsaved-change detection. */
function serializeDelivery(date: Dayjs | null, vehicleId: string | null, driverIds: string[], note: string, stops: DraftStop[]): string {
  return JSON.stringify({
    date: date ? date.toISOString() : null,
    vehicleId,
    driverIds: [...driverIds].sort(),
    note: note.trim(),
    stops: stops.map((s) => ({ kind: s.kind, breweryId: s.breweryId, note: s.note.trim(), items: s.items, label: s.label, lat: s.lat, lng: s.lng })),
  });
}

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

/** One brewery stop: its own product catalog (search + kind filter), with a
 * qty control per product. Loads the brewery's product list on its own. */
function StopCard({
  stop, index, total, color, breweryName, onRemove, onMove, onItemsChange,
}: {
  stop: DraftStop;
  index: number;
  total: number;
  color?: string;
  breweryName: string;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onItemsChange: (items: DraftItem[]) => void;
}) {
  const productsQuery = useBreweryProducts(stop.breweryId);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<ProductKind | 'all'>('all');
  const [collapsed, setCollapsed] = useState(false);

  const qtyOf = (productId: string) => stop.items.find((i) => i.productId === productId)?.quantity ?? 0;
  const addItem = (productId: string) => {
    const ex = stop.items.find((i) => i.productId === productId);
    onItemsChange(ex ? stop.items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i)) : [...stop.items, { productId, quantity: 1 }]);
  };
  const changeQty = (productId: string, delta: number) => {
    onItemsChange(stop.items
      .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
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
        {productsQuery.isLoading ? (
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
  const deliveryQuery = useDelivery(mode === 'edit' ? deliveryId : undefined);
  const breweriesQuery = useBreweries();
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
  const [pickBrewery, setPickBrewery] = useState<string | null>(null);
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
    const loadedStops: DraftStop[] = (d.stops ?? []).map((s) => s.kind === DeliveryStopKind.Custom
      ? {
          key: newKey(),
          publicId: s.id,
          kind: 'custom' as const,
          breweryId: '',
          note: s.note ?? '',
          items: [],
          label: s.label ?? '',
          lat: s.latitude ?? undefined,
          lng: s.longitude ?? undefined,
        }
      : {
          key: newKey(),
          publicId: s.id,
          kind: 'brewery' as const,
          breweryId: s.brewery?.id ?? '',
          note: s.note ?? '',
          items: (s.products ?? []).map((p) => ({ productId: p.productId ?? '', quantity: p.quantity ?? 1 })),
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
  const breweryOptions = breweries
    .filter((b) => !usedBreweryIds.has(b.id ?? ''))
    .map((b) => ({ value: b.id ?? '', label: b.name ?? '' }));

  const addStop = (breweryId: string) => {
    if (!breweryId || usedBreweryIds.has(breweryId)) return;
    setStops((prev) => [...prev, { key: newKey(), kind: 'brewery', breweryId, note: '', items: [] }]);
    setPickBrewery(null);
  };
  const addCustomStop = (stop: { label: string; note?: string; lat: number; lng: number }) => {
    setStops((prev) => [...prev, { key: newKey(), kind: 'custom', breweryId: '', note: stop.note ?? '', items: [], label: stop.label, lat: stop.lat, lng: stop.lng }]);
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
  const setStopItems = (key: string, items: DraftItem[]) => setStops((prev) => prev.map((s) => (s.key === key ? { ...s, items } : s)));
  const toggleDriver = (id: string) => setDriverIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const routeStops: RouteStop[] = useMemo(() => stops.map((s): RouteStop => {
    if (s.kind === 'custom') {
      return { lat: s.lat, lng: s.lng, label: s.label || 'Vlastní zastávka', color: '#1A2B4C', kind: 'custom' };
    }
    const b = breweryById.get(s.breweryId);
    return { lat: b?.latitude ?? undefined, lng: b?.longitude ?? undefined, label: b?.name ?? 'Pivovar', color: b?.color ?? '#7C3AED', kind: 'order' };
  }), [stops, breweryById]);

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
              kind: s.kind === 'custom' ? DeliveryStopKind.Custom : DeliveryStopKind.Brewery,
              breweryId: s.kind === 'custom' ? undefined : s.breweryId,
              label: s.kind === 'custom' ? s.label : undefined,
              latitude: s.kind === 'custom' ? s.lat : undefined,
              longitude: s.kind === 'custom' ? s.lng : undefined,
              note: s.note.trim() || undefined,
              products: s.kind === 'custom' ? [] : s.items.map((it) => new UpdateProductDeliveryItemDto({ productId: it.productId, quantity: it.quantity })),
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
            kind: s.kind === 'custom' ? DeliveryStopKind.Custom : DeliveryStopKind.Brewery,
            breweryId: s.kind === 'custom' ? undefined : s.breweryId,
            label: s.kind === 'custom' ? s.label : undefined,
            latitude: s.kind === 'custom' ? s.lat : undefined,
            longitude: s.kind === 'custom' ? s.lng : undefined,
            note: s.note.trim() || undefined,
            products: s.kind === 'custom' ? [] : s.items.map((it) => new CreateProductDeliveryItemDto({ productId: it.productId, quantity: it.quantity })),
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
        meta={['Vyberte pivovary a produkty k naskladnění. V jednom dovozu lze objet více pivovarů.']}
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

          {breweryOptions.length > 0 ? (
            <Combobox
              value={pickBrewery}
              onChange={(v) => v && addStop(v)}
              options={breweryOptions}
              placeholder="Přidat pivovar — začněte psát název…"
              fullWidth
            />
          ) : (
            <Typography color="text.disabled" sx={{ fontSize: 13 }}>Všechny pivovary už jsou v dovozu.</Typography>
          )}

          {stops.length === 0 ? (
            <EmptyState icon={<WarehouseOutlinedIcon />} title="Zatím žádná zastávka" description="Přidejte pivovar polem nahoře, nebo vlastní zastávku tlačítkem." dense />
          ) : (
            stops.map((s, i) => (
              s.kind === 'custom' ? (
                <CustomStopCard
                  key={s.key}
                  stop={s}
                  index={i}
                  total={stops.length}
                  onRemove={() => removeStop(s.key)}
                  onMove={(dir) => moveStop(s.key, dir)}
                />
              ) : (
                <StopCard
                  key={s.key}
                  stop={s}
                  index={i}
                  total={stops.length}
                  color={breweryById.get(s.breweryId)?.color}
                  breweryName={breweryById.get(s.breweryId)?.name ?? '—'}
                  onRemove={() => removeStop(s.key)}
                  onMove={(dir) => moveStop(s.key, dir)}
                  onItemsChange={(items) => setStopItems(s.key, items)}
                />
              )
            ))
          )}
        </Stack>

        <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: TOPBAR_H + 16 } }}>
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
        </Stack>
      </Box>

      <CustomStopDialog open={customStopOpen} onClose={() => setCustomStopOpen(false)} onAdd={addCustomStop} />

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
