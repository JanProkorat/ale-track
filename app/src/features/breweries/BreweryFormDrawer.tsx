import { useEffect } from 'react';
import { useForm, Controller, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Stack, TextField, Typography, FormControlLabel, Switch } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { ColorSwatchPicker } from 'src/components/common/ColorSwatchPicker';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateBreweryDto, UpdateBreweryDto, AddressDto, Country, type BreweryDto,
} from 'src/generated/api-client';
import { useCreateBrewery, useUpdateBrewery } from 'src/hooks/useBreweries';

const addressSchema = z.object({
  streetName: z.string().trim().min(1, 'Ulice'),
  streetNumber: z.string().trim().min(1, 'Č.p.'),
  city: z.string().trim().min(1, 'Město'),
  zip: z.string().trim().min(1, 'PSČ'),
  country: z.string().min(1, 'Země'),
  latitude: z.string().refine((v) => v === '' || Number.isFinite(Number(v)), 'Číslo'),
  longitude: z.string().refine((v) => v === '' || Number.isFinite(Number(v)), 'Číslo'),
});
type AddressValues = z.infer<typeof addressSchema>;

const schema = z
  .object({
    name: z.string().trim().min(1, 'Zadejte název'),
    color: z.string().min(1, 'Vyberte barvu'),
    official: addressSchema,
    hasContact: z.boolean(),
    contact: addressSchema,
  })
  .superRefine((val, ctx) => {
    if (val.hasContact) {
      const r = addressSchema.safeParse(val.contact);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['contact', ...issue.path] });
        }
      }
    }
  });
type FormValues = z.infer<typeof schema>;

const COUNTRY_OPTIONS = [
  { value: String(Country.Czechia), label: 'Česko' },
  { value: String(Country.Germany), label: 'Německo' },
];

const emptyAddr: AddressValues = {
  streetName: '', streetNumber: '', city: '', zip: '', country: String(Country.Czechia), latitude: '', longitude: '',
};
const empty: FormValues = { name: '', color: '#C7911F', official: emptyAddr, hasContact: false, contact: emptyAddr };

function addrToForm(a: { streetName?: string; streetNumber?: string; city?: string; zip?: string; country?: Country; latitude?: number; longitude?: number } | undefined): AddressValues {
  if (!a) return emptyAddr;
  return {
    streetName: a.streetName ?? '', streetNumber: a.streetNumber ?? '', city: a.city ?? '', zip: a.zip ?? '',
    country: a.country != null ? String(a.country) : String(Country.Czechia),
    latitude: a.latitude != null ? String(a.latitude) : '', longitude: a.longitude != null ? String(a.longitude) : '',
  };
}
function toAddressDto(a: AddressValues): AddressDto {
  return new AddressDto({
    streetName: a.streetName, streetNumber: a.streetNumber, city: a.city, zip: a.zip,
    country: Number(a.country) as Country,
    latitude: a.latitude === '' ? undefined : Number(a.latitude),
    longitude: a.longitude === '' ? undefined : Number(a.longitude),
  });
}

