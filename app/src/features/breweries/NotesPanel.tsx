import { useState } from 'react';
import { Box, Stack, TextField, Button, IconButton, Card, Typography, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import { useSnackbar } from 'notistack';
import { useAuth } from 'src/auth/AuthProvider';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { apiErrorMessage } from 'src/api/errors';
import { useBreweryNotes, useCreateBreweryNote, useDeleteBreweryNote } from 'src/hooks/useBreweryNotes';

export function NotesPanel({ breweryId, editable }: { breweryId: string; editable: boolean }) {
  const { isDemo } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const query = useBreweryNotes(breweryId);
  const create = useCreateBreweryNote(breweryId);
  const del = useDeleteBreweryNote(breweryId);
  const [draft, setDraft] = useState('');

  if (!isDemo) {
    return (
      <EmptyState
        icon={<StickyNote2Icon />}
        title="Poznámky"
        description="Poznámky k pivovarům zatím nejsou dostupné v API."
        dense
      />
    );
  }

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await create.mutateAsync(text);
      setDraft('');
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };
  const remove = async (id: string) => {
    try {
      await del.mutateAsync(id);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <Box>
      {editable && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nová poznámka…"
            size="small"
            fullWidth
            multiline
            maxRows={4}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={add} disabled={create.isPending || !draft.trim()} sx={{ flexShrink: 0 }}>
            Přidat
          </Button>
        </Stack>
      )}
      <QueryBoundary
        query={query}
        minHeight={120}
        isEmpty={(rows) => rows.length === 0}
        emptyState={<EmptyState icon={<StickyNote2Icon />} title="Žádné poznámky" dense />}
      >
        {(rows) => (
          <Stack spacing={1}>
            {rows.map((n) => (
              <Card key={n.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography sx={{ flex: 1, whiteSpace: 'pre-wrap' }}>{n.text}</Typography>
                {editable && (
                  <Tooltip title="Smazat">
                    <IconButton size="small" color="error" onClick={() => n.id && remove(n.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Card>
            ))}
          </Stack>
        )}
      </QueryBoundary>
    </Box>
  );
}
