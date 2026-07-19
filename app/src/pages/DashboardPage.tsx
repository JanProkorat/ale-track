import { useMemo } from 'react';
import { Box, Button, Card, Stack, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { StatCard } from 'src/components/common/StatCard';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { useAuth } from 'src/auth/AuthProvider';
import { useModuleCounts } from 'src/hooks/useReports';
import { useDrivers } from 'src/hooks/useDrivers';
import { NAV_GROUPS } from 'src/layout/nav-config';
import { PATHS } from 'src/routes/paths';
import { num } from 'src/lib/format';
import { type StatusTone } from 'src/lib/labels';
import { type ModuleKey } from 'src/auth/permissions';
import { type DriverListItemDto } from 'src/generated/api-client';

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

  const tiles = NAV_GROUPS.flatMap((g) => g.items).filter(
    (it) => TILE_CONFIG[it.key] !== undefined && canSee(it.key)
  );

  const days = useMemo(
    () => Array.from({ length: AVAILABILITY_DAYS }, (_, i) => dayjs().startOf('day').add(i, 'day')),
    []
  );

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