/** Reusable address field block bound to a react-hook-form path prefix. */
export function AddressFields({ control, prefix, errors }: {
  control: Control<FormValues>;
  prefix: 'official' | 'contact';
  errors: FieldErrors<FormValues>;
}) {
  const e = errors[prefix];
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2}>
        <Controller control={control} name={`${prefix}.streetName`} render={({ field }) => (
          <TextField {...field} label="Ulice" fullWidth error={Boolean(e?.streetName)} helperText={e?.streetName?.message} />
        )} />
        <Controller control={control} name={`${prefix}.streetNumber`} render={({ field }) => (
          <TextField {...field} label="Č.p." sx={{ maxWidth: 120 }} error={Boolean(e?.streetNumber)} helperText={e?.streetNumber?.message} />
        )} />
      </Stack>
      <Stack direction="row" spacing={2}>
        <Controller control={control} name={`${prefix}.city`} render={({ field }) => (
          <TextField {...field} label="Město" fullWidth error={Boolean(e?.city)} helperText={e?.city?.message} />
        )} />
        <Controller control={control} name={`${prefix}.zip`} render={({ field }) => (
          <TextField {...field} label="PSČ" sx={{ maxWidth: 140 }} error={Boolean(e?.zip)} helperText={e?.zip?.message} />
        )} />
      </Stack>
      <Controller control={control} name={`${prefix}.country`} render={({ field }) => (
        <Combobox label="Země" value={field.value || null} onChange={(v) => field.onChange(v ?? '')}
          options={COUNTRY_OPTIONS} clearable={false} error={Boolean(e?.country)} helperText={e?.country?.message} />
      )} />
      <Stack direction="row" spacing={2}>
        <Controller control={control} name={`${prefix}.latitude`} render={({ field }) => (
          <TextField {...field} label="Zeměpisná šířka" type="number" fullWidth error={Boolean(e?.latitude)}
            helperText={e?.latitude?.message ?? 'Volitelné — pro mapu'} />
        )} />
        <Controller control={control} name={`${prefix}.longitude`} render={({ field }) => (
          <TextField {...field} label="Zeměpisná délka" type="number" fullWidth error={Boolean(e?.longitude)}
            helperText={e?.longitude?.message ?? 'Volitelné'} />
        )} />
      </Stack>
    </Stack>
  );
}

const BREWERY_COLORS = ['#C7911F', '#2F6F4E', '#8B3A3A', '#1971C2', '#9C36B5', '#E8590C', '#0C8599', '#495057'];

export function BreweryFormDrawer({ open, brewery, onClose }: {
  open: boolean;
  brewery?: BreweryDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateBrewery();
  const update = useUpdateBrewery();
  const editing = Boolean(brewery);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });
  const hasContact = watch('hasContact');

  useEffect(() => {
    if (!open) return;
    reset(
      brewery
        ? {
            name: brewery.name ?? '',
            color: brewery.color ?? '#C7911F',
            official: addrToForm(brewery.officialAddress),
            hasContact: Boolean(brewery.contactAddress),
            contact: addrToForm(brewery.contactAddress),
          }
        : empty
    );
  }, [open, brewery, reset]);

  const submit = handleSubmit(async (v) => {
    const common = {
      name: v.name,
      color: v.color,
      officialAddress: toAddressDto(v.official),
      contactAddress: v.hasContact ? toAddressDto(v.contact) : undefined,
    };
    try {
      if (brewery?.id) {
        await update.mutateAsync({ id: brewery.id, data: new UpdateBreweryDto(common) });
        enqueueSnackbar('Pivovar upraven.', { variant: 'success' });
      } else {
        await create.mutateAsync(new CreateBreweryDto(common));
        enqueueSnackbar('Pivovar přidán.', { variant: 'success' });
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
      title={editing ? 'Upravit pivovar' : 'Nový pivovar'}
      subtitle={editing ? brewery?.name : 'Přidejte pivovar a jeho adresu.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Přidat pivovar'}
      width={520}
    >
      <Controller control={control} name="name" render={({ field }) => (
        <TextField {...field} label="Název pivovaru" fullWidth autoFocus error={Boolean(errors.name)} helperText={errors.name?.message} />
      )} />
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Barva (pro odlišení)</Typography>
        <Controller control={control} name="color" render={({ field }) => (
          <ColorSwatchPicker value={field.value} onChange={field.onChange} colors={BREWERY_COLORS} />
        )} />
      </Box>
      <Typography variant="subtitle2" sx={{ mt: 1 }}>Fakturační adresa</Typography>
      <AddressFields control={control} prefix="official" errors={errors} />
      <FormControlLabel
        control={<Controller control={control} name="hasContact" render={({ field }) => (
          <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
        )} />}
        label="Kontaktní adresa se liší"
      />
      {hasContact && (
        <>
          <Typography variant="subtitle2">Kontaktní adresa</Typography>
          <AddressFields control={control} prefix="contact" errors={errors} />
        </>
      )}
    </FormDrawer>
  );
}
