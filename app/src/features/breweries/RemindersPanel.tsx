import { useState } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Checkbox, Tooltip, Card,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import NotificationsIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate } from 'src/lib/format';
import { type ReminderListItemDto } from 'src/generated/api-client';
import {
  useBreweryReminders,
  useResolveBreweryReminder,
  useDeleteBreweryReminder,
} from 'src/hooks/useBreweryReminders';
import { ReminderFormDrawer } from './ReminderFormDrawer';

export function RemindersPanel({ breweryId, editable }: { breweryId: string; editable: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const query = useBreweryReminders(breweryId);
  const resolve = useResolveBreweryReminder(breweryId);
  const del = useDeleteBreweryReminder(breweryId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderListItemDto | undefined>(undefined);
  const [confirm, setConfirm] = useState<ReminderListItemDto | null>(null);

  const toggleResolved = async (r: ReminderListItemDto) => {
    try {
      await resolve.mutateAsync({ id: r.id!, resolvedDate: r.isResolved ? undefined : new Date() });
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };
  const doDelete = async () => {
    if (!confirm?.id) return;
    try {
      await del.mutateAsync(confirm.id);
      enqueueSnackbar('Připomínka smazána.', { variant: 'success' });
      setConfirm(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <>
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Připomínky</Typography>
        {editable && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            Přidat
          </Button>
        )}
      </Stack>

      <QueryBoundary
        query={query}
        minHeight={120}
        isEmpty={(rows) => rows.length === 0}
        emptyState={<EmptyState icon={<NotificationsIcon />} title="Žádné připomínky" dense />}
      >
        {(rows) => (
          <Stack spacing={1}>
            {rows.map((r) => (
              <Card key={r.id} variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox
                  checked={Boolean(r.isResolved)}
                  onChange={() => toggleResolved(r)}
                  disabled={!editable || resolve.isPending}
                  size="small"
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, textDecoration: r.isResolved ? 'line-through' : 'none', color: r.isResolved ? 'text.disabled' : 'text.primary' }}>
                    {r.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmtDate(r.occurrenceDate)}{r.description ? ` · ${r.description}` : ''}
                  </Typography>
                </Box>
                {editable && (
                  <>
                    <Tooltip title="Upravit">
                      <IconButton size="small" onClick={() => { setEditing(r); setFormOpen(true); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Smazat">
                      <IconButton size="small" color="error" onClick={() => setConfirm(r)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Card>
            ))}
          </Stack>
        )}
      </QueryBoundary>

      <ReminderFormDrawer open={formOpen} breweryId={breweryId} reminder={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Smazat připomínku?"
        message={<>Opravdu smazat <strong>{confirm?.name}</strong>?</>}
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
