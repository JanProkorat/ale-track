import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Chip, CircularProgress, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateReminderDto,
  UpdateReminderDto,
  ReminderType,
  ReminderRecurrenceType,
  DayOfWeek,
} from 'src/generated/api-client';
import { useReminderDetail } from 'src/hooks/useReminders';

// Monday-first display order; values are the DayOfWeek enum (Sunday=0..Saturday=6).
const DOW_OPTIONS = [
  { v: 1, label: 'Po' }, { v: 2, label: 'Út' }, { v: 3, label: 'St' }, { v: 4, label: 'Čt' },
  { v: 5, label: 'Pá' }, { v: 6, label: 'So' }, { v: 0, label: 'Ne' },
];
const DOM_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

// Enum-duality-safe readers: the API may send enum values as strings, while the
// generated TS enums are numeric.
function typeKey(t: ReminderType | undefined): 'OneTimeEvent' | 'Regular' {
  const raw = t as unknown;
  const name = typeof raw === 'string' ? raw : t != null ? ReminderType[t] : 'OneTimeEvent';
  return name === 'Regular' ? 'Regular' : 'OneTimeEvent';
}
function recKey(t: ReminderRecurrenceType | undefined): 'Weekly' | 'Monthly' {
  const raw = t as unknown;
  const name = typeof raw === 'string' ? raw : t != null ? ReminderRecurrenceType[t] : 'Weekly';
  return name === 'Monthly' ? 'Monthly' : 'Weekly';
}
function dowNum(d: DayOfWeek): number {
  const raw = d as unknown;
  return typeof raw === 'string' ? (DayOfWeek[raw as keyof typeof DayOfWeek] ?? 0) : (raw as number);
}

const schema = z
  .object({
    name: z.string().trim().min(1, 'Zadejte název'),
    description: z.string().optional(),
    daysBefore: z.string().refine((v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0, 'Zadejte počet dní'),
    type: z.enum(['OneTimeEvent', 'Regular']),
    occurrenceDate: z.custom<Dayjs>((v) => dayjs.isDayjs(v) && v.isValid()).nullable(),
    recurrenceType: z.enum(['Weekly', 'Monthly']),
    daysOfWeek: z.array(z.number()),
    daysOfMonth: z.array(z.number()),
    activeUntil: z.custom<Dayjs>((v) => dayjs.isDayjs(v) && v.isValid()).nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'OneTimeEvent') {
      if (!val.occurrenceDate) ctx.addIssue({ code: 'custom', path: ['occurrenceDate'], message: 'Zadejte datum' });
    } else if (val.recurrenceType === 'Weekly' && val.daysOfWeek.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['daysOfWeek'], message: 'Vyberte alespoň jeden den' });
    } else if (val.recurrenceType === 'Monthly' && val.daysOfMonth.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['daysOfMonth'], message: 'Vyberte alespoň jeden den v měsíci' });
    }
  });
type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  name: '', description: '', daysBefore: '3', type: 'OneTimeEvent',
  occurrenceDate: dayjs(), recurrenceType: 'Weekly', daysOfWeek: [], daysOfMonth: [], activeUntil: null,
};

/** Chips toggled on/off, kept sorted — for day-of-week / day-of-month selection. */
function DayChips({ options, value, onChange }: {
  options: { v: number; label: string }[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const toggle = (n: number) => onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n].sort((a, b) => a - b));
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {options.map((o) => {
        const on = value.includes(o.v);
        return (
          <Chip
            key={o.v}
            label={o.label}
            clickable
            onClick={() => toggle(o.v)}
            variant={on ? 'filled' : 'outlined'}
            color={on ? 'primary' : 'default'}
            size="small"
            sx={{ fontWeight: 700, minWidth: 34 }}
          />
        );
      })}
    </Box>
  );
}

/** Shared create/edit reminder form (one-time events + recurring reminders).
 * Entity-agnostic: the parent supplies the create/update callbacks and, for
 * edit, the reminder id (the form fetches its full detail for prefill). */
