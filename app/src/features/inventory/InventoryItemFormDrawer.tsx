import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { ProductCombobox } from 'src/components/common/ProductCombobox';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  type InventoryItemListItemDto,
} from 'src/generated/api-client';
import { useCreateInventoryItem, useInventory, useUpdateInventoryItem } from 'src/hooks/useInventory';
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
  const inventoryQuery = useInventory();
  const editing = Boolean(item);

  // The API keeps one row per product, so offering a product that is already
  // stocked can only end in "položka již existuje" — raise its quantity on the
  // existing row instead. Manual (name-only) items carry no productId and
  // therefore hide nothing.
  const stockable = useMemo(() => {
    const stocked = new Set(
      (inventoryQuery.data ?? [])
        .flatMap((section) => section.items ?? [])
        .map((i) => i.productId)
        .filter((id): id is string => Boolean(id)),
    );
    return (productsQuery.data ?? []).filter((p) => p.id && !stocked.has(p.id));
  }, [productsQuery.data, inventoryQuery.data]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(makeSchema(editing)), defaultValues: empty });

  useEffect(() => {
    if (open) reset(item ? toForm(item) : empty);
  }, [open, item, reset]);

  const submit = handleSubmit(async (values) => {
    const quantity = Number(values.quantity);
    try {
      if (item?.id) {
        await update.mutateAsync({
          id: item.id,
          data: new UpdateInventoryItemDto({
            productId: item.productId,
            // Only a hand-written row owns its name. A row backed by a product or by a supplier's
            // goods takes its name from that catalogue, so echoing the displayed name back would
            // store a copy that goes stale the moment the entry is renamed — which is the whole
            // reason those rows hold a reference rather than a name.
            name: item.productId || item.supplierGoodId ? undefined : item.name,
            quantity,
            note: values.note || undefined,
          }),
        });
        enqueueSnackbar('Změny uloženy.', { variant: 'success' });
      } else {
        // ProductId and Name are mutually exclusive in the API: an item backed
        // by a product takes its name from the catalogue, and sending both is
        // rejected outright (CreateInventoryItemDtoValidator).
        await create.mutateAsync(
          new CreateInventoryItemDto({
            productId: values.productId,
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
            <ProductCombobox
              label="Produkt"
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? '')}
              products={stockable}
              loading={productsQuery.isLoading || inventoryQuery.isLoading}
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
