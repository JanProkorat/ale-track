import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  type InventoryItemListItemDto,
} from 'src/generated/api-client';
import { useCreateInventoryItem, useUpdateInventoryItem } from 'src/hooks/useInventory';
import { useProducts } from 'src/hooks/useProducts';

/** Schema depends on mode: create requires a product, edit keeps the product
 * fixed (only quantity/note change) so `productId` is optional there.
 * `quantity` is kept as a string field (like VehicleFormDrawer's maxWeight)
 * and converted with `Number()` on submit — number-typed fields don't mix
 * well with a conditional (non-literal `editing`) schema shape. */
function makeSchema(editing: boolean) {
  return z.object({
    productId: editing ? z.string().optional() : z.string().trim().min(1, 'Vyberte produkt'),
    quantity: z
      .string()
      .refine((v) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0, 'Zadejte nezáporné množství'),
    note: z.string().optional(),
  });
}
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const empty: FormValues = { productId: '', quantity: '0', note: '' };

function toForm(item: InventoryItemListItemDto): FormValues {
  return {
    productId: item.productId ?? '',
    quantity: String(item.quantity ?? 0),
    note: item.note ?? '',
  };
}

/** Create/edit an inventory item (Sklad). `item` undefined → create mode
 * (pick a product to stock); otherwise edit mode (quantity + note only). */
export function InventoryItemFormDrawer({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item?: InventoryItemListItemDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateInventoryItem();
  const update = useUpdateInventoryItem();
  const productsQuery = useProducts();
  const editing = Boolean(item);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(makeSchema(editing)), defaultValues: empty });

  useEffect(() => {
    if (open) reset(item ? toForm(item) : empty);
  }, [open, item, reset]);

  const productOptions: ComboOption[] = (productsQuery.data ?? []).map((p) => ({
    value: p.id ?? '',
    label: `${p.name ?? '—'} — ${p.breweryName ?? ''}`,
    group: p.breweryName,
  }));

  const submit = handleSubmit(async (values) => {
    const quantity = Number(values.quantity);
    try {
      if (item?.id) {
        await update.mutateAsync({
          id: item.id,
          data: new UpdateInventoryItemDto({
            productId: item.productId,
            name: item.name,
            quantity,
            note: values.note || undefined,
          }),
        });
        enqueueSnackbar('Změny uloženy.', { variant: 'success' });
      } else {
        const product = (productsQuery.data ?? []).find((p) => p.id === values.productId);
        await create.mutateAsync(
          new CreateInventoryItemDto({
            productId: values.productId || undefined,
            name: product?.name,
            quantity,
            note: values.note || undefined,
          })
        );
        enqueueSnackbar('Naskladněno.', { variant: 'success' });
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
      title={editing ? 'Upravit skladovou položku' : 'Naskladnit'}
      subtitle={editing ? item?.name : 'Vyberte produkt a doplňte naskladněné množství.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Naskladnit'}
    >
      {!editing && (
        <Controller
          control={control}
          name="productId"
          render={({ field }) => (
            <Combobox
              label="Produkt"
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? '')}
              options={productOptions}
              placeholder="Vyberte produkt"
              required
              clearable={false}
              error={Boolean(errors.productId)}
              helperText={errors.productId?.message}
              autoFocus
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="quantity"
        render={({ field }) => (
          <TextField
            {...field}
            label="Množství"
            type="number"
            error={Boolean(errors.quantity)}
            helperText={errors.quantity?.message}
            fullWidth
            autoFocus={editing}
          />
        )}
      />
      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <TextField
            {...field}
            label="Poznámka"
            multiline
            minRows={3}
            error={Boolean(errors.note)}
            helperText={errors.note?.message}
            fullWidth
          />
        )}
      />
    </FormDrawer>
  );
}
