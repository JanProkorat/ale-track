import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Stack, TextField, InputAdornment, Typography, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { CONTAINER_OPTIONS, SALE_UNIT_OPTIONS, PTYPE_OPTIONS } from 'src/lib/enums';
import { containerValue, saleUnitValue, packagingLabel } from 'src/lib/labels';
import {
  CreateProductDto,
  CreateProductsDto,
  UpdateProductDto,
  ProductContainer,
  ProductSaleUnit,
  ProductType,
  type BreweryProductListItemDto,
} from 'src/generated/api-client';
import { useCreateProducts, useUpdateProduct } from 'src/hooks/useBreweryProducts';

const numStr = (msg: string) =>
  z.string().refine((v) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0, msg);
const optNumStr = z
  .string()
  .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Zadejte kladné číslo');

const intStr = (msg: string) =>
  z.string().refine((v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 1, msg);

const schema = z.object({
  name: z.string().trim().min(1, 'Zadejte název'),
  container: z.string().min(1, 'Vyberte obal'),
  saleUnit: z.string().min(1, 'Vyberte prodejní jednotku'),
  unitsPerPackage: intStr('Zadejte počet kusů (min. 1)'),
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
  name: '', container: '', saleUnit: '', unitsPerPackage: '1', type: '', packageSize: '',
  alcoholPercentage: '', platoDegree: '',
  priceWithVat: '', priceForUnitWithVat: '', priceForUnitWithoutVat: '', description: '',
};

function toForm(p: BreweryProductListItemDto): FormValues {
  const s = (n: number | undefined) => (n != null ? String(n) : '');
  // Through containerValue/saleUnitValue rather than String(p.container): the API sends the
  // enum by name, which would never match an option keyed by the numeric member.
  const container = containerValue(p.container);
  const saleUnit = saleUnitValue(p.saleUnit);
  return {
    name: p.name ?? '',
    container: container != null ? String(container) : '',
    saleUnit: saleUnit != null ? String(saleUnit) : '',
    unitsPerPackage: p.unitsPerPackage != null ? String(p.unitsPerPackage) : '1',
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
  onRequestDelete,
}: {
  open: boolean;
  breweryId: string;
  product?: BreweryProductListItemDto;
  onClose: () => void;
  onRequestDelete?: () => void;
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

  const [container, saleUnit, packageSize, unitsPerPackage] = useWatch({
    control,
    name: ['container', 'saleUnit', 'packageSize', 'unitsPerPackage'],
  });
  const packagingPreview = packagingLabel(
    container ? Number(container) : undefined,
    saleUnit ? Number(saleUnit) : undefined,
    packageSize !== '' ? Number(packageSize) : undefined,
    unitsPerPackage !== '' ? Number(unitsPerPackage) : undefined,
  );

  const submit = handleSubmit(async (v) => {
    const common = {
      name: v.name,
      description: v.description || undefined,
      container: Number(v.container) as ProductContainer,
      saleUnit: Number(v.saleUnit) as ProductSaleUnit,
      unitsPerPackage: Number(v.unitsPerPackage),
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
        <Controller control={control} name="container" render={({ field }) => (
          <Combobox label="Obal" value={field.value || null} onChange={(v) => field.onChange(v ?? '')}
            options={CONTAINER_OPTIONS} error={Boolean(errors.container)} helperText={errors.container?.message}
            clearable={false} />
        )} />
        <Controller control={control} name="saleUnit" render={({ field }) => (
          <Combobox label="Prodejní jednotka" value={field.value || null} onChange={(v) => field.onChange(v ?? '')}
            options={SALE_UNIT_OPTIONS} error={Boolean(errors.saleUnit)} helperText={errors.saleUnit?.message}
            clearable={false} />
        )} />
        <Controller control={control} name="type" render={({ field }) => (
          <Combobox label="Typ" value={field.value || null} onChange={(v) => field.onChange(v ?? '')}
            options={PTYPE_OPTIONS} error={Boolean(errors.type)} helperText={errors.type?.message} clearable={false} />
        )} />
      </Stack>
      <Stack direction="row" spacing={2}>
        <Controller control={control} name="packageSize" render={({ field }) => (
          <TextField {...field} label="Objem obalu" type="number" fullWidth
            error={Boolean(errors.packageSize)}
            helperText={errors.packageSize?.message ?? 'objem jednoho obalu'}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">l</InputAdornment> } }} />
        )} />
        <Controller control={control} name="unitsPerPackage" render={({ field }) => (
          <TextField {...field} label="Kusů v balení" type="number" fullWidth
            error={Boolean(errors.unitsPerPackage)}
            helperText={errors.unitsPerPackage?.message ?? '20 = basa, 1 = sud'}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">ks</InputAdornment> } }} />
        )} />
      </Stack>
      {/* Says back what the three fields above add up to. The old form had a single "Balení"
          field meaning litres-per-container, so a 2 l can and a 20×0,5 l basa looked alike. */}
      <Typography variant="caption" color="text.secondary">
        Jedna prodejní jednotka: <strong>{packagingPreview}</strong>
      </Typography>
      <Stack direction="row" spacing={2}>
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
      {/* Editing a product no longer restates history — invoices and report lines carry what was
          true at the time. Said plainly, because the old behaviour was silent and the new one is
          just as invisible without it. */}
      {editing && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Změna se nepromítne do vystavených faktur ani do historie reportů — ty nesou údaje
          platné v době vývozu.
        </Typography>
      )}
      {editing && onRequestDelete && (
        <Button color="error" startIcon={<DeleteIcon />} onClick={onRequestDelete} sx={{ alignSelf: 'flex-start' }}>
          Smazat produkt
        </Button>
      )}
    </FormDrawer>
  );
}
