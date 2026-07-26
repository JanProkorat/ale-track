import { useState } from 'react';
import { Box, Button, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import LocationOnIcon from '@mui/icons-material/LocationOnOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { DeliveryPlaceDialog } from 'src/components/common/DeliveryPlaceDialog';
import { apiErrorMessage } from 'src/api/errors';
import { type ClientDeliveryPlaceDto } from 'src/generated/api-client';
import { useClientDeliveryPlaces, useDeleteDeliveryPlace } from 'src/hooks/useDeliveryPlaces';
import { formatPlaceAddress } from './deliveryPlaceFormat';

function PlaceRow({
  place,
  editable,
  onEdit,
  onDelete,
}: {
  place: ClientDeliveryPlaceDto;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Box
        sx={{
          width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', flexShrink: 0,
          bgcolor: (t) => t.vars!.palette.brand.infoTint, color: 'info.main', '& svg': { fontSize: 18 },
        }}
      >
        <LocationOnIcon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
          {formatPlaceAddress(place)}
        </Typography>
        {place.note && (
          <Typography color="text.secondary" sx={{ fontSize: 11.5, mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StickyNote2Icon sx={{ fontSize: 12 }} /> {place.note}
          </Typography>
        )}
      </Box>
      {editable && (
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Tooltip title="Upravit">
            <IconButton size="small" onClick={onEdit} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Smazat">
            <IconButton size="small" onClick={onDelete} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Box>
  );
}

/** Client-detail card managing a client's own named delivery places — ports the
 * prototype's `placesCard` block (header count chip + subtitle, one row per
 * place, edit/delete actions) plus `deliveryPlaceForm`/`dpRender` via the
 * shared `DeliveryPlaceDialog`. Mirrors NotesPanel/RemindersPanel's structure,
 * but renders its own titled-card chrome since — unlike those — this panel
 * sits inline in the info tab's grid rather than owning a whole sub-tab. */
export function DeliveryPlacesPanel({ clientId, clientName, editable }: { clientId: string; clientName?: string; editable: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const query = useClientDeliveryPlaces(clientId);
  const del = useDeleteDeliveryPlace();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<ClientDeliveryPlaceDto | undefined>(undefined);
  const [confirmPlace, setConfirmPlace] = useState<ClientDeliveryPlaceDto | null>(null);

  const openCreate = () => { setEditingPlace(undefined); setDialogOpen(true); };
  const openEdit = (p: ClientDeliveryPlaceDto) => { setEditingPlace(p); setDialogOpen(true); };

  const doDelete = async () => {
    if (!confirmPlace?.id) return;
    try {
      await del.mutateAsync({ id: confirmPlace.id, clientId });
      enqueueSnackbar('Místo smazáno.', { variant: 'success' });
      setConfirmPlace(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" rowGap={1} columnGap={1.5} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <LocationOnIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Místa doručení</Typography>
        <Chip size="small" label={query.data?.length ?? 0} />
        <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>
          Volitelná místa navíc k fakturační a kontaktní adrese — vybírají se u zastávky vývozu.
        </Typography>
        {editable && (
          <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={openCreate} sx={{ ml: 'auto', flexShrink: 0 }}>
            Přidat místo
          </Button>
        )}
      </Stack>

      <Box sx={{ p: 2.5 }}>
        <QueryBoundary
          query={query}
          minHeight={100}
          isEmpty={(rows) => rows.length === 0}
          emptyState={
            <EmptyState
              icon={<LocationOnIcon />}
              title="Žádná vlastní místa."
              description={editable ? 'Přidejte je tlačítkem výše, nebo rovnou při plánování vývozu.' : undefined}
              dense
            />
          }
        >
          {(rows) => (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {rows.map((p) => (
                <PlaceRow key={p.id} place={p} editable={editable} onEdit={() => openEdit(p)} onDelete={() => setConfirmPlace(p)} />
              ))}
            </Box>
          )}
        </QueryBoundary>
      </Box>

      <DeliveryPlaceDialog
        open={dialogOpen}
        clientId={clientId}
        clientName={clientName}
        place={editingPlace}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={confirmPlace !== null}
        title="Smazat místo doručení?"
        message="Místo zmizí z nabídky u zastávek tohoto klienta. Na existujících vývozech zůstane vidět."
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirmPlace(null)}
      />
    </Card>
  );
}
