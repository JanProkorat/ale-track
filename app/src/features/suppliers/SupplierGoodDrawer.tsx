import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import { L, chargeKindName } from 'src/lib/labels';
import {
  SupplierChargeKind, SupplierGoodPriceUpsertDto, SupplierGoodUpsertDto,
  type SupplierGoodDto,
} from 'src/generated/api-client';
import { useCreateSupplierGood, useUpdateSupplierGood } from 'src/hooks/useSuppliers';
import { CHARGE_ORDER } from './supplierGoods';

/** Charge-kind options in reading order, keyed by enum member name like every other select. */
const CHARGE_OPTIONS = CHARGE_ORDER.map((k) => ({
  value: SupplierChargeKind[k],
  label: L.chargeKind[SupplierChargeKind[k]] ?? SupplierChargeKind[k],
}));

const priceSchema = z.object({
  kind: z.string().min(1),
  // Kept as strings: an empty numeric input is '' rather than 0, and treating a blank as
  // free is exactly the mistake this guards.
  priceWithVat: z.string().trim().min(1, 'Cena s DPH'),
  priceWithoutVat: z.string().optional(),
  note: z.string().optional(),
});

const schema = z
  .object({
    name: z.string().trim().min(1, 'Zadejte název'),
    size: z.string().optional(),
    description: z.string().optional(),
    prices: z.array(priceSchema).min(1, 'Zadejte alespoň jednu cenu'),
  })
  .superRefine((val, ctx) => {
    // Mirrors the unique (good, kind) index. Without it the save comes back 400 with the
    // message attached to nothing the user can see.
    const kinds = val.prices.map((p) => p.kind);
    if (new Set(kinds).size !== kinds.length) {
      ctx.addIssue({ code: 'custom', path: ['prices'], message: 'Každý účel může mít jen jednu cenu.' });
    }
    val.prices.forEach((p, i) => {
      if (p.priceWithVat && Number.isNaN(Number(p.priceWithVat))) {
        ctx.addIssue({ code: 'custom', path: ['prices', i, 'priceWithVat'], message: 'Zadejte číslo' });
      }
      if (p.priceWithVat && Number(p.priceWithVat) < 0) {
        ctx.addIssue({ code: 'custom', path: ['prices', i, 'priceWithVat'], message: 'Nesmí být záporná' });
      }
      if (p.priceWithoutVat?.trim() && Number.isNaN(Number(p.priceWithoutVat))) {
        ctx.addIssue({ code: 'custom', path: ['prices', i, 'priceWithoutVat'], message: 'Zadejte číslo' });
      }
    });
  });

type FormValues = z.infer<typeof schema>;

const emptyPrice = {
  kind: SupplierChargeKind[SupplierChargeKind.Fill],
  priceWithVat: '',
  priceWithoutVat: '',
  note: '',
};
const empty: FormValues = { name: '', size: '', description: '', prices: [emptyPrice] };

