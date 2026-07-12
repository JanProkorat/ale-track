import type { DragEndEvent } from '@dnd-kit/core';
import type { BreweryProductListItemDto } from 'src/generated/api-client';

import { CSS } from '@dnd-kit/utilities';
import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSensor, DndContext, useSensors, closestCenter, PointerSensor, KeyboardSensor } from '@dnd-kit/core';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import Autocomplete from '@mui/material/Autocomplete';
import TableContainer from '@mui/material/TableContainer';
import DragHandle from '@mui/icons-material/DragIndicator';

import { useBreweries, useBreweryProducts } from 'src/hooks/useBreweries';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { useCurrency } from 'src/providers/CurrencyProvider';

import EmptyState from 'src/components/common/EmptyState';
import SectionCard from 'src/components/common/SectionCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StopProductRow {
     productId: string;
     quantity: number;
     note?: string;
}

export interface StopRow {
     publicId?: string;
     breweryId: string;
     note?: string;
     products: StopProductRow[];
}

interface DeliveryStopsEditorProps {
     stops: StopRow[];
     onChange: (stops: StopRow[]) => void;
}

// ---------------------------------------------------------------------------
// Per-stop product editor
// ---------------------------------------------------------------------------

function StopProductsEditor({
     breweryId,
     products,
     onProductsChange,
}: {
     breweryId: string;
     products: StopProductRow[];
     onProductsChange: (products: StopProductRow[]) => void;
}) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { formatPrice } = useCurrency();
     const { data: breweryProducts = [] } = useBreweryProducts(breweryId);

     const selectedIds = useMemo(() => new Set(products.map((p) => p.productId)), [products]);

     const sortedProducts = useMemo(() =>
          [...breweryProducts].sort((a, b) => {
               const ordA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
               const ordB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
               if (ordA !== ordB) return ordA - ordB;
               const sizeA = a.packageSize ?? 0;
               const sizeB = b.packageSize ?? 0;
               if (sizeA !== sizeB) return sizeA - sizeB;
               return (a.name ?? '').localeCompare(b.name ?? '');
          }),
          [breweryProducts],
     );

     const selectedProductObjects = useMemo(
          () => sortedProducts.filter((p) => selectedIds.has(p.id ?? '')),
          [sortedProducts, selectedIds],
     );

     const handleAutocompleteChange = (_e: unknown, newValue: BreweryProductListItemDto[]) => {
          const newIds = new Set(newValue.map((p) => p.id ?? ''));
          const kept = products.filter((p) => newIds.has(p.productId));
          const keptIds = new Set(kept.map((p) => p.productId));
          const added = newValue
               .filter((p) => p.id && !keptIds.has(p.id))
               .map((p) => ({ productId: p.id!, quantity: 1 }));
          onProductsChange([...kept, ...added]);
     };

     const handleQuantityChange = (productId: string, quantity: number) => {
          onProductsChange(
               products.map((p) => (p.productId === productId ? { ...p, quantity } : p)),
          );
     };

     const handleRemove = (productId: string) => {
          onProductsChange(products.filter((p) => p.productId !== productId));
     };

     return (
          <Box>
               {/* Product picker — searchable Autocomplete, grouped by Kind — Size */}
               <Autocomplete
                    multiple
                    disableCloseOnSelect
                    disabled={!breweryId}
                    options={sortedProducts}
                    getOptionLabel={(opt) => opt.name ?? ''}
                    filterOptions={(options, state) => {
                         const input = state.inputValue.toLowerCase();
                         if (!input) return options;
                         return options.filter((p) => (p.name ?? '').toLowerCase().includes(input));
                    }}
                    groupBy={(opt) => {
                         const kind = opt.kind != null ? enumLabel.productKind(opt.kind) : '—';
                         const size = opt.packageSize != null ? `${opt.packageSize} L` : '—';
                         return `${kind} — ${size}`;
                    }}
                    value={selectedProductObjects}
                    onChange={handleAutocompleteChange}
                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                    renderOption={(props, option) => {
                         const { key, ...rest } = props as any;
                         return (
                              <li key={key} {...rest}>
                                   <Checkbox
                                        size="small"
                                        checked={selectedIds.has(option.id ?? '')}
                                        sx={{ mr: 1, p: 0 }}
                                   />
                                   {option.name}
                              </li>
                         );
                    }}
                    renderInput={(params) => (
                         <TextField
                              {...params}
                              label={t('productDeliveries.addProduct')}
                              size="small"
                         />
                    )}
                    sx={{ mb: 2 }}
               />

               {/* Products table */}
               {products.length === 0 ? (
                    <EmptyState message={t('productDeliveries.noProducts')} />
               ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                         <Table size="small" sx={{ minWidth: 500 }}>
                              <TableHead>
                                   <TableRow>
                                        <TableCell
                                             sx={{
                                                  position: 'sticky',
                                                  left: 0,
                                                  zIndex: 3,
                                                  bgcolor: 'background.neutral',
                                                  whiteSpace: 'nowrap',
                                             }}
                                        >
                                             {t('productDeliveries.product')}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                             {t('productDeliveries.quantity')}
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('products.kind')}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('products.packageSize')}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('products.priceWithVat')}</TableCell>
                                        <TableCell
                                             sx={{
                                                  position: 'sticky',
                                                  right: 0,
                                                  zIndex: 3,
                                                  bgcolor: 'background.neutral',
                                                  width: 48,
                                             }}
                                        />
                                   </TableRow>
                              </TableHead>
                              <TableBody>
                                   {products.map((item) => {
                                        const product = breweryProducts.find((p) => p.id === item.productId);
                                        if (!product) return null;
                                        return (
                                             <TableRow key={item.productId}>
                                                  <TableCell
                                                       sx={{
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 1,
                                                            bgcolor: 'background.paper',
                                                            whiteSpace: 'nowrap',
                                                       }}
                                                  >
                                                       {product.name}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       <TextField
                                                            type="number"
                                                            size="small"
                                                            value={item.quantity}
                                                            onChange={(e) =>
                                                                 handleQuantityChange(
                                                                      item.productId,
                                                                      Math.max(1, parseInt(e.target.value, 10) || 1),
                                                                 )
                                                            }
                                                            slotProps={{
                                                                 htmlInput: { min: 1, style: { textAlign: 'right' } },
                                                            }}
                                                            sx={{ width: 80 }}
                                                       />
                                                  </TableCell>
                                                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                       {product.kind != null
                                                            ? enumLabel.productKind(product.kind)
                                                            : '-'}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {product.packageSize != null ? `${product.packageSize} L` : '-'}
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                       {formatPrice(product.priceWithVat)}
                                                  </TableCell>
                                                  <TableCell
                                                       sx={{
                                                            position: 'sticky',
                                                            right: 0,
                                                            zIndex: 1,
                                                            bgcolor: 'background.paper',
                                                            whiteSpace: 'nowrap',
                                                       }}
                                                  >
                                                       <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleRemove(item.productId)}
                                                       >
                                                            <DeleteIcon fontSize="small" />
                                                       </IconButton>
                                                  </TableCell>
                                             </TableRow>
                                        );
                                   })}
                              </TableBody>
                         </Table>
                    </TableContainer>
               )}
          </Box>
     );
}

