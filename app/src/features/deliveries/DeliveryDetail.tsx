import { useMemo, useState, type ReactNode } from 'react';
import {
  Box, Breadcrumbs, Button, ButtonBase, Card, Chip, Collapse, Link, Stack, Typography,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNextOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import { useSnackbar } from 'notistack';
import { RouteMap, type RouteStop } from 'src/components/common/RouteMap';
import { StatusPill } from 'src/components/common/StatusPill';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, deliveryNumber, plural } from 'src/lib/format';
import { DELIVERY_STATUS, deliveryStateName } from 'src/lib/labels';
import {
  ProductDeliveryState,
  UpdateProductDeliveryDto,
  UpdateProductDeliveryStopDto,
  UpdateProductDeliveryItemDto,
  type ProductDeliveryDto,
  type ProductDeliveryStopDto,
} from 'src/generated/api-client';
import { useBreweries } from 'src/hooks/useBreweries';
import { useUpdateDelivery } from 'src/hooks/useDeliveries';

const DRIVER_COLORS = ['#F08C00', '#0E7C9B', '#7C3AED', '#15873F', '#C22A2A', '#B4620A', '#0891B2', '#DB2777'];
function colorFor(str: string): string {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 997;
  return DRIVER_COLORS[h % DRIVER_COLORS.length];
}

/** Build the write DTO from the current delivery, changing only the state —
 * used for the InPlanning→OnTheWay→Finished transitions (Update-driven; the
 * backend stocks inventory when the new state is Finished). */
function toUpdateDto(d: ProductDeliveryDto, nextState: ProductDeliveryState): UpdateProductDeliveryDto {
  return new UpdateProductDeliveryDto({
    deliveryDate: d.deliveryDate!,
    state: nextState,
    driverIds: (d.drivers ?? []).map((dr) => dr.id ?? '').filter(Boolean),
    vehicleId: d.vehicle?.id,
    note: d.note,
    stops: (d.stops ?? []).map((s) => new UpdateProductDeliveryStopDto({
      publicId: s.id,
      breweryId: s.brewery?.id,
      note: s.note,
      products: (s.products ?? []).map((p) => new UpdateProductDeliveryItemDto({
        productId: p.productId, quantity: p.quantity, note: p.note,
      })),
    })),
  });
}

/** One expandable brewery in the stops overview: collapsed header (brewery
 * avatar + name + item count) that reveals its product list on click. */
function StopRow({ stop, index, color, open, onToggle }: {
  stop: ProductDeliveryStopDto;
  index: number;
  color: string;
  open: boolean;
  onToggle: () => void;
}) {
  const products = stop.products ?? [];
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 'none' } }}>
      <ButtonBase
        onClick={onToggle}
        sx={{ width: '100%', px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25, textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, bgcolor: color }}>{index + 1}</Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{stop.brewery?.name ?? '—'}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
            {products.length} {plural(products.length, 'položka', 'položky', 'položek')}
          </Typography>
        </Box>
        <ExpandMoreIcon sx={{ color: 'text.secondary', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pb: 0.75 }}>
          {products.length > 0
            ? products.map((p, i) => (
              <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75, px: 2.5, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 12.5 }} noWrap>{p.name}</Typography>
                  {p.note && <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>{p.note}</Typography>}
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{p.quantity} ks</Typography>
              </Stack>
            ))
            : <Typography color="text.secondary" sx={{ fontSize: 12, px: 2.5, py: 1 }}>Žádné položky.</Typography>}
        </Box>
      </Collapse>
    </Box>
  );
}

/** Dovoz detail: route map, state-advance header (Vyrazit → Dokončit/naskladnit),
 * an aggregated "what's arriving" list, plus the vehicle/drivers card with a
 * collapsible per-brewery overview below it — mirrors the Vývoz detail layout. */