/** A price-list item and its charge kinds, edited as one thing and saved in one call. */
export function SupplierGoodDrawer({
  open,
  supplierId,
  good,
  onClose,
}: {
  open: boolean;
  supplierId: string;
  /** Undefined when adding. */
  good?: SupplierGoodDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateSupplierGood();
  const update = useUpdateSupplierGood();
  const editing = Boolean(good);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'prices' });

  useEffect(() => {
    if (!open) return;
    reset(
      good
        ? {
            name: good.name ?? '',
            size: good.size ?? '',
            description: good.description ?? '',
            prices: (good.prices ?? []).map((p) => ({
              // Arrives as the member name ("Fill"), so indexing the enum with it would
              // yield the number and never match an option's value.
              kind: chargeKindName(p.kind) ?? SupplierChargeKind[SupplierChargeKind.Fill],
              priceWithVat: p.priceWithVat != null ? String(p.priceWithVat) : '',
              priceWithoutVat: p.priceWithoutVat != null ? String(p.priceWithoutVat) : '',
              note: p.note ?? '',
            })),
          }
        : empty,
    );
  }, [open, good, reset]);

  const submit = handleSubmit(async (v) => {
    const payload = new SupplierGoodUpsertDto({
      name: v.name.trim(),
      size: v.size?.trim() || undefined,
      description: v.description?.trim() || undefined,
      prices: v.prices.map(
        (p) =>
          new SupplierGoodPriceUpsertDto({
            kind: SupplierChargeKind[p.kind as keyof typeof SupplierChargeKind],
            priceWithVat: Number(p.priceWithVat),
            priceWithoutVat: p.priceWithoutVat?.trim() ? Number(p.priceWithoutVat) : undefined,
            note: p.note?.trim() || undefined,
          }),
      ),
    });

    try {
      if (good?.id) {
        await update.mutateAsync({ supplierId, goodId: good.id, data: payload });
        enqueueSnackbar('Zboží upraveno.', { variant: 'success' });
      } else {
        await create.mutateAsync({ id: supplierId, data: payload });
        enqueueSnackbar('Zboží přidáno.', { variant: 'success' });
      }
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  });

  return (
    <FormDrawer
      open={open}
      title={editing ? 'Upravit zboží' : 'Nové zboží'}
      subtitle={editing ? good?.name : 'Jedna cena za každý účel — plnění, nákup, záloha, nájem.'}
      onClose={onClose}
      onSubmit={submit}
      busy={create.isPending || update.isPending}
      submitLabel={editing ? 'Uložit změny' : 'Přidat zboží'}
      width={620}
    >
      <Stack direction="row" spacing={2}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              {...field}
              label="Název"
              fullWidth
              autoFocus
              placeholder="CO₂ láhev"
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="size"
          render={({ field }) => (
            <TextField
              {...field}
              label="Velikost"
              sx={{ width: 160, flexShrink: 0 }}
              placeholder="10 kg"
              helperText="Jak ji uvádí dodavatel"
            />
          )}
        />
      </Stack>

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField {...field} label="Popis" fullWidth placeholder="Potravinářský CO₂ E290, závit W21,8" />
        )}
      />

      <Typography variant="subtitle2" sx={{ mt: 1 }}>Ceny</Typography>
      {errors.prices?.message && (
        <Typography variant="body2" color="error">{errors.prices.message}</Typography>
      )}

      <Stack spacing={1.25}>
        {fields.map((f, i) => (
          <Stack key={f.id} direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ width: 130, flexShrink: 0 }}>
              <Controller
                control={control}
                name={`prices.${i}.kind`}
                render={({ field }) => (
                  <Combobox
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? SupplierChargeKind[SupplierChargeKind.Fill])}
                    options={CHARGE_OPTIONS}
                    clearable={false}
                  />
                )}
              />
            </Box>
            <Controller
              control={control}
              name={`prices.${i}.priceWithVat`}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="s DPH"
                  size="small"
                  sx={{ width: 120, flexShrink: 0 }}
                  error={Boolean(errors.prices?.[i]?.priceWithVat)}
                  helperText={errors.prices?.[i]?.priceWithVat?.message}
                />
              )}
            />
            <Controller
              control={control}
              name={`prices.${i}.priceWithoutVat`}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="bez DPH"
                  size="small"
                  sx={{ width: 120, flexShrink: 0 }}
                  error={Boolean(errors.prices?.[i]?.priceWithoutVat)}
                  helperText={errors.prices?.[i]?.priceWithoutVat?.message}
                />
              )}
            />
            <Controller
              control={control}
              name={`prices.${i}.note`}
              render={({ field }) => <TextField {...field} label="Poznámka" size="small" fullWidth />}
            />
            <IconButton
              onClick={() => remove(i)}
              disabled={fields.length === 1}
              aria-label="Odebrat cenu"
              sx={{ mt: 0.5, flexShrink: 0 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}

        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => append(emptyPrice)}
          sx={{
            alignSelf: 'flex-start', color: 'text.primary', borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
          }}
        >
          Přidat cenu
        </Button>
      </Stack>
    </FormDrawer>
  );
}
