import { useState } from 'react';
import { Box, Stack, Typography, Button, IconButton, Chip, Tooltip, Card } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import NotificationsIcon from '@mui/icons-material/NotificationsNoneOutlined';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { StatusPill } from 'src/components/common/StatusPill';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate } from 'src/lib/format';
import { ReminderType, type ReminderListItemDto } from 'src/generated/api-client';
import {
  useBreweryReminders,
  useResolveBreweryReminder,
  useDeleteBreweryReminder,
} from 'src/hooks/useBreweryReminders';
import { ReminderFormDrawer } from './ReminderFormDrawer';

function ReminderCard({
  r,
  editable,
  onResolve,
  onDelete,
  resolving,
}: {
  r: ReminderListItemDto;
  editable: boolean;
  onResolve: (r: ReminderListItemDto) => void;
  onDelete: (r: ReminderListItemDto) => void;
  resolving: boolean;
}) {
  const resolved = Boolean(r.isResolved);
  const overdue = !resolved && r.occurrenceDate != null && dayjs(r.occurrenceDate).isBefore(dayjs(), 'day');

  const iconSx = resolved
    ? { bg: 'brand.okTint', fg: 'success.main' as const }
    : overdue
    ? { bg: 'brand.critTint', fg: 'error.main' as const }
    : { bg: 'brand.amberSoft', fg: 'primary.dark' as const };

  return (
    <Card sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={{
          width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', flexShrink: 0,
          bgcolor: iconSx.bg, color: iconSx.fg, '& svg': { fontSize: 20 },
        }}
      >
        {resolved ? <CheckIcon /> : <NotificationsIcon />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontWeight: 700 }}>{r.name}</Typography>
          <Chip size="small" label={r.type === ReminderType.Regular ? 'Opakovaná' : 'Jednorázová'} sx={{ height: 22 }} />
          {resolved ? (
            <StatusPill tone="ok" label="Vyřešeno" />
          ) : overdue ? (
            <StatusPill tone="crit" label="Po termínu" />
          ) : (
            <StatusPill tone="amber" label={fmtDate(r.occurrenceDate)} />
          )}
        </Stack>
        {r.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {r.description}
          </Typography>
        )}
      </Box>
      {editable && (
        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
          {!resolved && (
            <Button
              size="small"
              startIcon={<CheckIcon />}
              disabled={resolving}
              onClick={() => onResolve(r)}
              sx={{ bgcolor: (t) => t.vars!.palette.brand.amberSoft, color: 'primary.dark', '&:hover': { bgcolor: (t) => t.vars!.palette.brand.amberTint } }}
            >
              Vyřešit
            </Button>
          )}
          <Tooltip title="Smazat">
            <IconButton size="small" onClick={() => onDelete(r)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Card>
  );
}

export function RemindersPanel({ breweryId, editable }: { breweryId: string; editable: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const query = useBreweryReminders(breweryId);
  const resolve = useResolveBreweryReminder(breweryId);
  const del = useDeleteBreweryReminder(breweryId);

  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<ReminderListItemDto | null>(null);

  const doResolve = async (r: ReminderListItemDto) => {
    if (!r.id) return;
    try {
      await resolve.mutateAsync({ id: r.id, resolvedDate: new Date() });
      enqueueSnackbar('Označeno jako vyřešené.', { variant: 'success' });
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
    <Box>
      {editable && (
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
            sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}
          >
            Nová připomínka
          </Button>
        </Box>
      )}

      <QueryBoundary
        query={query}
        minHeight={140}
        isEmpty={(rows) => rows.length === 0}
        emptyState={
          <EmptyState
            icon={<NotificationsIcon />}
            title="Žádné připomínky"
            description="Přidejte upomínku na smlouvu, ceník nebo sezónní objednávku."
          />
        }
      >
        {(rows) => (
          <Stack spacing={1.25}>
            {rows.map((r) => (
              <ReminderCard key={r.id} r={r} editable={editable} onResolve={doResolve} onDelete={setConfirm} resolving={resolve.isPending} />
            ))}
          </Stack>
        )}
      </QueryBoundary>

      <ReminderFormDrawer open={formOpen} breweryId={breweryId} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Smazat připomínku?"
        message={<>Opravdu smazat <strong>{confirm?.name}</strong>?</>}
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirm(null)}
      />
    </Box>
  );
}
