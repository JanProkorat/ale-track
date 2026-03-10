import type { DayOfWeek ,
     ReminderListItemDto} from 'src/generated/api-client';

import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useState, forwardRef, useImperativeHandle } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import EditIcon from '@mui/icons-material/Edit';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DeleteIcon from '@mui/icons-material/Delete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

import {
     useClientReminders,
     useCreateClientReminder,
     useUpdateClientReminder,
     useDeleteClientReminder,
     useSetClientReminderResolved,
} from 'src/hooks/useClients';

import { useEnumLabel } from 'src/utils/enumTranslations';

import {
     ReminderType,
     CreateReminderDto,
     UpdateReminderDto,
     ReminderRecurrenceType,
} from 'src/generated/api-client';

import EmptyState from 'src/components/common/EmptyState';
import ConfirmDialog from 'src/components/common/ConfirmDialog';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReminderFormState {
     name: string;
     description: string;
     type: ReminderType;
     occurrenceDate: dayjs.Dayjs | null;
     numberOfDaysToRemindBefore: number;
     recurrenceType: ReminderRecurrenceType;
     daysOfWeek: DayOfWeek[];
     daysOfMonth: number[];
     activeUntil: dayjs.Dayjs | null;
}

const INITIAL_FORM: ReminderFormState = {
     name: '',
     description: '',
     type: ReminderType.OneTimeEvent,
     occurrenceDate: null,
     numberOfDaysToRemindBefore: 1,
     recurrenceType: ReminderRecurrenceType.Weekly,
     daysOfWeek: [],
     daysOfMonth: [],
     activeUntil: null,
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ClientRemindersTabHandle {
     openCreateDialog: () => void;
}

interface ClientRemindersTabProps {
     clientId: string;
}

const ClientRemindersTab = forwardRef<ClientRemindersTabHandle, ClientRemindersTabProps>(
function ClientRemindersTab({ clientId }, ref) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();

     const { data: reminders, isLoading } = useClientReminders(clientId);
     const createMutation = useCreateClientReminder();
     const updateMutation = useUpdateClientReminder();
     const deleteMutation = useDeleteClientReminder();
     const resolveMutation = useSetClientReminderResolved();

     const [dialogOpen, setDialogOpen] = useState(false);
     const [editingId, setEditingId] = useState<string | null>(null);
     const [form, setForm] = useState<ReminderFormState>(INITIAL_FORM);
     const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

     const openCreate = () => {
          setEditingId(null);
          setForm(INITIAL_FORM);
          setDialogOpen(true);
     };

     useImperativeHandle(ref, () => ({
          openCreateDialog: openCreate,
     }));

     if (isLoading) return <LoadingSpinner />;

     const openEdit = (r: ReminderListItemDto) => {
          setEditingId(r.id!);
          setForm({
               name: r.name ?? '',
               description: (r as any).description ?? '',
               type: r.type ?? ReminderType.OneTimeEvent,
               occurrenceDate: r.occurrenceDate ? dayjs(r.occurrenceDate) : null,
               numberOfDaysToRemindBefore: (r as any).numberOfDaysToRemindBefore ?? 1,
               recurrenceType: r.recurrenceType ?? ReminderRecurrenceType.Weekly,
               daysOfWeek: r.daysOfWeek ?? [],
               daysOfMonth: r.daysOfMonth ?? [],
               activeUntil: (r as any).activeUntil ? dayjs((r as any).activeUntil) : null,
          });
          setDialogOpen(true);
     };

     const handleSave = () => {
          if (editingId) {
               const dto = new UpdateReminderDto();
               dto.name = form.name;
               dto.description = form.description || undefined;
               dto.type = form.type;
               dto.occurrenceDate = form.occurrenceDate?.toDate();
               dto.numberOfDaysToRemindBefore = form.numberOfDaysToRemindBefore;
               dto.recurrenceType =
                    form.type === ReminderType.Regular ? form.recurrenceType : undefined;
               dto.daysOfWeek =
                    form.type === ReminderType.Regular &&
                    form.recurrenceType === ReminderRecurrenceType.Weekly
                         ? form.daysOfWeek
                         : undefined;
               dto.daysOfMonth =
                    form.type === ReminderType.Regular &&
                    form.recurrenceType === ReminderRecurrenceType.Monthly
                         ? form.daysOfMonth
                         : undefined;
               dto.activeUntil = form.activeUntil?.toDate();
               updateMutation.mutate(
                    { clientId, reminderId: editingId, data: dto },
                    { onSuccess: () => setDialogOpen(false) },
               );
          } else {
               const dto = new CreateReminderDto();
               dto.name = form.name;
               dto.description = form.description || undefined;
               dto.type = form.type;
               dto.occurrenceDate = form.occurrenceDate?.toDate();
               dto.numberOfDaysToRemindBefore = form.numberOfDaysToRemindBefore;
               dto.recurrenceType =
                    form.type === ReminderType.Regular ? form.recurrenceType : undefined;
               dto.daysOfWeek =
                    form.type === ReminderType.Regular &&
                    form.recurrenceType === ReminderRecurrenceType.Weekly
                         ? form.daysOfWeek
                         : undefined;
               dto.daysOfMonth =
                    form.type === ReminderType.Regular &&
                    form.recurrenceType === ReminderRecurrenceType.Monthly
                         ? form.daysOfMonth
                         : undefined;
               dto.activeUntil = form.activeUntil?.toDate();
               createMutation.mutate(
                    { clientId, data: dto },
                    { onSuccess: () => setDialogOpen(false) },
               );
          }
     };

     const handleToggleResolved = (r: ReminderListItemDto) => {
          resolveMutation.mutate({
               clientId,
               reminderId: r.id!,
               resolvedDate: r.isResolved ? undefined : new Date(),
          });
     };

     const handleDelete = () => {
          if (!deleteTarget) return;
          deleteMutation.mutate(
               { clientId, reminderId: deleteTarget },
               { onSuccess: () => setDeleteTarget(null) },
          );
     };

     const toggleDayOfWeek = (day: DayOfWeek) => {
          setForm((prev) => ({
               ...prev,
               daysOfWeek: prev.daysOfWeek.includes(day)
                    ? prev.daysOfWeek.filter((d) => d !== day)
                    : [...prev.daysOfWeek, day],
          }));
     };

     const toggleDayOfMonth = (day: number) => {
          setForm((prev) => ({
               ...prev,
               daysOfMonth: prev.daysOfMonth.includes(day)
                    ? prev.daysOfMonth.filter((d) => d !== day)
                    : [...prev.daysOfMonth, day],
          }));
     };

     // --- Render ---

     if (!reminders?.length) {
          return (
               <>
                    <EmptyState />
                    {renderDialog()}
               </>
          );
     }

     return (
          <Box>
               <Stack spacing={2}>
                    {reminders.map((r) => (
                         <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
                              <Stack
                                   direction="row"
                                   alignItems="center"
                                   spacing={1}
                                   flexWrap="wrap"
                              >
                                   <IconButton
                                        size="small"
                                        onClick={() => handleToggleResolved(r)}
                                        color={r.isResolved ? 'success' : 'default'}
                                        disabled={resolveMutation.isPending}
                                   >
                                        {r.isResolved ? (
                                             <CheckCircleIcon fontSize="small" />
                                        ) : (
                                             <RadioButtonUncheckedIcon fontSize="small" />
                                        )}
                                   </IconButton>

                                   <Typography
                                        variant="subtitle2"
                                        sx={{
                                             flex: 1,
                                             textDecoration: r.isResolved
                                                  ? 'line-through'
                                                  : 'none',
                                        }}
                                   >
                                        {r.name}
                                   </Typography>

                                   <Chip
                                        label={enumLabel.reminderType(r.type!)}
                                        size="small"
                                        variant="outlined"
                                   />

                                   {r.recurrenceType != null && (
                                        <Chip
                                             label={enumLabel.recurrenceType(r.recurrenceType)}
                                             size="small"
                                             variant="outlined"
                                        />
                                   )}

                                   {r.occurrenceDate && (
                                        <Typography variant="caption" color="text.secondary">
                                             {dayjs(r.occurrenceDate).format('DD.MM.YYYY')}
                                        </Typography>
                                   )}

                                   <IconButton size="small" onClick={() => openEdit(r)}>
                                        <EditIcon fontSize="small" />
                                   </IconButton>
                                   <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => setDeleteTarget(r.id!)}
                                   >
                                        <DeleteIcon fontSize="small" />
                                   </IconButton>
                              </Stack>
                         </Paper>
                    ))}
               </Stack>

               {renderDialog()}

               <ConfirmDialog
                    open={!!deleteTarget}
                    title={t('confirm.deleteTitle')}
                    message={t('confirm.deleteMessage', { entity: t('reminders.title') })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleteMutation.isPending}
               />
          </Box>
     );

     // --- Dialog ---

     function renderDialog() {
          const isSaving = createMutation.isPending || updateMutation.isPending;
          return (
               <Dialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
               >
                    <DialogTitle>
                         {editingId ? t('reminders.editReminder') : t('reminders.addReminder')}
                    </DialogTitle>
                    <DialogContent>
                         <Grid container spacing={2} sx={{ mt: 0.5 }}>
                              <Grid size={{ xs: 12 }}>
                                   <TextField
                                        label={t('reminders.name')}
                                        fullWidth
                                        size="small"
                                        value={form.name}
                                        onChange={(e) =>
                                             setForm((p) => ({ ...p, name: e.target.value }))
                                        }
                                   />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                   <TextField
                                        label={t('reminders.description')}
                                        fullWidth
                                        size="small"
                                        multiline
                                        minRows={2}
                                        value={form.description}
                                        onChange={(e) =>
                                             setForm((p) => ({ ...p, description: e.target.value }))
                                        }
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <TextField
                                        select
                                        label={t('reminders.type')}
                                        fullWidth
                                        size="small"
                                        value={form.type}
                                        onChange={(e) =>
                                             setForm((p) => ({
                                                  ...p,
                                                  type: Number(e.target.value) as ReminderType,
                                             }))
                                        }
                                   >
                                        <MenuItem value={ReminderType.OneTimeEvent}>
                                             {enumLabel.reminderType(ReminderType.OneTimeEvent)}
                                        </MenuItem>
                                        <MenuItem value={ReminderType.Regular}>
                                             {enumLabel.reminderType(ReminderType.Regular)}
                                        </MenuItem>
                                   </TextField>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <TextField
                                        label={t('reminders.daysToRemindBefore')}
                                        fullWidth
                                        size="small"
                                        type="number"
                                        value={form.numberOfDaysToRemindBefore}
                                        onChange={(e) =>
                                             setForm((p) => ({
                                                  ...p,
                                                  numberOfDaysToRemindBefore:
                                                       Number(e.target.value) || 0,
                                             }))
                                        }
                                   />
                              </Grid>

                              {form.type === ReminderType.OneTimeEvent && (
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <DatePicker
                                             label={t('reminders.occurrenceDate')}
                                             value={form.occurrenceDate}
                                             onChange={(v) =>
                                                  setForm((p) => ({ ...p, occurrenceDate: v }))
                                             }
                                             slotProps={{
                                                  textField: { size: 'small', fullWidth: true },
                                             }}
                                        />
                                   </Grid>
                              )}

                              {form.type === ReminderType.Regular && (
                                   <>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                             <TextField
                                                  select
                                                  label={t('reminders.recurrenceType')}
                                                  fullWidth
                                                  size="small"
                                                  value={form.recurrenceType}
                                                  onChange={(e) =>
                                                       setForm((p) => ({
                                                            ...p,
                                                            recurrenceType: Number(
                                                                 e.target.value,
                                                            ) as ReminderRecurrenceType,
                                                       }))
                                                  }
                                             >
                                                  <MenuItem value={ReminderRecurrenceType.Weekly}>
                                                       {enumLabel.recurrenceType(
                                                            ReminderRecurrenceType.Weekly,
                                                       )}
                                                  </MenuItem>
                                                  <MenuItem value={ReminderRecurrenceType.Monthly}>
                                                       {enumLabel.recurrenceType(
                                                            ReminderRecurrenceType.Monthly,
                                                       )}
                                                  </MenuItem>
                                             </TextField>
                                        </Grid>

                                        {form.recurrenceType === ReminderRecurrenceType.Weekly && (
                                             <Grid size={{ xs: 12 }}>
                                                  <Typography
                                                       variant="caption"
                                                       color="text.secondary"
                                                       sx={{ mb: 1, display: 'block' }}
                                                  >
                                                       {t('reminders.daysOfWeek')}
                                                  </Typography>
                                                  <Box
                                                       sx={{
                                                            display: 'flex',
                                                            gap: 0.5,
                                                            flexWrap: 'wrap',
                                                       }}
                                                  >
                                                       {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                                                            <Chip
                                                                 key={day}
                                                                 label={DAY_LABELS[day]}
                                                                 size="small"
                                                                 variant={
                                                                      form.daysOfWeek.includes(
                                                                           day as DayOfWeek,
                                                                      )
                                                                           ? 'filled'
                                                                           : 'outlined'
                                                                 }
                                                                 color={
                                                                      form.daysOfWeek.includes(
                                                                           day as DayOfWeek,
                                                                      )
                                                                           ? 'primary'
                                                                           : 'default'
                                                                 }
                                                                 onClick={() =>
                                                                      toggleDayOfWeek(
                                                                           day as DayOfWeek,
                                                                      )
                                                                 }
                                                            />
                                                       ))}
                                                  </Box>
                                             </Grid>
                                        )}

                                        {form.recurrenceType ===
                                             ReminderRecurrenceType.Monthly && (
                                             <Grid size={{ xs: 12 }}>
                                                  <Typography
                                                       variant="caption"
                                                       color="text.secondary"
                                                       sx={{ mb: 1, display: 'block' }}
                                                  >
                                                       {t('reminders.daysOfMonth')}
                                                  </Typography>
                                                  <Box
                                                       sx={{
                                                            display: 'flex',
                                                            gap: 0.5,
                                                            flexWrap: 'wrap',
                                                       }}
                                                  >
                                                       {Array.from({ length: 31 }, (_, i) => i + 1).map(
                                                            (day) => (
                                                                 <Chip
                                                                      key={day}
                                                                      label={String(day)}
                                                                      size="small"
                                                                      variant={
                                                                           form.daysOfMonth.includes(
                                                                                day,
                                                                           )
                                                                                ? 'filled'
                                                                                : 'outlined'
                                                                      }
                                                                      color={
                                                                           form.daysOfMonth.includes(
                                                                                day,
                                                                           )
                                                                                ? 'primary'
                                                                                : 'default'
                                                                      }
                                                                      onClick={() =>
                                                                           toggleDayOfMonth(day)
                                                                      }
                                                                 />
                                                            ),
                                                       )}
                                                  </Box>
                                             </Grid>
                                        )}

                                        <Grid size={{ xs: 12, sm: 6 }}>
                                             <DatePicker
                                                  label={t('reminders.activeUntil')}
                                                  value={form.activeUntil}
                                                  onChange={(v) =>
                                                       setForm((p) => ({ ...p, activeUntil: v }))
                                                  }
                                                  slotProps={{
                                                       textField: {
                                                            size: 'small',
                                                            fullWidth: true,
                                                       },
                                                  }}
                                             />
                                        </Grid>
                                   </>
                              )}
                         </Grid>
                    </DialogContent>
                    <DialogActions>
                         <Button onClick={() => setDialogOpen(false)}>
                              {t('common.cancel')}
                         </Button>
                         <LoadingButton
                              variant="contained"
                              loading={isSaving}
                              onClick={handleSave}
                              disabled={!form.name}
                         >
                              {t('common.save')}
                         </LoadingButton>
                    </DialogActions>
               </Dialog>
          );
     }
},
);

export default ClientRemindersTab;
