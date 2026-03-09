import type { BreweryProductListItemDto } from 'src/generated/api-client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import DragHandle from '@mui/icons-material/DragIndicator';
import Autocomplete from '@mui/material/Autocomplete';
import ListItemText from '@mui/material/ListItemText';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TableContainer from '@mui/material/TableContainer';
import ListItemButton from '@mui/material/ListItemButton';

import type { DragEndEvent } from '@dnd-kit/core';

import { useBreweries, useBreweryProducts } from 'src/hooks/useBreweries';

import { useEnumLabel } from 'src/utils/enumTranslations';
import { useCurrency } from 'src/providers/CurrencyProvider';

import SectionCard from 'src/components/common/SectionCard';
import EmptyState from 'src/components/common/EmptyState';

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
// Grouped tree: Kind → Size → Products
// ---------------------------------------------------------------------------

interface SizeGroup {
     size: string;
     products: BreweryProductListItemDto[];
}

interface KindGroup {
     kind: string;
     sizes: SizeGroup[];
}

function buildTree(
     products: BreweryProductListItemDto[],
     enumLabel: ReturnType<typeof useEnumLabel>,
): KindGroup[] {
     const kindMap = new Map<string, Map<string, BreweryProductListItemDto[]>>();

     for (const p of products) {
          const kind = p.kind != null ? enumLabel.productKind(p.kind) : '—';
          const size = p.packageSize != null ? `${p.packageSize} L` : '—';

          if (!kindMap.has(kind)) kindMap.set(kind, new Map());
          const sizeMap = kindMap.get(kind)!;
          if (!sizeMap.has(size)) sizeMap.set(size, []);
          sizeMap.get(size)!.push(p);
     }

     const result: KindGroup[] = [];
     for (const [kind, sizeMap] of [...kindMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
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
          result.push({ kind, sizes });
     }
     return result;
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

     const selectedIds = useMemo(() => new Set(products.map((p) => p.productId)), [products]);

     const tree = useMemo(() => buildTree(breweryProducts, enumLabel), [breweryProducts, enumLabel]);

     const toggleProduct = (product: BreweryProductListItemDto) => {
          const id = product.id ?? '';
          if (selectedIds.has(id)) {
               onProductsChange(products.filter((p) => p.productId !== id));
          } else {
               onProductsChange([...products, { productId: id, quantity: 1 }]);
          }
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
               {/* Product picker trigger — chip area */}
               <Box
                    onClick={(e) => breweryId && setPickerAnchor(e.currentTarget as HTMLElement)}
                    sx={{
                         border: '1px solid',
                         borderColor: 'divider',
                         borderRadius: 1,
                         px: 1.5,
                         py: 1,
                         mb: 2,
                         minHeight: 40,
                         display: 'flex',
                         alignItems: 'center',
                         flexWrap: 'wrap',
                         gap: 0.5,
                         cursor: breweryId ? 'pointer' : 'default',
                         opacity: breweryId ? 1 : 0.5,
                         '&:hover': breweryId ? { borderColor: 'text.primary' } : undefined,
                    }}
               >
                    {products.length === 0 ? (
                         <Typography variant="body2" color="text.secondary">
                              {t('productDeliveries.addProduct')}
                         </Typography>
                    ) : (
                         products.map((item) => {
                              const product = breweryProducts.find((p) => p.id === item.productId);
                              return (
                                   <Chip
                                        key={item.productId}
                                        label={product?.name ?? item.productId}
                                        size="small"
                                        onDelete={() => handleRemove(item.productId)}
                                   />
                              );
                         })
                    )}
               </Box>

               {/* Product picker popover with collapsible tree */}
               <Popover
                    open={Boolean(pickerAnchor)}
                    anchorEl={pickerAnchor}
                    onClose={() => setPickerAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    slotProps={{
                         paper: {
                              sx: {
                                   width: pickerAnchor?.offsetWidth ?? 400,
                                   maxHeight: 400,
                                   overflow: 'auto',
                              },
                         },
                    }}
               >
                    <List dense disablePadding>
                         {tree.map((kindGroup) => {
                              const kindKey = `k:${kindGroup.kind}`;
                              const kindOpen = !collapsed.has(kindKey);

                              return (
                                   <Box key={kindKey}>
                                        <ListItemButton
                                             onClick={() => toggleCollapsed(kindKey)}
                                             sx={{ py: 0.5 }}
                                        >
                                             <ListItemText
                                                  primary={kindGroup.kind}
                                                  primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }}
                                             />
                                             {kindOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                        </ListItemButton>

                                        <Collapse in={kindOpen}>
                                             {kindGroup.sizes.map((sizeGroup) => {
                                                  const sizeKey = `${kindKey}:s:${sizeGroup.size}`;
                                                  const sizeOpen = !collapsed.has(sizeKey);

                                                  return (
                                                       <Box key={sizeKey}>
                                                            <ListItemButton
                                                                 onClick={() => toggleCollapsed(sizeKey)}
                                                                 sx={{ pl: 4, py: 0.25 }}
                                                            >
                                                                 <ListItemText
                                                                      primary={sizeGroup.size}
                                                                      primaryTypographyProps={{ fontSize: '0.8125rem', color: 'text.secondary' }}
                                                                 />
                                                                 {sizeOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                                            </ListItemButton>

                                                            <Collapse in={sizeOpen}>
                                                                 {sizeGroup.products.map((product) => {
                                                                      const checked = selectedIds.has(product.id ?? '');
                                                                      return (
                                                                           <ListItemButton
                                                                                key={product.id}
                                                                                onClick={() => toggleProduct(product)}
                                                                                sx={{ pl: 6, py: 0.25 }}
                                                                           >
                                                                                <Checkbox
                                                                                     size="small"
                                                                                     checked={checked}
                                                                                     tabIndex={-1}
                                                                                     disableRipple
                                                                                     sx={{ mr: 1, p: 0 }}
                                                                                />
                                                                                <ListItemText
                                                                                     primary={product.name}
                                                                                     primaryTypographyProps={{ fontSize: '0.8125rem' }}
                                                                                />
                                                                           </ListItemButton>
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
                    title={selectedBrewery?.name ?? `${t('productDeliveries.stops')} ${stopIndex + 1}`}
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
