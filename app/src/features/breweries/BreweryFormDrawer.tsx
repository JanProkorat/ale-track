import { useEffect, useState } from 'react';
import { useForm, Controller, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Stack, TextField, Typography, FormControlLabel, Switch } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { ColorSwatchPicker } from 'src/components/common/ColorSwatchPicker';
import { apiErrorMessage } from 'src/api/errors';
import { geocodeAddress, type LatLng } from 'src/lib/geo';
import { L, countryName } from 'src/lib/labels';
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
});
type AddressValues = z.infer<typeof addressSchema>;

/** Same shape as addressSchema but with no required-field checks. The contact
 * address is only filled in when the toggle is on, and it is validated there by
 * the superRefine below — requiring it in the base shape instead makes the blank
 * hidden fields fail validation, which silently blocks submit with the errors
 * attached to inputs that aren't rendered. */
const blankableAddressSchema = z.object({
  streetName: z.string(),
  streetNumber: z.string(),
  city: z.string(),
  zip: z.string(),
  country: z.string(),
});

const schema = z
  .object({
    name: z.string().trim().min(1, 'Zadejte název'),
    color: z.string().min(1, 'Vyberte barvu'),
    official: addressSchema,
    hasContact: z.boolean(),
    contact: blankableAddressSchema,
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

/** Keyed by enum member name, not numeric value: the API serializes enums as
 * their name, so that is what a loaded address carries. */
const COUNTRY_OPTIONS = Object.entries(L.country).map(([value, label]) => ({ value, label }));

const emptyAddr: AddressValues = {
  streetName: '', streetNumber: '', city: '', zip: '', country: Country[Country.Czechia],
};
const empty: FormValues = { name: '', color: '#C7911F', official: emptyAddr, hasContact: false, contact: emptyAddr };

function addrToForm(a: { streetName?: string; streetNumber?: string; city?: string; zip?: string; country?: Country } | undefined): AddressValues {
  if (!a) return emptyAddr;
  return {
    streetName: a.streetName ?? '', streetNumber: a.streetNumber ?? '', city: a.city ?? '', zip: a.zip ?? '',
    country: countryName(a.country) ?? Country[Country.Czechia],
  };
}
/** Coordinates are not entered by hand — they're geocoded from the address on
 * save (see submit). Pass the resolved coords (or the previously stored ones as
 * a fallback) so they persist on the entity. */
function toAddressDto(a: AddressValues, coords?: LatLng | null): AddressDto {
  return new AddressDto({
    streetName: a.streetName, streetNumber: a.streetNumber, city: a.city, zip: a.zip,
    country: Country[a.country as keyof typeof Country],
    latitude: coords?.lat, longitude: coords?.lng,
  });
}
function coordsOf(a: { latitude?: number; longitude?: number } | undefined): LatLng | null {
  return a && a.latitude != null && a.longitude != null ? { lat: a.latitude, lng: a.longitude } : null;
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
  const [geocoding, setGeocoding] = useState(false);

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
    // Coordinates are derived from the address, not entered by hand: geocode
    // each address on save and store the result; keep the previously stored
    // coords (edit) as a fallback so a known location is never lost.
    setGeocoding(true);
    let officialCoords: LatLng | null;
    let contactCoords: LatLng | null = null;
    try {
      [officialCoords, contactCoords] = await Promise.all([
        // The form already holds the enum member name, which is also the
        // English country name Nominatim understands.
        geocodeAddress(v.official),
        v.hasContact ? geocodeAddress(v.contact) : Promise.resolve(null),
      ]);
    } finally {
      setGeocoding(false);
    }
    officialCoords = officialCoords ?? coordsOf(brewery?.officialAddress);
    contactCoords = contactCoords ?? coordsOf(brewery?.contactAddress);
    if (!officialCoords) {
      enqueueSnackbar('Adresu se nepodařilo najít na mapě — GPS zůstane prázdné.', { variant: 'warning' });
    }

    const common = {
      name: v.name,
      color: v.color,
      officialAddress: toAddressDto(v.official, officialCoords),
      contactAddress: v.hasContact ? toAddressDto(v.contact, contactCoords) : undefined,
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

  const busy = geocoding || create.isPending || update.isPending;

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
