import { useState } from 'react';
import { Box, Stack, TextField, Button, IconButton, Card, Typography, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { apiErrorMessage } from 'src/api/errors';
import { useBreweryNotes, useCreateBreweryNote, useDeleteBreweryNote } from 'src/hooks/useBreweryNotes';

export function NotesPanel({ breweryId, editable }: { breweryId: string; editable: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const query = useBreweryNotes(breweryId);
  const create = useCreateBreweryNote(breweryId);
  const del = useDeleteBreweryNote(breweryId);
  const [draft, setDraft] = useState('');

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
            placeholder="Napište poznámku a stiskněte Přidat…"
            size="small"
            fullWidth
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
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
        emptyState={<EmptyState icon={<StickyNote2Icon />} title="Zatím žádné poznámky" />}
      >
        {(rows) => (
          <Stack spacing={1.25}>
            {rows.map((n) => (
              <Card key={n.id} sx={{ p: 1.75, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{ color: 'text.disabled', mt: '2px', '& svg': { fontSize: 18 } }}>
                  <StickyNote2Icon />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{n.text}</Typography>
                </Box>
                {editable && (
                  <Tooltip title="Smazat">
                    <IconButton size="small" onClick={() => remove(n.id ?? '')} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
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
