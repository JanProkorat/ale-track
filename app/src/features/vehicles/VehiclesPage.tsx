import { useState } from 'react';
import { Button, Card, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import LocalShippingIcon from '@mui/icons-material/LocalShippingOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SearchField } from 'src/components/common/SearchField';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { num } from 'src/lib/format';
import { VehicleDto, type VehicleListItemDto } from 'src/generated/api-client';
import { useVehicles, useDeleteVehicle } from 'src/hooks/useVehicles';
import { VehicleFormDrawer } from './VehicleFormDrawer';

const weight = (kg: number | undefined) => (kg != null ? `${num(kg)} kg` : '—');

export function VehiclesPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('vehicles');
  const { enqueueSnackbar } = useSnackbar();

  const query = useVehicles();
  const del = useDeleteVehicle();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleDto | undefined>(undefined);
  const [confirm, setConfirm] = useState<VehicleListItemDto | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (v: VehicleListItemDto) => {
    setEditing(new VehicleDto({ id: v.id, name: v.name, maxWeight: v.maxWeight }));
    setFormOpen(true);
  };

  const doDelete = async () => {
    if (!confirm?.id) return;
    try {
      await del.mutateAsync(confirm.id);
      enqueueSnackbar('Vůz smazán.', { variant: 'success' });
      setConfirm(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const columns: Column<VehicleListItemDto>[] = [
    {
      key: 'name',
      header: 'Vůz',
      render: (v) => <Typography sx={{ fontWeight: 600 }}>{v.name}</Typography>,
    },
    {
      key: 'maxWeight',
      header: 'Nosnost',
      align: 'right',
      width: 160,
      render: (v) => weight(v.maxWeight),
    },
    ...(editable
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 96,
            render: (v: VehicleListItemDto) => (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Upravit">
                  <IconButton size="small" onClick={() => openEdit(v)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Smazat">
                  <IconButton size="small" color="error" onClick={() => setConfirm(v)}>
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
        title="Vozy"
        subtitle="Vozový park pro rozvoz a svozy."
        actions={
          <>
            <SearchField value={search} onChange={setSearch} placeholder="Hledat vůz…" />
            {editable && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                Přidat vůz
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
              icon={<LocalShippingIcon />}
              title="Zatím žádné vozy"
              description="Přidejte první vozidlo do vozového parku."
              action={
                editable && (
                  <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    Přidat vůz
                  </Button>
                )
              }
            />
          }
        >
          {(rows) => {
            const q = search.trim().toLowerCase();
            const filtered = q ? rows.filter((v) => (v.name ?? '').toLowerCase().includes(q)) : rows;
            if (filtered.length === 0) {
              return <EmptyState title="Nic nenalezeno" description={`Pro „${search}" nemáme žádný vůz.`} dense />;
            }
            return (
              <DataTable
                columns={columns}
                rows={filtered}
                getRowKey={(v) => v.id ?? v.name ?? ''}
              />
            );
          }}
        </QueryBoundary>
      </Card>

      <VehicleFormDrawer open={formOpen} vehicle={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Smazat vůz?"
        message={
          <>
            Opravdu chcete smazat vůz <strong>{confirm?.name}</strong>? Tuto akci nelze vzít zpět.
          </>
        }
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirm(null)}
      />
    </PageContainer>
  );
}
