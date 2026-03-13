import type { ProductListItemDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import ListItemText from '@mui/material/ListItemText';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ListItemButton from '@mui/material/ListItemButton';

import { useProducts } from 'src/hooks/useProducts';
import { useCreateInventoryItem, useUpdateInventoryItem } from 'src/hooks/useInventory';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { CreateInventoryItemDto, UpdateInventoryItemDto } from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Grouped tree (same pattern as AddExtraProductsDrawer)
// ---------------------------------------------------------------------------

interface SizeGroup {
     size: string;
     products: ProductListItemDto[];
}

interface KindGroup {
     kind: string;
     sizes: SizeGroup[];
}

interface BreweryGroup {
     brewery: string;
     kinds: KindGroup[];
}

function buildTree(products: ProductListItemDto[], enumLabel: ReturnType<typeof useEnumLabel>): BreweryGroup[] {
     const brewMap = new Map<string, Map<string, Map<string, ProductListItemDto[]>>>();
     const breweryOrderMap = new Map<string, number>();
     const kindOrderMap = new Map<string, number>();

     for (const p of products) {
          const brew = p.breweryName ?? '—';
          const kind = p.kind != null ? enumLabel.productKind(p.kind) : '—';
          const size = p.packageSize != null ? `${p.packageSize} L` : '—';

          if (!brewMap.has(brew)) brewMap.set(brew, new Map());
          const kindMap = brewMap.get(brew)!;
          if (!kindMap.has(kind)) kindMap.set(kind, new Map());
          const sizeMap = kindMap.get(kind)!;
          if (!sizeMap.has(size)) sizeMap.set(size, []);
          sizeMap.get(size)!.push(p);

          if (p.breweryDisplayOrder != null) {
               const current = breweryOrderMap.get(brew);
               if (current == null || p.breweryDisplayOrder < current) {
                    breweryOrderMap.set(brew, p.breweryDisplayOrder);
               }
          }

          const kindKey = `${brew}::${kind}`;
          if (p.displayOrder != null) {
               const current = kindOrderMap.get(kindKey);
               if (current == null || p.displayOrder < current) {
                    kindOrderMap.set(kindKey, p.displayOrder);
               }
          }
     }

     const result: BreweryGroup[] = [];
     for (const [brewery, kindMap] of [...brewMap.entries()].sort((a, b) => {
          const orderA = breweryOrderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
          const orderB = breweryOrderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a[0].localeCompare(b[0]);
     })) {
          const kinds: KindGroup[] = [];
          for (const [kind, sizeMap] of [...kindMap.entries()].sort((a, b) => {
               const orderA = kindOrderMap.get(`${brewery}::${a[0]}`) ?? Number.MAX_SAFE_INTEGER;
               const orderB = kindOrderMap.get(`${brewery}::${b[0]}`) ?? Number.MAX_SAFE_INTEGER;
               if (orderA !== orderB) return orderA - orderB;
               return a[0].localeCompare(b[0]);
          })) {
               const sizes: SizeGroup[] = [];
               for (const [size, prods] of [...sizeMap.entries()].sort(([a], [b]) => {
                    const na = parseFloat(a) || 0;
                    const nb = parseFloat(b) || 0;
                    return na - nb;
               })) {
                    sizes.push({
                         size,
                         products: prods.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
                    });
               }
               kinds.push({ kind, sizes });
          }
          result.push({ brewery, kinds });
     }
     return result;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryFormValues {
     productId: string;
     quantity: number | '';
     note: string;
}

export interface EditItemData {
     id: string;
     productId?: string;
     name?: string;
     quantity: number;
     note?: string;
}

interface InventoryItemDrawerProps {
     open: boolean;
     onClose: () => void;
     mode: 'create' | 'edit';
     editItem?: EditItemData;
     onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const defaultValues: InventoryFormValues = {
     productId: '',
     quantity: '',
     note: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryItemDrawer({ open, onClose, mode, editItem, onSuccess }: InventoryItemDrawerProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { data: products = [] } = useProducts();
     const createMutation = useCreateInventoryItem();
     const updateMutation = useUpdateInventoryItem();

     const tree = useMemo(() => buildTree(products, enumLabel), [products, enumLabel]);

     const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
     const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

     const toggleCollapsed = useCallback((key: string) => {
          setCollapsed((prev) => {
               const next = new Set(prev);
               if (next.has(key)) next.delete(key);
               else next.add(key);
               return next;
          });
     }, []);

     const {
          control,
          handleSubmit,
          reset,
          setValue,
          watch,
          formState: { errors },
     } = useForm<InventoryFormValues>({ defaultValues });

     const productIdValue = watch('productId');
     const selectedProduct = useMemo(
          () => products.find((p) => p.id === productIdValue) ?? null,
          [products, productIdValue],
     );

     // Reset form when drawer opens
     useEffect(() => {
          if (!open) return;
          if (mode === 'edit' && editItem) {
               reset({
                    productId: editItem.productId ?? '',
                    quantity: editItem.quantity,
                    note: editItem.note ?? '',
               });
          } else {
               reset(defaultValues);
          }
     }, [open, mode, editItem, reset]);

     const selectProduct = (product: ProductListItemDto) => {
          setValue('productId', product.id ?? '', { shouldValidate: true });
          setPickerAnchor(null);
     };

     const onSubmit = (data: InventoryFormValues) => {
          if (mode === 'create') {
               const dto = new CreateInventoryItemDto();
               dto.productId = data.productId || undefined;
               dto.quantity = Number(data.quantity);
               dto.note = data.note || undefined;
               createMutation.mutate(dto, {
                    onSuccess: () => {
                         onSuccess();
                         onClose();
                    },
               });
          } else if (editItem) {
               const dto = new UpdateInventoryItemDto();
               dto.productId = data.productId || undefined;
               dto.quantity = Number(data.quantity);
               dto.note = data.note || undefined;
               updateMutation.mutate(
                    { id: editItem.id, data: dto },
                    {
                         onSuccess: () => {
                              onSuccess();
                              onClose();
                         },
                    },
               );
          }
     };

     const isPending = createMutation.isPending || updateMutation.isPending;

     return (
          <Drawer
               anchor="right"
               open={open}
               onClose={onClose}
               slotProps={{
                    paper: { sx: { width: { xs: '100%', sm: 400 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {mode === 'create' ? t('inventory.addItem') : t('inventory.editItem')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
                         {/* Product selector — only in create mode */}
                         {mode === 'create' ? (
                              <>
                                   <Controller
                                        name="productId"
                                        control={control}
                                        rules={{ required: true }}
                                        render={() => (
                                             <Box
                                                  onClick={(e) => setPickerAnchor(e.currentTarget as HTMLElement)}
                                                  sx={{
                                                       border: '1px solid',
                                                       borderColor: errors.productId ? 'error.main' : 'divider',
                                                       borderRadius: 1,
                                                       px: 1.5,
                                                       py: 1,
                                                       minHeight: 40,
                                                       display: 'flex',
                                                       alignItems: 'center',
                                                       cursor: 'pointer',
                                                       '&:hover': { borderColor: 'text.primary' },
                                                  }}
                                             >
                                                  <Typography
                                                       variant="body2"
                                                       color={selectedProduct ? 'text.primary' : 'text.secondary'}
                                                  >
                                                       {selectedProduct?.name ?? t('inventory.selectProduct')}
                                                  </Typography>
                                             </Box>
                                        )}
                                   />

                                   {/* Tree popover */}
                                   <Popover
                                        open={Boolean(pickerAnchor)}
                                        anchorEl={pickerAnchor}
                                        onClose={() => setPickerAnchor(null)}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                        slotProps={{
                                             paper: {
                                                  sx: {
                                                       width: pickerAnchor?.offsetWidth ?? 350,
                                                       maxHeight: 400,
                                                       overflow: 'auto',
                                                  },
                                             },
                                        }}
                                   >
                                        <List dense disablePadding>
                                             {tree.map((breweryGroup) => {
                                                  const brewKey = `b:${breweryGroup.brewery}`;
                                                  const brewOpen = !collapsed.has(brewKey);

                                                  return (
                                                       <Box key={brewKey}>
                                                            <ListItemButton onClick={() => toggleCollapsed(brewKey)} sx={{ py: 0.5 }}>
                                                                 <ListItemText
                                                                      primary={breweryGroup.brewery}
                                                                      primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }}
                                                                 />
                                                                 {brewOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                                            </ListItemButton>

                                                            <Collapse in={brewOpen}>
                                                                 {breweryGroup.kinds.map((kindGroup) => {
                                                                      const kindKey = `${brewKey}:k:${kindGroup.kind}`;
                                                                      const kindOpen = !collapsed.has(kindKey);

                                                                      return (
                                                                           <Box key={kindKey}>
                                                                                <ListItemButton onClick={() => toggleCollapsed(kindKey)} sx={{ pl: 4, py: 0.25 }}>
                                                                                     <ListItemText
                                                                                          primary={kindGroup.kind}
                                                                                          primaryTypographyProps={{ fontWeight: 600, fontSize: '0.8125rem' }}
                                                                                     />
                                                                                     {kindOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                                                                </ListItemButton>

                                                                                <Collapse in={kindOpen}>
                                                                                     {kindGroup.sizes.map((sizeGroup) => {
                                                                                          const sizeKey = `${kindKey}:s:${sizeGroup.size}`;
                                                                                          const sizeOpen = !collapsed.has(sizeKey);

                                                                                          return (
                                                                                               <Box key={sizeKey}>
                                                                                                    <ListItemButton onClick={() => toggleCollapsed(sizeKey)} sx={{ pl: 6, py: 0.25 }}>
                                                                                                         <ListItemText
                                                                                                              primary={sizeGroup.size}
                                                                                                              primaryTypographyProps={{ fontSize: '0.8125rem', color: 'text.secondary' }}
                                                                                                         />
                                                                                                         {sizeOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                                                                                    </ListItemButton>

                                                                                                    <Collapse in={sizeOpen}>
                                                                                                         {sizeGroup.products.map((product) => (
                                                                                                              <ListItemButton
                                                                                                                   key={product.id}
                                                                                                                   onClick={() => selectProduct(product)}
                                                                                                                   selected={product.id === productIdValue}
                                                                                                                   sx={{ pl: 8, py: 0.25 }}
                                                                                                              >
                                                                                                                   <ListItemText
                                                                                                                        primary={product.name}
                                                                                                                        primaryTypographyProps={{ fontSize: '0.8125rem' }}
                                                                                                                   />
                                                                                                              </ListItemButton>
                                                                                                         ))}
                                                                                                    </Collapse>
                                                                                               </Box>
                                                                                          );
                                                                                     })}
                                                                                </Collapse>
                                                                           </Box>
                                                                      );
                                                                 })}
                                                            </Collapse>
                                                       </Box>
                                                  );
                                             })}
                                        </List>
                                   </Popover>
                              </>
                         ) : (
                              <TextField
                                   label={t('products.title')}
                                   value={editItem?.name ?? ''}
                                   size="small"
                                   disabled
                              />
                         )}

                         {/* Quantity */}
                         <Controller
                              name="quantity"
                              control={control}
                              rules={{ required: true, min: 0 }}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        onChange={(e) => {
                                             const val = e.target.value;
                                             if (val === '') { field.onChange(''); return; }
                                             const num = Number(val);
                                             if (num < 0) return;
                                             field.onChange(num);
                                        }}
                                        label={t('inventory.quantity')}
                                        type="number"
                                        size="small"
                                        required
                                        error={!!errors.quantity}
                                        slotProps={{ htmlInput: { min: 0 } }}
                                   />
                              )}
                         />

                         {/* Note */}
                         <Controller
                              name="note"
                              control={control}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        label={t('inventory.note')}
                                        size="small"
                                        multiline
                                        rows={3}
                                   />
                              )}
                         />
                    </Stack>

                    <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
                         <Button variant="outlined" onClick={onClose}>
                              {t('common.cancel')}
                         </Button>
                         <LoadingButton type="submit" variant="contained" loading={isPending}>
                              {t('common.save')}
                         </LoadingButton>
                    </Stack>
               </Box>
          </Drawer>
     );
}
