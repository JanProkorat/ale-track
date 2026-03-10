import { useTranslation } from 'react-i18next';
import { useState, forwardRef, useImperativeHandle } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import SaveIcon from '@mui/icons-material/Save';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DeleteIcon from '@mui/icons-material/Delete';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import {
     useClientNotes,
     useCreateClientNote,
     useUpdateClientNote,
     useDeleteClientNote,
} from 'src/hooks/useNotes';

import { CreateNoteDto, UpdateNoteDto } from 'src/generated/api-client';

import EmptyState from 'src/components/common/EmptyState';
import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------

export interface ClientNotesTabHandle {
     openCreateDialog: () => void;
}

interface ClientNotesTabProps {
     clientId: string;
}

const ClientNotesTab = forwardRef<ClientNotesTabHandle, ClientNotesTabProps>(
function ClientNotesTab({ clientId }, ref) {
     const { t } = useTranslation();
     const { data: notes, isLoading } = useClientNotes(clientId);
     const createMutation = useCreateClientNote();
     const updateMutation = useUpdateClientNote();
     const deleteMutation = useDeleteClientNote();

     const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
     const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
     const [createOpen, setCreateOpen] = useState(false);
     const [newNoteText, setNewNoteText] = useState('');

     useImperativeHandle(ref, () => ({
          openCreateDialog: () => {
               setNewNoteText('');
               setCreateOpen(true);
          },
     }));

     if (isLoading) return <LoadingSpinner />;

     const handleCreateConfirm = () => {
          const dto = new CreateNoteDto();
          dto.text = newNoteText;
          createMutation.mutate(
               { clientId, data: dto },
               {
                    onSuccess: () => {
                         setCreateOpen(false);
                         setNewNoteText('');
                    },
               },
          );
     };

     const handleUpdate = (noteId: string, text: string) => {
          const dto = new UpdateNoteDto();
          dto.text = text;
          updateMutation.mutate(
               { clientId, noteId, data: dto },
               {
                    onSuccess: () => {
                         setEditedTexts((prev) => {
                              const next = { ...prev };
                              delete next[noteId];
                              return next;
                         });
                    },
               },
          );
     };

     const handleDelete = () => {
          if (!deleteTarget) return;
          deleteMutation.mutate(
               { clientId, noteId: deleteTarget },
               { onSuccess: () => setDeleteTarget(null) },
          );
     };

     if (!notes?.length) {
          return (
               <>
                    <EmptyState />
                    <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                         <DialogTitle>{t('clients.addNote')}</DialogTitle>
                         <DialogContent>
                              <TextField
                                   autoFocus
                                   multiline
                                   minRows={3}
                                   fullWidth
                                   size="small"
                                   placeholder={t('clients.addNote')}
                                   value={newNoteText}
                                   onChange={(e) => setNewNoteText(e.target.value)}
                                   sx={{ mt: 1 }}
                              />
                         </DialogContent>
                         <DialogActions>
                              <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
                              <LoadingButton
                                   variant="contained"
                                   onClick={handleCreateConfirm}
                                   loading={createMutation.isPending}
                                   disabled={!newNoteText.trim()}
                              >
                                   {t('common.save')}
                              </LoadingButton>
                         </DialogActions>
                    </Dialog>
               </>
          );
     }

     return (
          <Box>
               <Stack spacing={2}>
                    {notes.map((note) => {
                         const noteId = note.id!;
                         const edited = editedTexts[noteId];
                         const isDirty = edited !== undefined && edited !== (note.text ?? '');

                         return (
                              <Paper key={noteId} variant="outlined" sx={{ p: 2 }}>
                                   <Stack direction="row" spacing={1} alignItems="flex-start">
                                        <TextField
                                             multiline
                                             minRows={2}
                                             fullWidth
                                             size="small"
                                             placeholder={t('clients.addNote')}
                                             value={edited ?? note.text ?? ''}
                                             onChange={(e) =>
                                                  setEditedTexts((prev) => ({
                                                       ...prev,
                                                       [noteId]: e.target.value,
                                                  }))
                                             }
                                        />
                                        <IconButton
                                             size="small"
                                             color="primary"
                                             disabled={!isDirty || updateMutation.isPending}
                                             onClick={() => handleUpdate(noteId, edited!)}
                                        >
                                             <SaveIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                             size="small"
                                             color="error"
                                             onClick={() => setDeleteTarget(noteId)}
                                        >
                                             <DeleteIcon fontSize="small" />
                                        </IconButton>
                                   </Stack>
                              </Paper>
                         );
                    })}
               </Stack>

               <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>{t('clients.addNote')}</DialogTitle>
                    <DialogContent>
                         <TextField
                              autoFocus
                              multiline
                              minRows={3}
                              fullWidth
                              size="small"
                              placeholder={t('clients.addNote')}
                              value={newNoteText}
                              onChange={(e) => setNewNoteText(e.target.value)}
                              sx={{ mt: 1 }}
                         />
                    </DialogContent>
                    <DialogActions>
                         <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
                         <LoadingButton
                              variant="contained"
                              onClick={handleCreateConfirm}
                              loading={createMutation.isPending}
                              disabled={!newNoteText.trim()}
                         >
                              {t('common.save')}
                         </LoadingButton>
                    </DialogActions>
               </Dialog>

               <ConfirmDialog
                    open={!!deleteTarget}
                    title={t('confirm.deleteTitle')}
                    message={t('clients.deleteNoteConfirm')}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );
},
);

export default ClientNotesTab;
