import type { ProductKind, ProductListItemDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ListItemButton from '@mui/material/ListItemButton';
import TableContainer from '@mui/material/TableContainer';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';

import { useProducts } from 'src/hooks/useProducts';

import { useEnumLabel } from 'src/utils/enumTranslations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtraProductEntry {
     productId: string;
     name: string;
     kind?: ProductKind;
     packageSize?: number;
     quantity: number;
     /** True when the entry is a free-text custom product (no real productId). */
     isCustom?: boolean;
}

interface AddExtraProductsDrawerProps {
     open: boolean;
     onClose: () => void;
     onAdd: (entries: ExtraProductEntry[]) => void;
}

// ---------------------------------------------------------------------------
// Grouped tree (same pattern as OrderItemsEditor)
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

          // Track the minimum breweryDisplayOrder per brewery
          if (p.breweryDisplayOrder != null) {
               const current = breweryOrderMap.get(brew);
               if (current == null || p.breweryDisplayOrder < current) {
                    breweryOrderMap.set(brew, p.breweryDisplayOrder);
               }
          }

          // Track the minimum displayOrder per brewery+kind
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
// Component
// ---------------------------------------------------------------------------

export default function AddExtraProductsDrawer({ open, onClose, onAdd }: AddExtraProductsDrawerProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { data: allProducts = [] } = useProducts();

     const [selected, setSelected] = useState<ProductListItemDto[]>([]);
     const [quantities, setQuantities] = useState<Record<string, number>>({});
     const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
     const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

     // Custom (free-text) products
     const [customProducts, setCustomProducts] = useState<ExtraProductEntry[]>([]);
     const [customName, setCustomName] = useState('');
     const [customQty, setCustomQty] = useState(1);

     const tree = useMemo(() => buildTree(allProducts, enumLabel), [allProducts, enumLabel]);
     const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

     const toggleCollapsed = useCallback((key: string) => {
          setCollapsed((prev) => {
               const next = new Set(prev);
               if (next.has(key)) next.delete(key);
               else next.add(key);
               return next;
          });
     }, []);

     const toggleProduct = (product: ProductListItemDto) => {
          const id = product.id ?? '';
          if (selectedIds.has(id)) {
               setSelected((prev) => prev.filter((p) => p.id !== id));
               setQuantities((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
               });
          } else {
               setSelected((prev) => [...prev, product]);
               setQuantities((prev) => ({ ...prev, [id]: 1 }));
          }
     };

     const handleRemove = (productId: string) => {
          setSelected((prev) => prev.filter((p) => p.id !== productId));
          setQuantities((prev) => {
               const next = { ...prev };
               delete next[productId];
               return next;
          });
     };

     const handleRemoveCustom = (id: string) => {
          setCustomProducts((prev) => prev.filter((p) => p.productId !== id));
     };

     const handleAddCustom = () => {
          const trimmed = customName.trim();
          if (!trimmed) return;
          const id = `custom:${crypto.randomUUID()}`;
          setCustomProducts((prev) => [
               ...prev,
               { productId: id, name: trimmed, quantity: customQty < 1 ? 1 : customQty, isCustom: true },
          ]);
          setCustomName('');
          setCustomQty(1);
     };

     const handleAdd = () => {
          const catalogEntries: ExtraProductEntry[] = selected
               .filter((p) => p.id && (quantities[p.id!] ?? 0) > 0)
               .map((p) => ({
                    productId: p.id!,
                    name: p.name ?? '',
                    kind: p.kind,
                    packageSize: p.packageSize ?? undefined,
                    quantity: quantities[p.id!] ?? 1,
               }));
          onAdd([...catalogEntries, ...customProducts]);
          setSelected([]);
          setQuantities({});
          setCustomProducts([]);
     };

     const handleClose = () => {
          setSelected([]);
          setQuantities({});
          setCustomProducts([]);
          setPickerAnchor(null);
          onClose();
     };

     const hasValidEntries =
          selected.some((p) => p.id && (quantities[p.id!] ?? 0) > 0) || customProducts.length > 0;

     return (
          <Drawer
               anchor="right"
               open={open}
               onClose={handleClose}
               sx={{
                    '& .MuiDrawer-paper': {
                         width: { xs: '100%', sm: 480 },
                         p: 3,
                         display: 'flex',
                         flexDirection: 'column',
                    },
               }}
          >
               <Typography variant="h6" sx={{ mb: 2 }}>
                    {t('outgoingShipments.addExtraProducts')}
               </Typography>

               {/* Product picker trigger — chip-based, same as OrderItemsEditor */}
               <Box
                    onClick={(e) => setPickerAnchor(e.currentTarget as HTMLElement)}
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
                         cursor: 'pointer',
                         '&:hover': { borderColor: 'text.primary' },
                    }}
               >
                    {selected.length === 0 ? (
                         <Typography variant="body2" color="text.secondary">
                              {t('outgoingShipments.selectProducts')}
                         </Typography>
                    ) : (
                         selected.map((p) => (
                              <Chip
                                   key={p.id}
                                   label={p.name}
                                   size="small"
                                   onDelete={() => handleRemove(p.id!)}
                              />
                         ))
                    )}
               </Box>

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
                                   width: pickerAnchor?.offsetWidth ?? 400,
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
                                                                                     {sizeGroup.products.map((product) => {
                                                                                          const checked = selectedIds.has(product.id ?? '');
                                                                                          return (
                                                                                               <ListItemButton
                                                                                                    key={product.id}
                                                                                                    onClick={() => toggleProduct(product)}
                                                                                                    sx={{ pl: 8, py: 0.25 }}
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
                                        </Collapse>
                                   </Box>
                              );
                         })}
                    </List>
               </Popover>

               {/* Custom product input */}
               <Divider sx={{ my: 1 }} />
               <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('outgoingShipments.customProduct')}
               </Typography>
               <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
                    <TextField
                         size="small"
                         label={t('outgoingShipments.name')}
                         value={customName}
                         onChange={(e) => setCustomName(e.target.value)}
                         onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                   e.preventDefault();
                                   handleAddCustom();
                              }
                         }}
                         sx={{ flex: 1 }}
                    />
                    <TextField
                         size="small"
                         type="number"
                         label={t('outgoingShipments.amount')}
                         value={customQty}
                         onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setCustomQty(isNaN(val) || val < 1 ? 1 : val);
                         }}
                         slotProps={{ htmlInput: { min: 1, style: { textAlign: 'right' } } }}
                         sx={{ width: 90 }}
                    />
                    <IconButton
                         onClick={handleAddCustom}
                         disabled={!customName.trim()}
                         color="primary"
                         sx={{ mt: 0.5 }}
                    >
                         <AddOutlined />
                    </IconButton>
               </Box>

               {/* Selected products table */}
               {(selected.length > 0 || customProducts.length > 0) && (
                    <TableContainer sx={{ mb: 2 }}>
                         <Table size="small">
                              <TableHead>
                                   <TableRow>
                                        <TableCell>{t('productDeliveries.product')}</TableCell>
                                        <TableCell>{t('products.kind')}</TableCell>
                                        <TableCell align="right">{t('products.packageSize')}</TableCell>
                                        <TableCell align="right" sx={{ width: 90 }}>{t('outgoingShipments.amount')}</TableCell>
                                        <TableCell sx={{ width: 40 }} />
                                   </TableRow>
                              </TableHead>
                              <TableBody>
                                   {selected.map((product) => (
                                        <TableRow key={product.id}>
                                             <TableCell>{product.name}</TableCell>
                                             <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                  {product.kind != null ? enumLabel.productKind(product.kind) : '—'}
                                             </TableCell>
                                             <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                  {product.packageSize != null ? `${product.packageSize} L` : '—'}
                                             </TableCell>
                                             <TableCell align="right">
                                                  <TextField
                                                       type="number"
                                                       size="small"
                                                       value={quantities[product.id!] ?? 1}
                                                       onChange={(e) => {
                                                            const val = parseInt(e.target.value, 10);
                                                            setQuantities((prev) => ({
                                                                 ...prev,
                                                                 [product.id!]: isNaN(val) || val < 1 ? 1 : val,
                                                            }));
                                                       }}
                                                       slotProps={{
                                                            htmlInput: { min: 1, style: { textAlign: 'right' } },
                                                       }}
                                                       sx={{ width: 72 }}
                                                  />
                                             </TableCell>
                                             <TableCell>
                                                  <IconButton size="small" onClick={() => handleRemove(product.id!)}>
                                                       <DeleteOutlined fontSize="small" />
                                                  </IconButton>
                                             </TableCell>
                                        </TableRow>
                                   ))}
                                   {customProducts.map((cp) => (
                                        <TableRow key={cp.productId}>
                                             <TableCell sx={{ fontStyle: 'italic' }}>{cp.name}</TableCell>
                                             <TableCell>—</TableCell>
                                             <TableCell align="right">—</TableCell>
                                             <TableCell align="right">
                                                  <TextField
                                                       type="number"
                                                       size="small"
                                                       value={cp.quantity}
                                                       onChange={(e) => {
                                                            const val = parseInt(e.target.value, 10);
                                                            setCustomProducts((prev) =>
                                                                 prev.map((p) =>
                                                                      p.productId === cp.productId
                                                                           ? { ...p, quantity: isNaN(val) || val < 1 ? 1 : val }
                                                                           : p,
                                                                 ),
                                                            );
                                                       }}
                                                       slotProps={{
                                                            htmlInput: { min: 1, style: { textAlign: 'right' } },
                                                       }}
                                                       sx={{ width: 72 }}
                                                  />
                                             </TableCell>
                                             <TableCell>
                                                  <IconButton size="small" onClick={() => handleRemoveCustom(cp.productId)}>
                                                       <DeleteOutlined fontSize="small" />
                                                  </IconButton>
                                             </TableCell>
                                        </TableRow>
                                   ))}
                              </TableBody>
                         </Table>
                    </TableContainer>
               )}

               <Box sx={{ mt: 'auto', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button variant="outlined" onClick={handleClose}>
                         {t('common.cancel')}
                    </Button>
                    <Button variant="contained" onClick={handleAdd} disabled={!hasValidEntries}>
                         {t('common.add')}
                    </Button>
               </Box>
          </Drawer>
     );
}
