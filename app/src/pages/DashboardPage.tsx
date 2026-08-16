import { Fragment, useMemo, type ReactNode } from 'react';
import { Box, Button, Card, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import dayjs, { type Dayjs } from 'dayjs';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { StatCard } from 'src/components/common/StatCard';
import { StatusPill } from 'src/components/common/StatusPill';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { useAuth } from 'src/auth/AuthProvider';
import { useModuleCounts, useUpcomingReminders } from 'src/hooks/useReports';
import { useDrivers } from 'src/hooks/useDrivers';
import { useShipments } from 'src/hooks/useShipments';
import { useDeliveries } from 'src/hooks/useDeliveries';
import { useInventory } from 'src/hooks/useInventory';
import { NAV_GROUPS, navPermModule } from 'src/layout/nav-config';
import { PATHS } from 'src/routes/paths';
import { num, fmtDateShort, plural } from 'src/lib/format';
import { SHIP_STATUS, shipStateName, DELIVERY_STATUS, deliveryStateName, type StatusTone } from 'src/lib/labels';
import { SectionType, type DriverListItemDto } from 'src/generated/api-client';

const MONTHS_CS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const LOW_STOCK_THRESHOLD = 3;

/** A dated schedule row (shipment or delivery) on the "Tento týden" card. */
function ScheduleRow({ date, icon, title, meta, href, tone, label }: {
  date: Date; icon: ReactNode; title: string; meta: string; href: string; tone: StatusTone; label: string;
}) {
  const d = dayjs(date);
  const isToday = d.isSame(dayjs(), 'day');
  return (
    <Box component={RouterLink} to={href} sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 2,
      bgcolor: 'background.default', textDecoration: 'none', color: 'inherit', '&:hover': { borderColor: 'text.disabled' },
    }}>
      <Box sx={{ textAlign: 'center', minWidth: 40, flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{d.date()}.</Typography>
        <Typography sx={{ fontSize: 10.5, textTransform: 'uppercase', color: 'text.secondary' }}>{MONTHS_CS[d.month()]}</Typography>
      </Box>
      <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', color: 'text.secondary', flexShrink: 0, '& svg': { fontSize: 18 } }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>
          {title}{isToday && <Box component="span" sx={{ ml: 0.75, fontSize: 11, color: 'warning.dark', fontWeight: 700 }}>dnes</Box>}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{meta}</Typography>
      </Box>
      <StatusPill tone={tone} label={label} />
    </Box>
  );
}

function DashCard({ icon, iconColor, title, action, children }: {
  icon: ReactNode; iconColor: string; title: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ color: iconColor, display: 'grid', placeItems: 'center', '& svg': { fontSize: 20 } }}>{icon}</Box>
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {action}
      </Stack>
      {children}
    </Card>
  );
}

// The count fields of the reports DTO (spelled out rather than derived via
// `keyof NumberOfRecordsInEachModuleDto`, which would also pull in class
// methods like `init`/`toJSON`).
type ModuleCountField =
  | 'clientsCount'
  | 'ordersCount'
  | 'breweriesCount'
  | 'inventoryItemsCount'
  | 'driversCount'
  | 'vehiclesCount'
  | 'usersCount'
  | 'outgoingShipmentsCount'
  | 'productDeliveriesCount'
  | 'salesCount';

// Which count field on the reports DTO backs each module's KPI tile, and the
// tile's tone. Tones are varied for visual rhythm, not semantic meaning.
// Keyed by nav key rather than by ModuleKey: a nav item may gate on a module it does not name.
const TILE_CONFIG: Partial<Record<string, { field: ModuleCountField; tone: StatusTone }>> = {
  orders: { field: 'ordersCount', tone: 'amber' },
  shipments: { field: 'outgoingShipmentsCount', tone: 'amber' },
  deliveries: { field: 'productDeliveriesCount', tone: 'info' },
  inventory: { field: 'inventoryItemsCount', tone: 'info' },
  // Like the sidebar badge, this counts sales still open — the endpoint excludes completed
  // ones, so a quiet counter reads 0 rather than every sale ever rung up.
  sales: { field: 'salesCount', tone: 'ok' },
  breweries: { field: 'breweriesCount', tone: 'ok' },
  clients: { field: 'clientsCount', tone: 'ok' },
  drivers: { field: 'driversCount', tone: 'grey' },
  vehicles: { field: 'vehiclesCount', tone: 'grey' },
  users: { field: 'usersCount', tone: 'grey' },
};

