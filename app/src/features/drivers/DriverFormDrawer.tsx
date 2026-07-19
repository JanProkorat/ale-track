import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs, { type Dayjs } from 'dayjs';
import { Box, Button, FormHelperText, IconButton, Stack, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateDriverDto,
  CreateDriverAvailabilityDto,
  UpdateDriverDto,
  UpdateDriverAvailabilityDto,
  type DriverDto,
} from 'src/generated/api-client';
import { useCreateDriver, useUpdateDriver } from 'src/hooks/useDrivers';

/** Preset swatch palette for the color picker. */
const COLOR_PRESETS = [
  '#E8590C',
  '#2F9E44',
  '#1971C2',
  '#9C36B5',
  '#E03131',
  '#F08C00',
  '#0C8599',
  '#495057',
];

const dayjsField = () =>
  z.custom<Dayjs | null>((v) => v != null && dayjs.isDayjs(v) && v.isValid(), {
    message: 'Zadejte datum',
  });

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'Zadejte jméno'),
    lastName: z.string().trim().min(1, 'Zadejte příjmení'),
    phoneNumber: z.string().optional(),
    color: z.string().trim().min(1, 'Vyberte barvu'),
    availableDates: z.array(
      z.object({
        from: dayjsField(),
        until: dayjsField(),
      })
    ),
  })
  .superRefine((values, ctx) => {
    values.availableDates.forEach((range, i) => {
      if (range.from && range.until && range.until.isBefore(range.from, 'day')) {
        ctx.addIssue({
          code: 'custom',
          message: 'Datum do musí být stejné nebo pozdější než od',
          path: ['availableDates', i, 'until'],
        });
      }
    });
  });
type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  color: '',
  availableDates: [],
};

function toForm(d: DriverDto): FormValues {
  return {
    firstName: d.firstName ?? '',
    lastName: d.lastName ?? '',
    phoneNumber: d.phoneNumber ?? '',
    color: d.color ?? '',
    availableDates: (d.availableDates ?? []).map((a) => ({
      from: a.from ? dayjs(a.from) : null,
      until: a.until ? dayjs(a.until) : null,
    })),
  };
}

/** Create/edit a driver. `driver` undefined → create mode. */
export function DriverFormDrawer({
  open,
  driver,
  onClose,
}: {
  open: boolean;
  driver?: DriverDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateDriver();
  const update = useUpdateDriver();
  const editing = Boolean(driver);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });

  const { fields, append, remove } = useFieldArray({ control, name: 'availableDates' });

  useEffect(() => {
    if (open) reset(driver ? toForm(driver) : empty);
  }, [open, driver, reset]);

  const submit = handleSubmit(async (values) => {
    const phoneNumber = values.phoneNumber?.trim() || undefined;
    try {
      if (driver?.id) {
        await update.mutateAsync({
          id: driver.id,
          data: new UpdateDriverDto({
            firstName: values.firstName,
            lastName: values.lastName,
            phoneNumber,
            color: values.color,
            availableDates: values.availableDates.map(
              (r) => new UpdateDriverAvailabilityDto({ from: r.from!.toDate(), until: r.until!.toDate() })
            ),
          }),
        });
        enqueueSnackbar('Řidič upraven.', { variant: 'success' });
      } else {
        await create.mutateAsync(
          new CreateDriverDto({
            firstName: values.firstName,
            lastName: values.lastName,
            phoneNumber,
            color: values.color,
            availableDates: values.availableDates.map(
              (r) => new CreateDriverAvailabilityDto({ from: r.from!.toDate(), until: r.until!.toDate() })
            ),
          })
        );
        enqueueSnackbar('Řidič přidán.', { variant: 'success' });
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
      title={editing ? 'Upravit řidiče' : 'Nový řidič'}
      subtitle={editing ? [driver?.firstName, driver?.lastName].filter(Boolean).join(' ') : 'Přidejte řidiče do evidence.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Přidat řidiče'}
    >
      <Controller
        control={control}
        name="firstName"
        render={({ field }) => (
          <TextField
            {...field}
            label="Jméno"
            error={Boolean(errors.firstName)}
            helperText={errors.firstName?.message}
            fullWidth
            autoFocus
          />
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field }) => (
          <TextField
            {...field}
            label="Příjmení"
            error={Boolean(errors.lastName)}
            helperText={errors.lastName?.message}
            fullWidth
          />
        )}
      />
      <Controller
        control={control}
        name="phoneNumber"
        render={({ field }) => (
          <TextField
            {...field}
            label="Telefon"
            placeholder="+420 601 234 567"
            error={Boolean(errors.phoneNumber)}
            helperText={errors.phoneNumber?.message}
            fullWidth
          />
        )}
      />

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              Barva
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {COLOR_PRESETS.map((c) => (
                <Box
                  key={c}
                  component="button"
                  type="button"
                  onClick={() => field.onChange(c)}
                  aria-label={`Barva ${c}`}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: c,
                    p: 0,
                    border: 'none',
                    cursor: 'pointer',
                    outline: '2px solid',
                    outlineColor: field.value === c ? 'text.primary' : 'transparent',
                    outlineOffset: '2px',
                    transition: 'outline-color 120ms',
                  }}
                />
              ))}
            </Stack>
            {errors.color?.message && <FormHelperText error>{errors.color.message}</FormHelperText>}
          </Box>
        )}
      />

      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
          Dostupnost
        </Typography>
        {fields.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Zatím žádné termíny.
          </Typography>
        )}
        <Stack spacing={1.5}>
          {fields.map((f, i) => (
            <Stack key={f.id} direction="row" spacing={1} alignItems="flex-start">
              <Controller
                control={control}
                name={`availableDates.${i}.from`}
                render={({ field }) => (
                  <DatePicker
                    label="Od"
                    value={field.value}
                    onChange={field.onChange}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        error: Boolean(errors.availableDates?.[i]?.from),
                        helperText: errors.availableDates?.[i]?.from?.message,
                      },
                    }}
                  />
                )}
              />
              <Controller
                control={control}
                name={`availableDates.${i}.until`}
                render={({ field }) => (
                  <DatePicker
                    label="Do"
                    value={field.value}
                    onChange={field.onChange}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        error: Boolean(errors.availableDates?.[i]?.until),
                        helperText: errors.availableDates?.[i]?.until?.message,
                      },
                    }}
                  />
                )}
              />
              <IconButton
                size="small"
                onClick={() => remove(i)}
                aria-label="Odebrat termín"
                sx={{ mt: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => append({ from: null, until: null })}
          sx={{ mt: 1.5 }}
        >
          Přidat termín
        </Button>
      </Box>
    </FormDrawer>
  );
}