export function DeliveryDetail({
  delivery,
  editable,
  onBack,
  onEdit,
}: {
  delivery: ProductDeliveryDto;
  editable: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const updateDelivery = useUpdateDelivery();
  const breweriesQuery = useBreweries();
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const breweryById = useMemo(() => {
    const m = new Map<string, { lat?: number; lng?: number; color?: string }>();
    for (const b of breweriesQuery.data ?? []) {
      if (b.id) m.set(b.id, { lat: b.latitude ?? undefined, lng: b.longitude ?? undefined, color: b.color });
    }
    return m;
  }, [breweriesQuery.data]);

  const stops = useMemo(() => delivery.stops ?? [], [delivery.stops]);
  const routeStops: RouteStop[] = useMemo(() => stops.map((s): RouteStop => {
    const b = s.brewery?.id ? breweryById.get(s.brewery.id) : undefined;
    return { lat: b?.lat, lng: b?.lng, label: s.brewery?.name ?? 'Pivovar', color: b?.color ?? '#7C3AED', kind: 'order' };
  }), [stops, breweryById]);

  // Aggregated arriving goods: sum quantity per product across all breweries.
  const aggProducts = useMemo(() => {
    const m = new Map<string, { name: string; quantity: number }>();
    stops.forEach((s) => (s.products ?? []).forEach((p) => {
      const key = p.productId ?? p.name ?? '';
      const ex = m.get(key);
      if (ex) ex.quantity += p.quantity ?? 0;
      else m.set(key, { name: p.name ?? '—', quantity: p.quantity ?? 0 });
    }));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, [stops]);
  const totalQty = aggProducts.reduce((s, p) => s + p.quantity, 0);

  const stateName = deliveryStateName(delivery.state);
  const status = DELIVERY_STATUS[stateName ?? 'InPlanning'] ?? DELIVERY_STATUS.InPlanning;
  const done = stateName === 'Finished';
  const cancelled = stateName === 'Cancelled';

  const D = ProductDeliveryState;
  const forward = ({
    InPlanning: { to: D.OnTheWay, label: 'Vyrazit', icon: <LocalShippingOutlinedIcon />, primary: false, confirm: false },
    OnTheWay: { to: D.Finished, label: 'Dokončit → naskladnit', icon: <Inventory2OutlinedIcon />, primary: true, confirm: true },
  } as Record<string, { to: ProductDeliveryState; label: string; icon: ReactNode; primary: boolean; confirm: boolean }>)[stateName ?? ''];
  const ghostBtnSx = { color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } } as const;

  const toggle = (key: string) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  async function advance(next: ProductDeliveryState) {
    try {
      await updateDelivery.mutateAsync({ id: delivery.id ?? '', data: toUpdateDto(delivery, next) });
      enqueueSnackbar(next === ProductDeliveryState.Finished ? 'Dovoz naskladněn na sklad.' : 'Stav dovozu aktualizován.', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  }

  const num = deliveryNumber(delivery.id);

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 16 }} />} sx={{ mb: 1.5, fontSize: 13 }}>
        <Link component="button" type="button" underline="hover" color="text.secondary" onClick={onBack} sx={{ fontSize: 13 }}>
          Dovozy zboží
        </Link>
        <Typography color="text.primary" sx={{ fontSize: 13 }}>{num}</Typography>
      </Breadcrumbs>

      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'primary.dark', mb: 0.6 }}>
            Dovoz z pivovarů
          </Typography>
          <Typography variant="h1" sx={{ fontSize: 26 }}>{num}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 14 }}>
            {delivery.deliveryDate ? fmtDate(delivery.deliveryDate) : 'termín neurčen'} · {stops.length} {plural(stops.length, 'pivovar', 'pivovary', 'pivovarů')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusPill tone={status.tone} label={status.label} />
          {editable && forward && (
            <Button
              variant={forward.primary ? 'contained' : 'outlined'}
              startIcon={forward.icon}
              onClick={() => (forward.confirm ? setConfirmFinish(true) : advance(forward.to))}
              sx={forward.primary ? undefined : ghostBtnSx}
            >
              {forward.label}
            </Button>
          )}
          {editable && !done && !cancelled && (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={onEdit} sx={ghostBtnSx}>
              Upravit
            </Button>
          )}
        </Stack>
      </Stack>

      {done && (
        <Card sx={{ mb: 2, bgcolor: (t) => t.vars!.palette.success.main, color: '#fff', border: 'none' }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.75 }}>
            <CheckCircleOutlinedIcon />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }}>Naskladněno</Typography>
              <Typography sx={{ fontSize: 13, opacity: 0.9 }}>{totalQty} kusů bylo propsáno na sklad.</Typography>
            </Box>
          </Stack>
        </Card>
      )}

      <RouteMap stops={routeStops} height={340} />

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, alignItems: 'start', mt: 2.5 }}>
        {/* LEFT: aggregated "what's arriving" list. */}
        <Card sx={{ overflow: 'hidden' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
            <Inventory2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Celkový dovoz</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.disabled' }}>{totalQty} ks</Typography>
          </Stack>
          {aggProducts.length > 0 ? (
            <Box>
              {aggProducts.map((p, i) => (
                <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.1, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 'none' } }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0 }} noWrap>{p.name}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{p.quantity} ks</Typography>
                </Stack>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ fontSize: 13, px: 2.5, py: 2 }}>Žádné položky.</Typography>
          )}
        </Card>

        {/* RIGHT: vehicle + drivers, then the collapsible per-brewery overview below. */}
        <Stack spacing={2}>
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <DirectionsCarFilledOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Vůz a řidiči</Typography>
            </Stack>
            <Stack spacing={1.5} sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 600 }}>Vůz</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{delivery.vehicle?.name ?? '—'}</Typography>
              </Stack>
              <Box>
                <Typography sx={{ fontSize: 11.5, color: 'text.disabled', fontWeight: 700, mb: 0.75 }}>ŘIDIČI</Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {(delivery.drivers ?? []).length === 0
                    ? <Typography color="text.disabled" sx={{ fontSize: 13 }}>—</Typography>
                    : (delivery.drivers ?? []).map((dr) => {
                      const name = `${dr.firstName ?? ''} ${dr.lastName ?? ''}`.trim();
                      const color = colorFor(dr.id ?? name);
                      return (
                        <Chip
                          key={dr.id}
                          size="small"
                          icon={<Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, ml: 1 }} />}
                          label={name || '—'}
                          sx={{ fontWeight: 600 }}
                        />
                      );
                    })}
                </Stack>
              </Box>
            </Stack>
          </Card>

          {/* Collapsible per-brewery overview — the "cart card below drivers". */}
          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <WarehouseOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Přehled zastávek</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.disabled' }}>
                {stops.length} {plural(stops.length, 'pivovar', 'pivovary', 'pivovarů')}
              </Typography>
            </Stack>
            {stops.length > 0 ? (
              <Box>
                {stops.map((s, i) => (
                  <StopRow
                    key={s.id ?? i}
                    stop={s}
                    index={i}
                    color={(s.brewery?.id ? breweryById.get(s.brewery.id)?.color : undefined) ?? '#7C3AED'}
                    open={expanded.has(s.id ?? `stop-${i}`)}
                    onToggle={() => toggle(s.id ?? `stop-${i}`)}
                  />
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ fontSize: 13, px: 2.5, py: 2 }}>Žádné zastávky.</Typography>
            )}
          </Card>

          {delivery.note && (
            <Card sx={{ overflow: 'hidden' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Poznámka</Typography>
              </Stack>
              <Typography sx={{ px: 2.5, py: 2, fontSize: 13.5, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{delivery.note}</Typography>
            </Card>
          )}
        </Stack>
      </Box>

      <ConfirmDialog
        open={confirmFinish}
        title="Dokončit a naskladnit dovoz?"
        message={`Po dokončení se ${totalQty} kusů připíše na firemní sklad. Tuto akci nelze vrátit.`}
        confirmLabel="Dokončit a naskladnit"
        busy={updateDelivery.isPending}
        onConfirm={async () => { await advance(ProductDeliveryState.Finished); setConfirmFinish(false); }}
        onClose={() => setConfirmFinish(false)}
      />
    </Box>
  );
}
