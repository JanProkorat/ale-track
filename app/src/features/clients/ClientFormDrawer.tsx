import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Stack, TextField, Typography, FormControlLabel, Switch, IconButton, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { L, countryName, regionName } from 'src/lib/labels';
import { geocodeAddress, type LatLng } from 'src/lib/geo';
import {
  CreateClientDto,
  UpdateClientDto,
  CreateClientContactDto,
  UpdateClientContactDto,
  AddressDto,
  Country,
  Region,
  ContactType,
  type ClientDto,
} from 'src/generated/api-client';
import { useCreateClient, useUpdateClient } from 'src/hooks/useClients';

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

const contactSchema = z.object({
  type: z.string().min(1),
  description: z.string().optional(),
  value: z.string().optional(),
});

const schema = z
  .object({
    name: z.string().trim().min(1, 'Zadejte název'),
    businessName: z.string().optional(),
    region: z.string().min(1, 'Vyberte region'),
    official: addressSchema,
    hasContact: z.boolean(),
    contact: blankableAddressSchema,
    contacts: z.array(contactSchema),
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
 * their name, so that is what a loaded address carries. Same convention as the
 * region and contact-type selects below. */
const COUNTRY_OPTIONS = Object.entries(L.country).map(([value, label]) => ({ value, label }));
const REGION_OPTIONS = Object.entries(L.region).map(([value, label]) => ({ value, label }));
const CONTACT_TYPE_OPTIONS = Object.entries(L.contact).map(([value, label]) => ({ value, label }));

const emptyAddr: AddressValues = {
  streetName: '', streetNumber: '', city: '', zip: '', country: Country[Country.Czechia],
};
const empty: FormValues = {
  name: '', businessName: '', region: 'ZittauCity', official: emptyAddr, hasContact: false, contact: emptyAddr, contacts: [],
};

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

/** Reusable address field block bound to a react-hook-form path prefix —
 * same shape as BreweryFormDrawer's AddressFields, duplicated here since it's
 * typed against that component's own FormValues. */
function AddressFields({ control, prefix, errors }: {
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

export function ClientFormDrawer({ open, client, onClose }: {
  open: boolean;
  client?: ClientDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateClient();
  const update = useUpdateClient();
  const editing = Boolean(client);
  const [geocoding, setGeocoding] = useState(false);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });
  const hasContact = watch('hasContact');
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  useEffect(() => {
    if (!open) return;
    reset(
      client
        ? {
            name: client.name ?? '',
            businessName: client.businessName ?? '',
            region: regionName(client.region) ?? 'ZittauCity',
            official: addrToForm(client.officialAddress),
            hasContact: Boolean(client.contactAddress),
            contact: addrToForm(client.contactAddress),
            contacts: (client.contacts ?? []).map((c) => ({
              type: c.type != null ? ContactType[c.type] : 'Phone',
              description: c.description ?? '',
              value: c.value ?? '',
            })),
          }
        : empty
    );
  }, [open, client, reset]);

  const submit = handleSubmit(async (v) => {
    const contactsPayload = v.contacts
      .filter((c) => c.value?.trim())
      .map((c) => ({
        type: ContactType[c.type as keyof typeof ContactType] as ContactType,
        description: c.description?.trim() || undefined,
        value: c.value!.trim(),
      }));

    // Coordinates are derived from the address, not entered by hand: geocode
    // each address on save and store the result. If geocoding fails, keep the
    // previously stored coords (edit) so we never lose a known location.
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
    officialCoords = officialCoords ?? coordsOf(client?.officialAddress);
    contactCoords = contactCoords ?? coordsOf(client?.contactAddress);
    if (!officialCoords) {
      enqueueSnackbar('Adresu se nepodařilo najít na mapě — GPS zůstane prázdné.', { variant: 'warning' });
    }

    const common = {
      name: v.name,
      businessName: v.businessName?.trim() || undefined,
      region: Region[v.region as keyof typeof Region] as Region,
      officialAddress: toAddressDto(v.official, officialCoords),
      contactAddress: v.hasContact ? toAddressDto(v.contact, contactCoords) : undefined,
    };
    try {
      if (client?.id) {
        await update.mutateAsync({
          id: client.id,
          data: new UpdateClientDto({ ...common, contacts: contactsPayload.map((c) => new UpdateClientContactDto(c)) }),
        });
        enqueueSnackbar('Klient upraven.', { variant: 'success' });
      } else {
        await create.mutateAsync(
          new CreateClientDto({ ...common, contacts: contactsPayload.map((c) => new CreateClientContactDto(c)) })
        );
        enqueueSnackbar('Klient přidán.', { variant: 'success' });
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
      title={editing ? 'Upravit klienta' : 'Nový klient'}
      subtitle={editing ? client?.name : 'Přidejte klienta, jeho adresu a kontakty.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Přidat klienta'}
      width={560}
    >
      <Controller control={control} name="name" render={({ field }) => (
        <TextField {...field} label="Název" fullWidth autoFocus placeholder="Hospoda U…" error={Boolean(errors.name)} helperText={errors.name?.message} />
      )} />
      <Controller control={control} name="businessName" render={({ field }) => (
        <TextField {...field} label="Obchodní název" fullWidth placeholder="s.r.o." />
      )} />
      <Controller control={control} name="region" render={({ field }) => (
        <Combobox label="Region" value={field.value || null} onChange={(v) => field.onChange(v ?? '')}
          options={REGION_OPTIONS} clearable={false} error={Boolean(errors.region)} helperText={errors.region?.message} />
      )} />

      <Typography variant="subtitle2" sx={{ mt: 1 }}>Fakturační adresa</Typography>
      <AddressFields control={control} prefix="official" errors={errors} />

      <FormControlLabel
        control={<Controller control={control} name="hasContact" render={({ field }) => (
          <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
        )} />}
        label="Odlišná kontaktní adresa"
      />
      {hasContact && (
        <>
          <Typography variant="subtitle2">Kontaktní adresa</Typography>
          <AddressFields control={control} prefix="contact" errors={errors} />
        </>
      )}

      <Typography variant="subtitle2" sx={{ mt: 1 }}>Kontakty</Typography>
      <Stack spacing={1.25}>
        {fields.length === 0 && (
          <Typography variant="body2" color="text.secondary">Zatím žádné kontakty.</Typography>
        )}
        {fields.map((f, i) => (
          <Stack key={f.id} direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ width: 130, flexShrink: 0 }}>
              <Controller control={control} name={`contacts.${i}.type`} render={({ field }) => (
                <Combobox value={field.value || null} onChange={(v) => field.onChange(v ?? 'Phone')}
                  options={CONTACT_TYPE_OPTIONS} clearable={false} />
              )} />
            </Box>
            <Controller control={control} name={`contacts.${i}.description`} render={({ field }) => (
              <TextField {...field} label="Popis" size="small" sx={{ width: 140, flexShrink: 0 }} />
            )} />
            <Controller control={control} name={`contacts.${i}.value`} render={({ field }) => (
              <TextField {...field} label="Hodnota" size="small" fullWidth />
            )} />
            <IconButton onClick={() => remove(i)} sx={{ mt: 0.5, flexShrink: 0 }} aria-label="Odebrat kontakt">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => append({ type: 'Phone', description: '', value: '' })}
          sx={{ alignSelf: 'flex-start', color: 'text.primary', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}
        >
          Přidat kontakt
        </Button>
      </Stack>
    </FormDrawer>
  );
}
