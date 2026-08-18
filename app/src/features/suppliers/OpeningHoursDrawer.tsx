import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Alert, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import {
  DayOfWeek, ReplaceSupplierOpeningHoursDto, SupplierOpeningHoursUpsertDto,
  type SupplierOpeningHoursDto,
} from 'src/generated/api-client';
import { useReplaceOpeningHours } from 'src/hooks/useSuppliers';
import { WEEKDAYS_LONG, WEEK_ORDER } from './supplierHours';
import { validateWeek, type WeekRow } from './openingHoursWeek';

/** Monday-first options, so the picker reads like the grid it edits. */
const DAY_OPTIONS = WEEK_ORDER.map((day, i) => ({ value: DayOfWeek[day], label: WEEKDAYS_LONG[i] }));

/** "07:00:00" → "07:00" for the time input, which rejects seconds. */
function toTimeInput(time: string | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
}

/** The whole week in one form — one PUT replaces it, so there is nothing to diff. */
export function OpeningHoursDrawer({
  open,
  supplierId,
  supplierName,
  hours,
  onClose,
}: {
  open: boolean;
  supplierId: string;
  supplierName: string;
  hours: SupplierOpeningHoursDto[];
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const replace = useReplaceOpeningHours();

  const { control, handleSubmit, reset, getValues } = useForm<{ rows: WeekRow[] }>({
    defaultValues: { rows: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  useEffect(() => {
    if (!open) return;
    reset({
      rows: hours.map((h) => ({
        day: DayOfWeek[Number(h.dayOfWeek ?? 0)],
        from: toTimeInput(h.from),
        to: toTimeInput(h.to),
      })),
    });
  }, [open, hours, reset]);

  const submit = handleSubmit(async (v) => {
    const problem = validateWeek(v.rows);
    if (problem) {
      enqueueSnackbar(problem, { variant: 'warning' });
      return;
    }

    try {
      await replace.mutateAsync({
        id: supplierId,
        data: new ReplaceSupplierOpeningHoursDto({
          openingHours: v.rows.map(
            (r) =>
              new SupplierOpeningHoursUpsertDto({
                dayOfWeek: DayOfWeek[r.day as keyof typeof DayOfWeek],
                // TimeOnly wants seconds on the wire; the input never provides them.
                from: `${r.from}:00`,
                to: `${r.to}:00`,
              }),
          ),
        }),
      });
      enqueueSnackbar('Otevírací doba uložena.', { variant: 'success' });
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  });

  return (
    <FormDrawer
      open={open}
      title="Otevírací doba"
      subtitle={supplierName}
      onClose={onClose}
      onSubmit={submit}
      busy={replace.isPending}
      submitLabel="Uložit"
      width={560}
    >
      <Alert severity="info" icon={false}>
        <Typography variant="body2">
          Jeden řádek = jeden interval. Obědová pauza se zadává jako <strong>dva intervaly ve
          stejný den</strong>. Den bez intervalu je zavřeno; <strong>0:00–23:59</strong> znamená
          nonstop.
        </Typography>
      </Alert>

      <Stack spacing={1.25}>
        {fields.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Zatím nezadaná — dodavatel se zobrazuje jako zavřený.
          </Typography>
        )}
        {fields.map((f, i) => (
          <Stack key={f.id} direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 150, flexShrink: 0 }}>
              <Controller
                control={control}
                name={`rows.${i}.day`}
                render={({ field }) => (
                  <Combobox
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? DayOfWeek[DayOfWeek.Monday])}
                    options={DAY_OPTIONS}
                    clearable={false}
                  />
                )}
              />
            </Box>
            <Controller
              control={control}
              name={`rows.${i}.from`}
              render={({ field }) => (
                <TextField {...field} type="time" size="small" sx={{ width: 120, flexShrink: 0 }} />
              )}
            />
            <Typography color="text.secondary">–</Typography>
            <Controller
              control={control}
              name={`rows.${i}.to`}
              render={({ field }) => (
                <TextField {...field} type="time" size="small" sx={{ width: 120, flexShrink: 0 }} />
              )}
            />
            <IconButton onClick={() => remove(i)} aria-label="Odebrat interval" sx={{ flexShrink: 0 }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}

        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => {
            // Continue the day the last row used, since a lunch break is the common reason
            // to add a second interval.
            const rows = getValues('rows');
            const last = rows[rows.length - 1];
            append({ day: last?.day ?? DayOfWeek[DayOfWeek.Monday], from: '07:00', to: '15:00' });
          }}
          sx={{
            alignSelf: 'flex-start', color: 'text.primary', borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
          }}
        >
          Přidat interval
        </Button>
      </Stack>

    </FormDrawer>
  );
}