export function ReminderForm({
  open,
  reminderId,
  onClose,
  onCreate,
  onUpdate,
  busy,
}: {
  open: boolean;
  reminderId?: string;
  onClose: () => void;
  onCreate: (data: CreateReminderDto) => Promise<unknown>;
  onUpdate: (id: string, data: UpdateReminderDto) => Promise<unknown>;
  busy: boolean;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const editing = Boolean(reminderId);
  const detailQuery = useReminderDetail(open && reminderId ? reminderId : undefined);
  const detail = detailQuery.data;
  const loadedRef = useRef(false);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!open) { loadedRef.current = false; return; }
    if (!editing) { reset(defaults); return; }
    if (loadedRef.current || !detail) return;
    loadedRef.current = true;
    reset({
      name: detail.name ?? '',
      description: detail.description ?? '',
      daysBefore: String(detail.numberOfDaysToRemindBefore ?? 3),
      type: typeKey(detail.type),
      occurrenceDate: detail.occurrenceDate ? dayjs(detail.occurrenceDate) : dayjs(),
      recurrenceType: recKey(detail.recurrenceType),
      daysOfWeek: (detail.daysOfWeek ?? []).map(dowNum),
      daysOfMonth: detail.daysOfMonth ?? [],
      activeUntil: detail.activeUntil ? dayjs(detail.activeUntil) : null,
    });
  }, [open, editing, detail, reset]);

  const type = watch('type');
  const recurrenceType = watch('recurrenceType');

  const submit = handleSubmit(async (v) => {
    const base = {
      name: v.name,
      description: v.description?.trim() || undefined,
      type: ReminderType[v.type],
      numberOfDaysToRemindBefore: Number(v.daysBefore),
    };
    const payload = v.type === 'OneTimeEvent'
      ? { ...base, occurrenceDate: v.occurrenceDate!.toDate() }
      : {
          ...base,
          recurrenceType: ReminderRecurrenceType[v.recurrenceType],
          daysOfWeek: v.recurrenceType === 'Weekly' ? v.daysOfWeek : undefined,
          daysOfMonth: v.recurrenceType === 'Monthly' ? v.daysOfMonth : undefined,
          activeUntil: v.activeUntil ? v.activeUntil.toDate() : undefined,
        };
    try {
      if (editing && reminderId) {
        // Preserve the resolved state — that's managed by a separate endpoint.
        await onUpdate(reminderId, new UpdateReminderDto({ ...payload, resolvedDate: detail?.resolvedDate }));
        enqueueSnackbar('Připomínka upravena.', { variant: 'success' });
      } else {
        await onCreate(new CreateReminderDto(payload));
        enqueueSnackbar('Připomínka přidána.', { variant: 'success' });
      }
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  });

  const detailLoading = editing && detailQuery.isLoading;

  return (
    <FormDrawer
      open={open}
      title={editing ? 'Upravit připomínku' : 'Nová připomínka'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy || detailLoading}
      submitLabel={editing ? 'Uložit' : 'Přidat'}
    >
      {detailLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={28} /></Box>
      ) : (
        <>
          <Controller control={control} name="name" render={({ field }) => (
            <TextField {...field} label="Název" error={Boolean(errors.name)} helperText={errors.name?.message} fullWidth autoFocus />
          )} />

          <Controller control={control} name="type" render={({ field }) => (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 700 }}>Typ připomínky</Typography>
              <ToggleButtonGroup exclusive size="small" value={field.value} onChange={(_e, v) => v && field.onChange(v)} fullWidth>
                <ToggleButton value="OneTimeEvent" sx={{ textTransform: 'none', fontWeight: 700 }}>Jednorázová</ToggleButton>
                <ToggleButton value="Regular" sx={{ textTransform: 'none', fontWeight: 700 }}>Opakovaná</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )} />

          {type === 'OneTimeEvent' ? (
            <Controller control={control} name="occurrenceDate" render={({ field }) => (
              <DatePicker
                label="Datum"
                value={field.value}
                onChange={field.onChange}
                slotProps={{ textField: { fullWidth: true, error: Boolean(errors.occurrenceDate), helperText: errors.occurrenceDate?.message } }}
              />
            )} />
          ) : (
            <>
              <Controller control={control} name="recurrenceType" render={({ field }) => (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 700 }}>Opakování</Typography>
                  <ToggleButtonGroup exclusive size="small" value={field.value} onChange={(_e, v) => v && field.onChange(v)} fullWidth>
                    <ToggleButton value="Weekly" sx={{ textTransform: 'none', fontWeight: 700 }}>Týdně</ToggleButton>
                    <ToggleButton value="Monthly" sx={{ textTransform: 'none', fontWeight: 700 }}>Měsíčně</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              )} />

              {recurrenceType === 'Weekly' ? (
                <Controller control={control} name="daysOfWeek" render={({ field }) => (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 700 }}>Dny v týdnu</Typography>
                    <DayChips options={DOW_OPTIONS} value={field.value} onChange={field.onChange} />
                    {errors.daysOfWeek && <Typography color="error" sx={{ fontSize: 12, mt: 0.5 }}>{errors.daysOfWeek.message}</Typography>}
                  </Box>
                )} />
              ) : (
                <Controller control={control} name="daysOfMonth" render={({ field }) => (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 700 }}>Dny v měsíci</Typography>
                    <DayChips options={DOM_OPTIONS.map((n) => ({ v: n, label: String(n) }))} value={field.value} onChange={field.onChange} />
                    {errors.daysOfMonth && <Typography color="error" sx={{ fontSize: 12, mt: 0.5 }}>{errors.daysOfMonth.message}</Typography>}
                  </Box>
                )} />
              )}

              <Controller control={control} name="activeUntil" render={({ field }) => (
                <DatePicker
                  label="Platí do (volitelné)"
                  value={field.value}
                  onChange={field.onChange}
                  slotProps={{ textField: { fullWidth: true }, field: { clearable: true } }}
                />
              )} />
            </>
          )}

          <Controller control={control} name="daysBefore" render={({ field }) => (
            <TextField {...field} label="Připomenout dní předem" type="number" fullWidth
              error={Boolean(errors.daysBefore)} helperText={errors.daysBefore?.message}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">dní</InputAdornment> } }} />
          )} />

          <Controller control={control} name="description" render={({ field }) => (
            <TextField {...field} label="Poznámka" multiline minRows={2} fullWidth />
          )} />
        </>
      )}
    </FormDrawer>
  );
}
