import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Button, FormControlLabel, IconButton, Stack, Switch, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { L, countryName } from 'src/lib/labels';
import { geocodeAddress, type LatLng } from 'src/lib/geo';
import {
  AddressDto, ContactType, Country, CreateSupplierDto, SupplierContactUpsertDto,
  UpdateSupplierDto, type SupplierDto,
} from 'src/generated/api-client';
import { useCreateSupplier, useUpdateSupplier } from 'src/hooks/useSuppliers';

const addressSchema = z.object({
  streetName: z.string().trim().min(1, 'Ulice'),
  streetNumber: z.string().trim().min(1, 'Č.p.'),
  city: z.string().trim().min(1, 'Město'),
  zip: z.string().trim().min(1, 'PSČ'),
  country: z.string().min(1, 'Země'),
});
type AddressValues = z.infer<typeof addressSchema>;

/** Same fields with no required checks — the branch address is only validated when its
 * toggle is on, and requiring it in the base shape blocks submit with errors attached to
 * inputs that are not rendered. Same reasoning as ClientFormDrawer. */
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
    note: z.string().optional(),
    official: addressSchema,
    hasBranch: z.boolean(),
    branch: blankableAddressSchema,
    contacts: z.array(contactSchema),
  })
  .superRefine((val, ctx) => {
    if (val.hasBranch) {
      const r = addressSchema.safeParse(val.branch);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['branch', ...issue.path] });
        }
      }
    }
  });
type FormValues = z.infer<typeof schema>;

const COUNTRY_OPTIONS = Object.entries(L.country).map(([value, label]) => ({ value, label }));
const CONTACT_TYPE_OPTIONS = Object.entries(L.contact).map(([value, label]) => ({ value, label }));

const emptyAddr: AddressValues = {
  streetName: '', streetNumber: '', city: '', zip: '', country: Country[Country.Czechia],
};
const empty: FormValues = {
  name: '', businessName: '', note: '', official: emptyAddr, hasBranch: false, branch: emptyAddr, contacts: [],
};

function addrToForm(a: AddressDto | undefined): AddressValues {
  if (!a) return emptyAddr;
  return {
    streetName: a.streetName ?? '', streetNumber: a.streetNumber ?? '', city: a.city ?? '',
    zip: a.zip ?? '', country: countryName(a.country) ?? Country[Country.Czechia],
  };
}

function toAddressDto(a: AddressValues, coords?: LatLng | null): AddressDto {
  return new AddressDto({
    streetName: a.streetName, streetNumber: a.streetNumber, city: a.city, zip: a.zip,
    country: Country[a.country as keyof typeof Country],
    latitude: coords?.lat, longitude: coords?.lng,
  });
}

function coordsOf(a: AddressDto | undefined): LatLng | null {
  return a && a.latitude != null && a.longitude != null ? { lat: a.latitude, lng: a.longitude } : null;
}

/** Address block bound to a form path prefix — same shape as the client and brewery
 * drawers, typed against this component's own values. */
function AddressFields({ control, prefix, errors }: {
  control: Control<FormValues>;
  prefix: 'official' | 'branch';
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

export function SupplierFormDrawer({ open, supplier, onClose }: {
  open: boolean;
  supplier?: SupplierDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const editing = Boolean(supplier);
  const [geocoding, setGeocoding] = useState(false);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });
  const hasBranch = watch('hasBranch');
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  useEffect(() => {
    if (!open) return;
    reset(
      supplier
        ? {
            name: supplier.name ?? '',
            businessName: supplier.businessName ?? '',
            note: supplier.note ?? '',
            official: addrToForm(supplier.officialAddress),
            hasBranch: Boolean(supplier.contactAddress),
            branch: addrToForm(supplier.contactAddress),
            contacts: (supplier.contacts ?? []).map((c) => ({
              type: c.type != null ? ContactType[c.type] : 'Phone',
              description: c.description ?? '',
              value: c.value ?? '',
            })),
          }
        : empty,
    );
  }, [open, supplier, reset]);

  const submit = handleSubmit(async (v) => {
    const contacts = v.contacts
      .filter((c) => c.value?.trim())
      .map((c) => new SupplierContactUpsertDto({
        type: ContactType[c.type as keyof typeof ContactType] as ContactType,
        description: c.description?.trim() || undefined,
        value: c.value!.trim(),
      }));

    // Coordinates come from geocoding the address, never from typing — same as clients.
    // A failed lookup keeps whatever was stored, so an edit cannot lose a known location.
    setGeocoding(true);
    let officialCoords: LatLng | null;
    let branchCoords: LatLng | null = null;
    try {
      [officialCoords, branchCoords] = await Promise.all([
        geocodeAddress(v.official),
        v.hasBranch ? geocodeAddress(v.branch) : Promise.resolve(null),
      ]);
    } finally {
      setGeocoding(false);
    }
    officialCoords = officialCoords ?? coordsOf(supplier?.officialAddress);
    branchCoords = branchCoords ?? coordsOf(supplier?.contactAddress);
    if (!officialCoords) {
      enqueueSnackbar('Adresu se nepodařilo najít na mapě — GPS zůstane prázdné.', { variant: 'warning' });
    }

    const common = {
      name: v.name.trim(),
      businessName: v.businessName?.trim() || undefined,
      note: v.note?.trim() || undefined,
      officialAddress: toAddressDto(v.official, officialCoords),
      // Untoggling clears it: the update endpoint assigns this unconditionally.
      contactAddress: v.hasBranch ? toAddressDto(v.branch, branchCoords) : undefined,
      contacts,
    };

    try {
      if (supplier?.id) {
        await update.mutateAsync({ id: supplier.id, data: new UpdateSupplierDto(common) });
        enqueueSnackbar('Dodavatel upraven.', { variant: 'success' });
      } else {
        await create.mutateAsync(new CreateSupplierDto(common));
        enqueueSnackbar('Dodavatel přidán.', { variant: 'success' });
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
      title={editing ? 'Upravit dodavatele' : 'Nový dodavatel'}
      subtitle={editing ? supplier?.name : 'Přidejte firmu, její adresu a kontakty. Ceník a otevírací dobu doplníte potom.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Přidat dodavatele'}
      width={560}
    >
      <Controller control={control} name="name" render={({ field }) => (
        <TextField {...field} label="Název" fullWidth autoFocus placeholder="Linde Gas — plnírna Liberec"
          error={Boolean(errors.name)} helperText={errors.name?.message} />
      )} />
      <Controller control={control} name="businessName" render={({ field }) => (
        <TextField {...field} label="Obchodní název" fullWidth placeholder="Linde Gas a.s." />
      )} />
      <Controller control={control} name="note" render={({ field }) => (
        <TextField {...field} label="Provozní poznámka" fullWidth multiline minRows={2}
          placeholder="Kam se hlásit, jak se platí…" helperText="Co má řidič vědět, než tam vyrazí." />
      )} />

      <Typography variant="subtitle2" sx={{ mt: 1 }}>Fakturační adresa</Typography>
      <AddressFields control={control} prefix="official" errors={errors} />

      <FormControlLabel
        control={<Controller control={control} name="hasBranch" render={({ field }) => (
          <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
        )} />}
        label="Provozovna je na jiné adrese"
      />
      {hasBranch && (
        <>
          <Typography variant="subtitle2">Adresa provozovny</Typography>
          <AddressFields control={control} prefix="branch" errors={errors} />
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
          sx={{
            alignSelf: 'flex-start', color: 'text.primary', borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
          }}
        >
          Přidat kontakt
        </Button>
      </Stack>
    </FormDrawer>
  );
}