// ---------------------------------------------------------------------------
// Sortable stop card
// ---------------------------------------------------------------------------

function SortableStopCard({
     id,
     stop,
     stopIndex,
     breweries,
     onStopChange,
     onProductsChange,
     onRemove,
}: {
     id: string;
     stop: StopRow;
     stopIndex: number;
     breweries: { id?: string; name?: string }[];
     onStopChange: (index: number, partial: Partial<StopRow>) => void;
     onProductsChange: (index: number, products: StopProductRow[]) => void;
     onRemove: (index: number) => void;
}) {
     const { t } = useTranslation();
     const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

     const selectedBrewery = breweries.find((b) => b.id === stop.breweryId) ?? null;

     const style = {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
     };

     return (
          <Box ref={setNodeRef} style={style}>
               <SectionCard
                    title={selectedBrewery?.name ?? `${t('productDeliveries.stop')} ${stopIndex + 1}`}
                    action={
                         <Stack direction="row" spacing={0.5} alignItems="center">
                              <IconButton
                                   size="small"
                                   sx={{ cursor: 'grab', touchAction: 'none' }}
                                   {...attributes}
                                   {...listeners}
                              >
                                   <DragHandle fontSize="small" />
                              </IconButton>
                              <IconButton
                                   size="small"
                                   color="error"
                                   onClick={() => onRemove(stopIndex)}
                              >
                                   <DeleteIcon fontSize="small" />
                              </IconButton>
                         </Stack>
                    }
               >
                    <Stack spacing={2}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Autocomplete
                                        options={breweries}
                                        getOptionLabel={(opt) => opt.name ?? ''}
                                        value={selectedBrewery}
                                        onChange={(_e, newValue) =>
                                             onStopChange(stopIndex, {
                                                  breweryId: newValue?.id ?? '',
                                                  products: [],
                                             })
                                        }
                                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                        renderInput={(params) => (
                                             <TextField
                                                  {...params}
                                                  label={t('productDeliveries.brewery')}
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <TextField
                                        label={t('productDeliveries.note')}
                                        size="small"
                                        fullWidth
                                        value={stop.note ?? ''}
                                        onChange={(e) =>
                                             onStopChange(stopIndex, { note: e.target.value })
                                        }
                                   />
                              </Grid>
                         </Grid>

                         {/* Products */}
                         <StopProductsEditor
                              breweryId={stop.breweryId}
                              products={stop.products}
                              onProductsChange={(products) => onProductsChange(stopIndex, products)}
                         />
                    </Stack>
               </SectionCard>
          </Box>
     );
}

// ---------------------------------------------------------------------------
// DeliveryStopsEditor
// ---------------------------------------------------------------------------

export default function DeliveryStopsEditor({ stops, onChange }: DeliveryStopsEditorProps) {
     const { t } = useTranslation();
     const { data: breweries = [] } = useBreweries();

     // Stable IDs for sortable — use publicId or fallback to index-based key
     const sortableIds = useMemo(
          () => stops.map((stop, i) => stop.publicId ?? `new-${i}`),
          [stops],
     );

     const sensors = useSensors(
          useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
          useSensor(KeyboardSensor),
     );

     const handleDragEnd = useCallback(
          (event: DragEndEvent) => {
               const { active, over } = event;
               if (!over || active.id === over.id) return;
               const oldIndex = sortableIds.indexOf(active.id as string);
               const newIndex = sortableIds.indexOf(over.id as string);
               if (oldIndex !== -1 && newIndex !== -1) {
                    onChange(arrayMove(stops, oldIndex, newIndex));
               }
          },
          [stops, onChange, sortableIds],
     );

     const handleRemoveStop = (index: number) => {
          onChange(stops.filter((_, i) => i !== index));
     };

     const handleStopChange = (index: number, partial: Partial<StopRow>) => {
          const updated = stops.map((stop, i) => (i === index ? { ...stop, ...partial } : stop));
          onChange(updated);
     };

     const handleProductsChange = (stopIndex: number, products: StopProductRow[]) => {
          handleStopChange(stopIndex, { products });
     };

     return (
          <DndContext
               sensors={sensors}
               collisionDetection={closestCenter}
               modifiers={[restrictToVerticalAxis]}
               onDragEnd={handleDragEnd}
          >
               <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    <Stack spacing={2}>
                         {stops.length === 0 && (
                              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                   {t('productDeliveries.noStops')}
                              </Typography>
                         )}

                         {stops.map((stop, stopIndex) => (
                              <SortableStopCard
                                   key={sortableIds[stopIndex]}
                                   id={sortableIds[stopIndex]}
                                   stop={stop}
                                   stopIndex={stopIndex}
                                   breweries={breweries}
                                   onStopChange={handleStopChange}
                                   onProductsChange={handleProductsChange}
                                   onRemove={handleRemoveStop}
                              />
                         ))}
                    </Stack>
               </SortableContext>
          </DndContext>
     );
}
