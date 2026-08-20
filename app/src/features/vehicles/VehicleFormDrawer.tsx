import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField, InputAdornment } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  type VehicleDto,
} from 'src/generated/api-client';
import { useCreateVehicle, useUpdateVehicle } from 'src/hooks/useVehicles';

const schema = z.object({
  name: z.string().trim().min(1, 'Zadejte název vozu'),
  maxWeight: z
    .string()
    .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) > 0), 'Zadejte kladné číslo'),
});
type FormValues = z.infer<typeof schema>;

const empty: FormValues = { name: '', maxWeight: '' };

function toForm(v: VehicleDto): FormValues {
  return { name: v.name ?? '', maxWeight: v.maxWeight != null ? String(v.maxWeight) : '' };
}

/** Create/edit a vehicle. `vehicle` undefined → create mode. */
export function VehicleFormDrawer({
  open,
  vehicle,
  onClose,
}: {
  open: boolean;
  vehicle?: VehicleDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateVehicle();
  const update = useUpdateVehicle();
  const editing = Boolean(vehicle);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (open) reset(vehicle ? toForm(vehicle) : empty);
  }, [open, vehicle, reset]);

  const submit = handleSubmit(async (values) => {
    const maxWeight = values.maxWeight === '' ? undefined : Number(values.maxWeight);
    try {
      if (vehicle?.id) {
        await update.mutateAsync({ id: vehicle.id, data: new UpdateVehicleDto({ name: values.name, maxWeight }) });
        enqueueSnackbar('Vůz upraven.', { variant: 'success' });
      } else {
        await create.mutateAsync(new CreateVehicleDto({ name: values.name, maxWeight }));
        enqueueSnackbar('Vůz přidán.', { variant: 'success' });
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
      title={editing ? 'Upravit vůz' : 'Nový vůz'}
      subtitle={editing ? vehicle?.name : 'Přidejte vozidlo do vozového parku.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Přidat vůz'}
    >
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            {...field}
            label="Název vozu"
            placeholder="Např. Mercedes Sprinter (SPZ)"
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            fullWidth
            autoFocus
          />
        )}
      />
      <Controller
        control={control}
        name="maxWeight"
        render={({ field }) => (
          <TextField
            {...field}
            label="Nosnost"
            type="number"
            error={Boolean(errors.maxWeight)}
            helperText={errors.maxWeight?.message ?? 'Volitelné — maximální užitečná hmotnost.'}
            fullWidth
            slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }}
          />
        )}
      />
    </FormDrawer>
  );
}
