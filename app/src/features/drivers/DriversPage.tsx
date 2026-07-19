import { useState } from 'react';
import { Box, Button, Card, Divider, IconButton, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDateShort, fmtTime, initials } from 'src/lib/format';
import {
  DriverDto,
  DriverAvailabilityDto,
  type DriverAvailabilityListItemDto,
  type DriverListItemDto,
} from 'src/generated/api-client';
import { useDrivers, useDeleteDriver } from 'src/hooks/useDrivers';
import { DriverFormDrawer } from './DriverFormDrawer';
import { DriverAvailabilityCalendar } from './DriverAvailabilityCalendar';

type DriverView = 'list' | 'calendar';

const fullName = (d: { firstName?: string; lastName?: string }) =>
  [d.firstName, d.lastName].filter(Boolean).join(' ');

/** Nearest availability slot that hasn't started before today (matches the
 * prototype's date-only "from today onward" filter), earliest first. */
function nearestAvailability(
  dates: DriverAvailabilityListItemDto[] | undefined
): DriverAvailabilityListItemDto | undefined {
  const startOfToday = dayjs().startOf('day');
  const upcoming = (dates ?? []).filter((a) => a.from && !dayjs(a.from).isBefore(startOfToday));
  return upcoming.sort((a, b) => a.from!.getTime() - b.from!.getTime())[0];
}

export function DriversPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('drivers');
  const { enqueueSnackbar } = useSnackbar();

  const query = useDrivers();
  const del = useDeleteDriver();

  const [view, setView] = useState<DriverView>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DriverDto | undefined>(undefined);
  const [confirm, setConfirm] = useState<DriverListItemDto | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (d: DriverListItemDto) => {
    setEditing(
      new DriverDto({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        phoneNumber: d.phoneNumber,
        color: d.color,
        availableDates: (d.availableDates ?? []).map((a) => new DriverAvailabilityDto(a)),
      })
    );
    setFormOpen(true);
  };

  const doDelete = async () => {
    if (!confirm?.id) return;
    try {
      await del.mutateAsync(confirm.id);
      enqueueSnackbar('Řidič smazán.', { variant: 'success' });
      setConfirm(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const newDriverButton = editable && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Nový řidič
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Evidence"
        title="Řidiči"
        subtitle="Evidence řidičů a jejich dostupnosti pro rozvozy a dovozy."
        actions={newDriverButton}
      />

      <QueryBoundary
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyState={
          <EmptyState
            icon={<BadgeOutlinedIcon />}
            title="Zatím žádní řidiči"
            description="Přidejte prvního řidiče do evidence."
            action={newDriverButton}
          />
        }
      >
        {(rows) => (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125, flexWrap: 'wrap', mb: 2 }}>
              <ToggleButtonGroup
                value={view}
                exclusive
                size="small"
                onChange={(_e, next: DriverView | null) => next && setView(next)}
                sx={{
                  bgcolor: (t) => t.vars!.palette.brand.surface3,
                  p: 0.375,
                  borderRadius: 2,
                  '& .MuiToggleButtonGroup-grouped': {
                    border: 0,
                    borderRadius: 1.5,
                    px: 1.5,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: 'text.secondary',
                    textTransform: 'none',
                    '&.Mui-selected': {
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                      boxShadow: 1,
                      '&:hover': { bgcolor: 'background.paper' },
                    },
                  },
                }}
              >
                <ToggleButton value="list">
                  <ViewListOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} />
                  Seznam
                </ToggleButton>
                <ToggleButton value="calendar">
                  <CalendarMonthOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} />
                  Kalendář dostupnosti
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography sx={{ ml: 'auto', fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
                {rows.length} řidičů
              </Typography>
            </Box>

            {view === 'list' ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.75 }}>
                {rows.map((d) => (
                  <DriverTile
                    key={d.id ?? fullName(d)}
                    driver={d}
                    editable={editable}
                    onEdit={() => openEdit(d)}
                    onDelete={() => setConfirm(d)}
                  />
                ))}
              </Box>
            ) : (
              <DriverAvailabilityCalendar drivers={rows} />
            )}
          </>
        )}
      </QueryBoundary>

      <DriverFormDrawer open={formOpen} driver={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Smazat řidiče?"
        message={
          <>
            Opravdu chcete smazat řidiče <strong>{confirm ? fullName(confirm) : ''}</strong>? Tuto akci
            nelze vzít zpět.
          </>
        }
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirm(null)}
      />
    </PageContainer>
  );
}

function DriverTile({
  driver,
  editable,
  onEdit,
  onDelete,
}: {
  driver: DriverListItemDto;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = driver.color ?? '#8791A0';
  const nearest = nearestAvailability(driver.availableDates);

  return (
    <Card variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            fontWeight: 800,
            fontSize: 14,
            bgcolor: alpha(color, 0.13),
            color,
          }}
        >
          {initials(driver.firstName, driver.lastName)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }} noWrap>
            {fullName(driver)}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }} noWrap>
            {driver.phoneNumber || 'bez telefonu'}
          </Typography>
        </Box>
        <Box
          title="Barva v kalendáři"
          sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: color, flexShrink: 0 }}
        />
      </Box>

      <Divider sx={{ my: 0 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Nejbližší dostupnost</Typography>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
          {nearest
            ? `${fmtDateShort(nearest.from)} ${fmtTime(nearest.from)}–${fmtTime(nearest.until)}`
            : '—'}
        </Typography>
      </Box>

      {editable && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditIcon fontSize="small" />}
            onClick={onEdit}
            sx={{ flex: 1, color: 'text.primary', borderColor: 'divider', fontWeight: 700, bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}
          >
            Upravit
          </Button>
          <Tooltip title="Smazat">
            <IconButton size="small" onClick={onDelete} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, color: 'text.secondary' }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Card>
  );
}