const WEEKDAY_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

const fullName = (d: DriverListItemDto) => [d.firstName, d.lastName].filter(Boolean).join(' ');

/** Hour label for an availability edge — "07", or "7:30" when not on the hour. */
function hourLabel(d?: Date): string {
  if (!d) return '';
  const m = dayjs(d);
  return m.minute() === 0 ? m.format('HH') : m.format('H:mm');
}

/** A driver's availability window on a given day (earliest start → latest end),
 * or null if not available that day. */
function daySlots(driver: DriverListItemDto, day: Dayjs): { from: Date; until: Date } | null {
  const slots = (driver.availableDates ?? []).filter((a) => a.from && dayjs(a.from).isSame(day, 'day'));
  if (slots.length === 0) return null;
  const froms = slots.map((s) => s.from as Date).sort((a, b) => a.getTime() - b.getTime());
  const untils = slots.map((s) => (s.until ?? s.from) as Date).sort((a, b) => a.getTime() - b.getTime());
  return { from: froms[0], until: untils[untils.length - 1] };
}

export function DashboardPage() {
  const { user, canSee } = useAuth();
  const navigate = useNavigate();
  const countsQuery = useModuleCounts();
  const driversQuery = useDrivers();

  const showWeek = canSee('shipments') || canSee('deliveries');
  const showLowStock = canSee('inventory');
  const showReminders = canSee('breweries') || canSee('clients');

  const shipmentsQuery = useShipments();
  const deliveriesQuery = useDeliveries();
  const inventoryQuery = useInventory();
  const remindersQuery = useUpcomingReminders();

  const today = useMemo(() => dayjs().startOf('day'), []);

  const tiles = NAV_GROUPS.flatMap((g) => g.items).filter(
    // Keyed by nav key, not by module: the garage-sale Reporty gates on `sales` but has no tile.
    (it) => TILE_CONFIG[it.key] !== undefined && canSee(navPermModule(it))
  );

  // This week's 7 days, starting today (matching the prototype's availability grid).
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => today.add(i, 'day')), [today]);

  // "Tento týden" — upcoming shipments + deliveries (from today on), by date.
  const weekRows = useMemo(() => {
    const ships = (shipmentsQuery.data ?? [])
      .filter((s) => s.deliveryDate && !dayjs(s.deliveryDate).startOf('day').isBefore(today))
      .map((s) => {
        const st = SHIP_STATUS[shipStateName(s.state) ?? 'Created'] ?? SHIP_STATUS.Created;
        return { key: `s-${s.id}`, date: s.deliveryDate!, kind: 'ship' as const, title: s.name ?? 'Vývoz', meta: 'Rozvoz ke klientům', href: `${PATHS.shipments}/${s.id}`, tone: st.tone, label: st.label };
      });
    const delivs = (deliveriesQuery.data ?? [])
      .filter((d) => d.deliveryDate && deliveryStateName(d.state) !== 'Cancelled' && !dayjs(d.deliveryDate).startOf('day').isBefore(today))
      .map((d) => {
        const st = DELIVERY_STATUS[deliveryStateName(d.state) ?? 'InPlanning'] ?? DELIVERY_STATUS.InPlanning;
        const n = (d.stopNames ?? []).length;
        return { key: `d-${d.id}`, date: d.deliveryDate!, kind: 'deliv' as const, title: 'Dovoz z pivovarů', meta: `${n} ${plural(n, 'pivovar', 'pivovary', 'pivovarů')}`, href: `${PATHS.deliveries}/${d.id}`, tone: st.tone, label: st.label };
      });
    return [...ships, ...delivs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [shipmentsQuery.data, deliveriesQuery.data, today]);

  // "Nízká zásoba" — inventory items at or below the low-stock threshold.
  const lowStock = useMemo(() => {
    const out: { key: string; name: string; section: string; quantity: number }[] = [];
    for (const sec of inventoryQuery.data ?? []) {
      for (const it of sec.items ?? []) {
        if ((it.quantity ?? 0) <= LOW_STOCK_THRESHOLD) {
          out.push({ key: it.id ?? `${sec.id}-${it.name}`, name: it.name ?? '—', section: sec.name ?? '', quantity: it.quantity ?? 0 });
        }
      }
    }
    return out.sort((a, b) => a.quantity - b.quantity);
  }, [inventoryQuery.data]);

  // "Připomínky" — upcoming reminders flattened across sections, by date.
  const reminders = useMemo(() => {
    const out: { key: string; name: string; sectionName: string; href: string; date?: Date }[] = [];
    for (const sec of remindersQuery.data ?? []) {
      const href = sec.sectionType === SectionType.Client ? `${PATHS.clients}/${sec.sectionId}` : `${PATHS.breweries}/${sec.sectionId}`;
      for (const r of sec.reminders ?? []) {
        out.push({ key: r.id ?? `${sec.sectionId}-${r.name}`, name: r.name ?? '—', sectionName: sec.sectionName ?? '', href, date: r.occurrenceDate });
      }
    }
    return out.sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));
  }, [remindersQuery.data]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Přehled"
        title="Nástěnka"
        subtitle={user?.firstName ? `Vítejte zpět, ${user.firstName}.` : 'Vítejte zpět.'}
      />

      <Box sx={{ mb: 3 }}>
        <QueryBoundary query={countsQuery}>
          {(counts) => (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 2,
              }}
            >
              {tiles.map((it) => {
                const cfg = TILE_CONFIG[it.key]!;
                const value = counts[cfg.field] ?? 0;
                return (
                  <StatCard
                    key={it.key}
                    icon={it.icon}
                    label={it.label}
                    value={num(value)}
                    tone={cfg.tone}
                    onClick={() => navigate(it.path)}
                  />
                );
              })}
            </Box>
          )}
        </QueryBoundary>
      </Box>

      {/* Driver availability is pulled above the grid (order: -1) so it sits
          above the low-stock card, while staying full-width. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {(showWeek || showLowStock || showReminders) && (
        <Box sx={{
          display: 'grid', gap: 2, alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: showReminders && (showWeek || showLowStock) ? '1.4fr 1fr' : '1fr' },
        }}>
          {(showWeek || showLowStock) && (
            <Stack spacing={2}>
              {showWeek && (
                <DashCard
                  icon={<RouteOutlinedIcon />}
                  iconColor="warning.main"
                  title="Tento týden — rozvozy a dovozy"
                  action={<Button component={RouterLink} to={PATHS.shipments} size="small">Vše</Button>}
                >
                  {weekRows.length > 0 ? (
                    <Stack spacing={1}>
                      {weekRows.map((r) => (
                        <ScheduleRow
                          key={r.key}
                          date={r.date}
                          icon={r.kind === 'ship' ? <LocalShippingOutlinedIcon /> : <WarehouseOutlinedIcon />}
                          title={r.title}
                          meta={r.meta}
                          href={r.href}
                          tone={r.tone}
                          label={r.label}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <EmptyState title="Nic naplánováno" description="Tento týden nejsou žádné rozvozy ani dovozy." dense />
                  )}
                </DashCard>
              )}

              {showLowStock && (
                <DashCard
                  icon={<ReportProblemOutlinedIcon />}
                  iconColor="error.main"
                  title="Nízká zásoba"
                  action={<Button component={RouterLink} to={PATHS.inventory} size="small">Sklad</Button>}
                >
                  {lowStock.length > 0 ? (
                    <Stack spacing={1}>
                      {lowStock.map((i) => (
                        <Stack key={i.key} direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{i.name}</Typography>
                            {i.section && <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{i.section}</Typography>}
                          </Box>
                          <StatusPill tone="crit" label={`${i.quantity} ks skladem`} />
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Typography color="text.secondary" sx={{ fontSize: 13.5 }}>Vše dostatečně naskladněno.</Typography>
                  )}
                </DashCard>
              )}
            </Stack>
          )}

          {showReminders && (
            <DashCard
              icon={<NotificationsNoneOutlinedIcon />}
              iconColor="info.main"
              title="Připomínky"
              action={<Chip size="small" label={reminders.length} />}
            >
              {reminders.length > 0 ? (
                <Stack spacing={0.25}>
                  {reminders.map((r) => {
                    const d = r.date ? dayjs(r.date).startOf('day') : null;
                    const overdue = d ? d.isBefore(today) : false;
                    const isToday = d ? d.isSame(today, 'day') : false;
                    const dotColor = overdue ? 'error.main' : isToday ? 'warning.main' : 'info.main';
                    return (
                      <Box key={r.key} component={RouterLink} to={r.href} sx={{
                        display: 'flex', alignItems: 'flex-start', gap: 1.25, p: 1, borderRadius: 1.5,
                        textDecoration: 'none', color: 'inherit', '&:hover': { bgcolor: 'action.hover' },
                      }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', mt: 0.75, flexShrink: 0, bgcolor: dotColor }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{r.name}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{r.sectionName}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, flexShrink: 0, color: overdue ? 'error.main' : isToday ? 'warning.dark' : 'text.secondary' }}>
                          {isToday ? 'dnes' : r.date ? fmtDateShort(r.date) : ''}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={{ fontSize: 13.5 }}>Žádné aktivní připomínky.</Typography>
              )}
            </DashCard>
          )}
        </Box>
      )}

      <Card sx={{ p: { xs: 2, sm: 2.5 }, order: -1 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" sx={{ mb: 2 }}>
          <CalendarMonthOutlinedIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ flex: 1 }}>Dostupnost řidičů tento týden</Typography>
          <Button
            component={RouterLink}
            to={PATHS.drivers}
            variant="contained"
            size="small"
            startIcon={<CalendarMonthOutlinedIcon />}
          >
            Celý kalendář
          </Button>
        </Stack>

        <QueryBoundary
          query={driversQuery}
          isEmpty={(rows) => rows.length === 0}
          emptyState={
            <EmptyState
              title="Žádní řidiči"
              description="Zatím nejsou v evidenci žádní řidiči."
              action={
                <Button component={RouterLink} to={PATHS.drivers} variant="contained" size="small">
                  Přidat řidiče
                </Button>
              }
            />
          }
        >
          {(drivers) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Box sx={{ minWidth: 720, display: 'grid', gridTemplateColumns: `minmax(130px, 1.4fr) repeat(7, minmax(72px, 1fr))` }}>
                {/* Header row */}
                <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'flex-end' }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.disabled' }}>Řidič</Typography>
                </Box>
                {weekDays.map((d) => {
                  const isToday = d.isSame(today, 'day');
                  return (
                    <Box key={d.toISOString()} sx={{ px: 1, py: 1.25, borderBottom: 1, borderColor: 'divider', textAlign: 'center' }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: isToday ? 'warning.main' : 'text.disabled' }}>
                        {WEEKDAY_SHORT[d.day()]}
                      </Typography>
                      <Typography sx={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: isToday ? 'warning.dark' : 'text.primary' }}>
                        {d.date()}.
                      </Typography>
                    </Box>
                  );
                })}

                {/* One row per driver */}
                {drivers.map((dr, i) => {
                  const color = dr.color || '#8791A0';
                  const rowBorder = i === 0 ? {} : { borderTop: 1, borderColor: 'divider' };
                  return (
                    <Fragment key={dr.id ?? fullName(dr)}>
                      <Box sx={{ ...rowBorder, px: 1.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{fullName(dr)}</Typography>
                      </Box>
                      {weekDays.map((d) => {
                        const slot = daySlots(dr, d);
                        return (
                          <Box key={d.toISOString()} sx={{ ...rowBorder, px: 1, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {slot ? (
                              <Box component="span" sx={{ px: 1, py: 0.4, borderRadius: 1, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', bgcolor: alpha(color, 0.16), color, whiteSpace: 'nowrap' }}>
                                {hourLabel(slot.from)}–{hourLabel(slot.until)}
                              </Box>
                            ) : (
                              <Typography component="span" color="text.disabled">—</Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </Box>
            </Box>
          )}
        </QueryBoundary>
      </Card>
      </Box>
    </PageContainer>
  );
}
