import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField, InputAdornment } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateReminderDto,
  UpdateReminderDto,
  ReminderType,
  type ReminderListItemDto,
} from 'src/generated/api-client';
import { useCreateClientReminder, useUpdateClientReminder } from 'src/hooks/useClientReminders';

const schema = z.object({
  name: z.string().trim().min(1, 'Zadejte název'),
  description: z.string().optional(),
  occurrenceDate: z.custom<Dayjs>((v) => dayjs.isDayjs(v) && v.isValid(), 'Zadejte datum'),
  daysBefore: z.string().refine((v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0, 'Zadejte počet dní'),
});
type FormValues = z.infer<typeof schema>;

/** Create/edit a client reminder. One-time events for now (recurring reminders
 * are a future enhancement) — mirrors the brewery ReminderFormDrawer. */
export function ReminderFormDrawer({
  open,
  clientId,
  reminder,
  onClose,
}: {
  open: boolean;
  clientId: string;
  reminder?: ReminderListItemDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateClientReminder(clientId);
  const update = useUpdateClientReminder(clientId);
  const editing = Boolean(reminder);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', occurrenceDate: dayjs(), daysBefore: '3' },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      reminder
        ? {
            name: reminder.name ?? '',
            description: reminder.description ?? '',
            occurrenceDate: reminder.occurrenceDate ? dayjs(reminder.occurrenceDate) : dayjs(),
            daysBefore: '3',
          }
        : { name: '', description: '', occurrenceDate: dayjs(), daysBefore: '3' }
    );
  }, [open, reminder, reset]);

  const submit = handleSubmit(async (v) => {
    const common = {
      name: v.name,
      description: v.description || undefined,
      type: ReminderType.OneTimeEvent,
      occurrenceDate: v.occurrenceDate.toDate(),
      numberOfDaysToRemindBefore: Number(v.daysBefore),
    };
    try {
      if (reminder?.id) {
        await update.mutateAsync({ id: reminder.id, data: new UpdateReminderDto(common) });
        enqueueSnackbar('Připomínka upravena.', { variant: 'success' });
      } else {
        await create.mutateAsync(new CreateReminderDto(common));
        enqueueSnackbar('Připomínka přidána.', { variant: 'success' });
      }
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  });

  const busy = create.isPending || update.isPending;

  return (
    <FormDrawer
      open={open}
      title={editing ? 'Upravit připomínku' : 'Nová připomínka'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit' : 'Přidat'}
    >
      <Controller control={control} name="name" render={({ field }) => (
        <TextField {...field} label="Název" error={Boolean(errors.name)} helperText={errors.name?.message} fullWidth autoFocus />
      )} />
      <Controller control={control} name="occurrenceDate" render={({ field }) => (
        <DatePicker
          label="Datum"
          value={field.value}
          onChange={field.onChange}
          slotProps={{ textField: { fullWidth: true, error: Boolean(errors.occurrenceDate), helperText: errors.occurrenceDate?.message } }}
        />
      )} />
      <Controller control={control} name="daysBefore" render={({ field }) => (
        <TextField {...field} label="Připomenout dní předem" type="number" fullWidth
          error={Boolean(errors.daysBefore)} helperText={errors.daysBefore?.message}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">dní</InputAdornment> } }} />
      )} />
      <Controller control={control} name="description" render={({ field }) => (
        <TextField {...field} label="Poznámka" multiline minRows={2} fullWidth />
      )} />
    </FormDrawer>
  );
}
