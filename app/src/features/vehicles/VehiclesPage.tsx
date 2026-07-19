import { useState } from 'react';
import { Box, Button, Card, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import LocalShippingIcon from '@mui/icons-material/LocalShippingOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { num } from 'src/lib/format';
import { VehicleDto, type VehicleListItemDto } from 'src/generated/api-client';
import { useVehicles, useDeleteVehicle } from 'src/hooks/useVehicles';
import { VehicleFormDrawer } from './VehicleFormDrawer';

export function VehiclesPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('vehicles');
  const { enqueueSnackbar } = useSnackbar();

  const query = useVehicles();
  const del = useDeleteVehicle();

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

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Evidence"
        title="Vozy"
        subtitle="Vozový park pro vývozy a dovozy do skladu."
        actions={
          editable && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Nový vůz
            </Button>
          )
        }
      />

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
                  Nový vůz
                </Button>
              )
            }
          />
        }
      >
        {(rows) => (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.25, mx: 0.25 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
                {rows.length} vozů
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.75 }}>
              {rows.map((v) => (
                <VehicleTile
                  key={v.id ?? v.name}
                  vehicle={v}
                  editable={editable}
                  onEdit={() => openEdit(v)}
                  onDelete={() => setConfirm(v)}
                />
              ))}
            </Box>
          </>
        )}
      </QueryBoundary>

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

function VehicleTile({
  vehicle,
  editable,
  onEdit,
  onDelete,
}: {
  vehicle: VehicleListItemDto;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            bgcolor: (t) => t.vars!.palette.brand.infoTint,
            color: 'info.main',
            '& svg': { fontSize: 22 },
          }}
        >
          <LocalShippingIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }} noWrap>
            {vehicle.name}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Nosnost {vehicle.maxWeight != null ? num(vehicle.maxWeight) : '—'} kg
          </Typography>
        </Box>
      </Box>

      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Použit v jízdách</Typography>
        <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>—</Typography>
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
