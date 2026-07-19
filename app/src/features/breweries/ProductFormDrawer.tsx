import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Stack, TextField, InputAdornment, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { KIND_OPTIONS, PTYPE_OPTIONS } from 'src/lib/enums';
import {
  CreateProductDto,
  CreateProductsDto,
  UpdateProductDto,
  ProductKind,
  ProductType,
  type BreweryProductListItemDto,
} from 'src/generated/api-client';
import { useCreateProducts, useUpdateProduct } from 'src/hooks/useBreweryProducts';

const numStr = (msg: string) =>
  z.string().refine((v) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0, msg);
const optNumStr = z
  .string()
  .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Zadejte kladné číslo');

const schema = z.object({
  name: z.string().trim().min(1, 'Zadejte název'),
  kind: z.string().min(1, 'Vyberte druh'),
  type: z.string().min(1, 'Vyberte typ'),
  packageSize: optNumStr,
  alcoholPercentage: optNumStr,
  platoDegree: optNumStr,
  priceWithVat: numStr('Zadejte cenu'),
  priceForUnitWithVat: numStr('Zadejte cenu za jednotku'),
  priceForUnitWithoutVat: numStr('Zadejte cenu bez DPH'),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  name: '', kind: '', type: '', packageSize: '', alcoholPercentage: '', platoDegree: '',
  priceWithVat: '', priceForUnitWithVat: '', priceForUnitWithoutVat: '', description: '',
};

function toForm(p: BreweryProductListItemDto): FormValues {
  const s = (n: number | undefined) => (n != null ? String(n) : '');
  return {
    name: p.name ?? '',
    kind: p.kind != null ? String(p.kind) : '',
    type: p.type != null ? String(p.type) : '',
    packageSize: s(p.packageSize),
    alcoholPercentage: s(p.alcoholPercentage),
    platoDegree: s(p.platoDegree),
    priceWithVat: s(p.priceWithVat),
    priceForUnitWithVat: s(p.priceForUnitWithVat),
    priceForUnitWithoutVat: s(p.priceForUnitWithoutVat),
    description: p.description ?? '',
  };
}

const optNum = (v: string) => (v === '' ? undefined : Number(v));

/** Add or edit a single ceník product for a brewery. */
export function ProductFormDrawer({
  open,
  breweryId,
  product,
  onClose,
}: {
  open: boolean;
  breweryId: string;
  product?: BreweryProductListItemDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateProducts(breweryId);
  const update = useUpdateProduct(breweryId);
  const editing = Boolean(product);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });

  useEffect(() => {
    if (open) reset(product ? toForm(product) : empty);
  }, [open, product, reset]);

  const submit = handleSubmit(async (v) => {
    const common = {
      name: v.name,
      description: v.description || undefined,
      kind: Number(v.kind) as ProductKind,
      type: Number(v.type) as ProductType,
      alcoholPercentage: optNum(v.alcoholPercentage),
      platoDegree: optNum(v.platoDegree),
      packageSize: optNum(v.packageSize),
      priceWithVat: Number(v.priceWithVat),
      priceForUnitWithVat: Number(v.priceForUnitWithVat),
      priceForUnitWithoutVat: Number(v.priceForUnitWithoutVat),
    };
    try {
      if (product?.id) {
        await update.mutateAsync({ id: product.id, data: new UpdateProductDto(common) });
        enqueueSnackbar('Produkt upraven.', { variant: 'success' });
      } else {
        await create.mutateAsync(new CreateProductsDto({ products: [new CreateProductDto(common)] }));
        enqueueSnackbar('Produkt přidán.', { variant: 'success' });
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
      title={editing ? 'Upravit produkt' : 'Nový produkt'}
      subtitle={editing ? product?.name : 'Přidejte položku do ceníku pivovaru.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Přidat produkt'}
      width={520}
    >
      <Controller control={control} name="name" render={({ field }) => (
        <TextField {...field} label="Název" error={Boolean(errors.name)} helperText={errors.name?.message} fullWidth autoFocus />
      )} />
      <Stack direction="row" spacing={2}>
        <Controller control={control} name="kind" render={({ field }) => (
          <Combobox label="Druh" value={field.value || null} onChange={(v) => field.onChange(v ?? '')}
            options={KIND_OPTIONS} error={Boolean(errors.kind)} helperText={errors.kind?.message} clearable={false} />
        )} />
        <Controller control={control} name="type" render={({ field }) => (
          <Combobox label="Typ" value={field.value || null} onChange={(v) => field.onChange(v ?? '')}
            options={PTYPE_OPTIONS} error={Boolean(errors.type)} helperText={errors.type?.message} clearable={false} />
        )} />
      </Stack>
      <Stack direction="row" spacing={2}>
        <Controller control={control} name="packageSize" render={({ field }) => (
          <TextField {...field} label="Balení" type="number" fullWidth
            error={Boolean(errors.packageSize)} helperText={errors.packageSize?.message ?? 'l / ks'}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">l</InputAdornment> } }} />
        )} />
        <Controller control={control} name="alcoholPercentage" render={({ field }) => (
          <TextField {...field} label="Alkohol" type="number" fullWidth
            error={Boolean(errors.alcoholPercentage)} helperText={errors.alcoholPercentage?.message}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} />
        )} />
        <Controller control={control} name="platoDegree" render={({ field }) => (
          <TextField {...field} label="Stupňovitost" type="number" fullWidth
            error={Boolean(errors.platoDegree)} helperText={errors.platoDegree?.message}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">°</InputAdornment> } }} />
        )} />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Ceny včetně/bez DPH</Typography>
      <Stack direction="row" spacing={2}>
        <Controller control={control} name="priceWithVat" render={({ field }) => (
          <TextField {...field} label="Cena za balení" type="number" fullWidth
            error={Boolean(errors.priceWithVat)} helperText={errors.priceWithVat?.message}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">Kč</InputAdornment> } }} />
        )} />
        <Controller control={control} name="priceForUnitWithVat" render={({ field }) => (
          <TextField {...field} label="Za jednotku s DPH" type="number" fullWidth
            error={Boolean(errors.priceForUnitWithVat)} helperText={errors.priceForUnitWithVat?.message}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">Kč</InputAdornment> } }} />
        )} />
        <Controller control={control} name="priceForUnitWithoutVat" render={({ field }) => (
          <TextField {...field} label="Za jednotku bez DPH" type="number" fullWidth
            error={Boolean(errors.priceForUnitWithoutVat)} helperText={errors.priceForUnitWithoutVat?.message}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">Kč</InputAdornment> } }} />
        )} />
      </Stack>
      <Controller control={control} name="description" render={({ field }) => (
        <TextField {...field} label="Popis" multiline minRows={2} fullWidth />
      )} />
    </FormDrawer>
  );
}
