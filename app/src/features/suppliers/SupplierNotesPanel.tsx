import { useState } from 'react';
import { Box, Stack, TextField, Button, IconButton, Card, Typography, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { apiErrorMessage } from 'src/api/errors';
import { CreateNoteDto } from 'src/generated/api-client';
import { useCreateSupplierNote, useDeleteSupplierNote, useSupplierNotes } from 'src/hooks/useSuppliers';

/**
 * Supplier notes — the same shape as the client panel, against the supplier note endpoints.
 *
 * Kept as its own component rather than generalising the client one: that would mean
 * threading three hooks in as props to save a page of markup, and the two panels are free
 * to diverge (a supplier note may well want the "kdo a kdy" line a client note does not
 * carry).
 */
export function SupplierNotesPanel({ supplierId, editable }: { supplierId: string; editable: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const query = useSupplierNotes(supplierId);
  const create = useCreateSupplierNote();
  const del = useDeleteSupplierNote();
  const [draft, setDraft] = useState('');

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await create.mutateAsync({ supplierId, data: new CreateNoteDto({ text }) });
      setDraft('');
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const remove = async (noteId: string) => {
    try {
      await del.mutateAsync({ supplierId, noteId });
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={add}
            disabled={create.isPending || !draft.trim()}
            sx={{ flexShrink: 0 }}
          >
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
                    <IconButton
                      size="small"
                      onClick={() => remove(n.id!)}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}
                    >
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
