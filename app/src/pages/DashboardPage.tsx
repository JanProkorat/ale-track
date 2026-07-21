import { useMemo, type ReactNode } from 'react';
import { Box, Button, Card, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
import { NAV_GROUPS } from 'src/layout/nav-config';
import { PATHS } from 'src/routes/paths';
import { num, fmtDateShort, plural } from 'src/lib/format';
import { SHIP_STATUS, shipStateName, DELIVERY_STATUS, deliveryStateName, type StatusTone } from 'src/lib/labels';
import { type ModuleKey } from 'src/auth/permissions';
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
  | 'productDeliveriesCount';

// Which count field on the reports DTO backs each module's KPI tile, and the
// tile's tone. Tones are varied for visual rhythm, not semantic meaning.
const TILE_CONFIG: Partial<Record<ModuleKey, { field: ModuleCountField; tone: StatusTone }>> = {
  orders: { field: 'ordersCount', tone: 'amber' },
  shipments: { field: 'outgoingShipmentsCount', tone: 'amber' },
  deliveries: { field: 'productDeliveriesCount', tone: 'info' },
  inventory: { field: 'inventoryItemsCount', tone: 'info' },
  breweries: { field: 'breweriesCount', tone: 'ok' },
  clients: { field: 'clientsCount', tone: 'ok' },
  drivers: { field: 'driversCount', tone: 'grey' },
  vehicles: { field: 'vehiclesCount', tone: 'grey' },
  users: { field: 'usersCount', tone: 'grey' },
};

const WEEKDAY_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
const AVAILABILITY_DAYS = 14;

const fullName = (d: DriverListItemDto) => [d.firstName, d.lastName].filter(Boolean).join(' ');

/** True if a driver's availability range covers the given calendar day
 * (inclusive on both ends, compared by calendar day not time-of-day). */
function covers(day: Dayjs, from?: Date, until?: Date): boolean {
  if (!from || !until) return false;
  const start = dayjs(from).startOf('day');
  const end = dayjs(until).startOf('day');
  return !day.isBefore(start) && !day.isAfter(end);
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
    (it) => TILE_CONFIG[it.key] !== undefined && canSee(it.key)
  );

  const days = useMemo(
    () => Array.from({ length: AVAILABILITY_DAYS }, (_, i) => dayjs().startOf('day').add(i, 'day')),
    []
  );

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

      {(showWeek || showLowStock || showReminders) && (
        <Box sx={{
          display: 'grid', gap: 2, alignItems: 'start', mb: 3,
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

      <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Typography variant="h6">Dostupnost řidičů</Typography>
          <Button component={RouterLink} to={PATHS.drivers} size="small">
            Otevřít řidiče
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
            <Box>
              <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                {days.map((day) => {
                  const available = drivers.filter((d) =>
                    (d.availableDates ?? []).some((a) => covers(day, a.from, a.until))
                  );
                  return (
                    <Box
                      key={day.toISOString()}
                      sx={{
                        minWidth: 64,
                        flex: '0 0 auto',
                        textAlign: 'center',
                        borderRadius: 1.5,
                        bgcolor: 'background.default',
                        border: '1px solid',
                        borderColor: 'divider',
                        py: 1,
                        px: 0.5,
                      }}
                    >
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                        {day.format('D. M.')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                        {WEEKDAY_SHORT[day.day()]}
                      </Typography>
                      {available.length > 0 ? (
                        <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap">
                          {available.map((d) => (
                            <Tooltip key={d.id} title={fullName(d)}>
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: d.color || 'grey.400',
                                }}
                              />
                            </Tooltip>
                          ))}
                        </Stack>
                      ) : (
                        <Typography color="text.disabled">—</Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>

              <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 2 }}>
                {drivers.map((d) => (
                  <Stack key={d.id} direction="row" spacing={0.6} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: d.color || 'grey.400' }} />
                    <Typography variant="caption" color="text.secondary">
                      {fullName(d)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </QueryBoundary>
      </Card>
    </PageContainer>
  );
}
