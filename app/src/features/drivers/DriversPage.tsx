import { useState } from 'react';
import { Box, Button, Card, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SearchField } from 'src/components/common/SearchField';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { DriverDto, DriverAvailabilityDto, type DriverListItemDto } from 'src/generated/api-client';
import { useDrivers, useDeleteDriver } from 'src/hooks/useDrivers';
import { DriverFormDrawer } from './DriverFormDrawer';

const fullName = (d: DriverListItemDto) => [d.firstName, d.lastName].filter(Boolean).join(' ');

const fmtDateNum = (d: Date) => `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;

/** The range to surface in the list: the nearest one that hasn't ended yet,
 * or (if all are past) the most recent one. */
function nearestRange(
  ranges: { from?: Date; until?: Date }[]
): { from: Date; until: Date } | null {
  const valid = ranges.filter((r): r is { from: Date; until: Date } => Boolean(r.from && r.until));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a.from.getTime() - b.from.getTime());
  const now = new Date();
  return sorted.find((r) => r.until >= now) ?? sorted[sorted.length - 1];
}

export function DriversPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('drivers');
  const { enqueueSnackbar } = useSnackbar();

  const query = useDrivers();
  const del = useDeleteDriver();

  const [search, setSearch] = useState('');
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

  const columns: Column<DriverListItemDto>[] = [
    {
      key: 'name',
      header: 'Řidič',
      render: (d) => (
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: d.color || 'grey.400',
              flexShrink: 0,
            }}
          />
          <Typography sx={{ fontWeight: 600 }}>{fullName(d)}</Typography>
        </Stack>
      ),
    },
    {
      key: 'phone',
      header: 'Telefon',
      render: (d) => d.phoneNumber || '—',
    },
    {
      key: 'availability',
      header: 'Dostupnost',
      render: (d) => {
        const ranges = d.availableDates ?? [];
        const nearest = nearestRange(ranges);
        if (!nearest) {
          return (
            <Typography variant="body2" color="text.disabled">
              Nezadáno
            </Typography>
          );
        }
        return (
          <Stack spacing={0.25}>
            <Typography variant="body2">
              {fmtDateNum(nearest.from)} – {fmtDateNum(nearest.until)}
            </Typography>
            {ranges.length > 1 && (
              <Typography variant="caption" color="text.secondary">
                {ranges.length} termíny celkem
              </Typography>
            )}
          </Stack>
        );
      },
    },
    ...(editable
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 96,
            render: (d: DriverListItemDto) => (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Upravit">
                  <IconButton size="small" onClick={() => openEdit(d)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Smazat">
                  <IconButton size="small" color="error" onClick={() => setConfirm(d)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ),
          },
        ]
      : []),
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Evidence"
        title="Řidiči"
        subtitle="Řidiči a jejich dostupnost pro rozvoz."
        actions={
          <>
            <SearchField value={search} onChange={setSearch} placeholder="Hledat řidiče…" />
            {editable && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                Přidat řidiče
              </Button>
            )}
          </>
        }
      />

      <Card sx={{ p: { xs: 1, sm: 1.5 } }}>
        <QueryBoundary
          query={query}
          isEmpty={(rows) => rows.length === 0}
          emptyState={
            <EmptyState
              icon={<BadgeOutlinedIcon />}
              title="Zatím žádní řidiči"
              description="Přidejte prvního řidiče do evidence."
              action={
                editable && (
                  <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    Přidat řidiče
                  </Button>
                )
              }
            />
          }
        >
          {(rows) => {
            const q = search.trim().toLowerCase();
            const filtered = q
              ? rows.filter((d) =>
                  [d.firstName, d.lastName].filter(Boolean).some((v) => (v ?? '').toLowerCase().includes(q))
                )
              : rows;
            if (filtered.length === 0) {
              return (
                <EmptyState title="Nic nenalezeno" description={`Pro „${search}" nemáme žádného řidiče.`} dense />
              );
            }
            return (
              <DataTable
                columns={columns}
                rows={filtered}
                getRowKey={(d) => d.id ?? fullName(d)}
              />
            );
          }}
        </QueryBoundary>
      </Card>

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
