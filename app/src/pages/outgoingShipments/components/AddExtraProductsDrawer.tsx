import type { ProductKind, ProductListItemDto, InventoryItemListItemDto } from 'src/generated/api-client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import TableContainer from '@mui/material/TableContainer';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';

import { useProducts } from 'src/hooks/useProducts';
import { useInventoryItems } from 'src/hooks/useInventory';

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
     /** Set when the entry comes from an inventory item (for ClientExtraShipments). */
     inventoryItemId?: string;
}

interface AddExtraProductsDrawerProps {
     open: boolean;
     onClose: () => void;
     onAdd: (entries: ExtraProductEntry[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers for Autocomplete grouping & sorting
// ---------------------------------------------------------------------------

/** Composite group: "Brewery — Kind — Size" to mimic the original 3-level tree. */
function getProductGroup(p: ProductListItemDto, enumLabel: ReturnType<typeof useEnumLabel>): string {
     const brew = p.breweryName ?? '—';
     const kind = p.kind != null ? enumLabel.productKind(p.kind) : '—';
     const size = p.packageSize != null ? `${p.packageSize} L` : '—';
     return `${brew} — ${kind} — ${size}`;
}

/** Sort products to match original tree: breweryDisplayOrder → displayOrder → packageSize → name. */
function sortProducts(products: ProductListItemDto[]): ProductListItemDto[] {
     return [...products].sort((a, b) => {
          const brewA = a.breweryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
          const brewB = b.breweryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
          if (brewA !== brewB) return brewA - brewB;
          const ordA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
          const ordB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
          if (ordA !== ordB) return ordA - ordB;
          const sizeA = a.packageSize ?? 0;
          const sizeB = b.packageSize ?? 0;
          if (sizeA !== sizeB) return sizeA - sizeB;
          return (a.name ?? '').localeCompare(b.name ?? '');
     });
}

function getProductLabel(p: ProductListItemDto): string {
     return p.name ?? '';
}

function getInventoryLabel(i: InventoryItemListItemDto): string {
     return i.name ?? '';
}

/** Composite group: "Section — Kind — Size" for inventory items. */
function getInventoryGroup(i: InventoryItemListItemDto & { _sectionName: string }, enumLabel: ReturnType<typeof useEnumLabel>): string {
     const section = i._sectionName;
     const kind = i.kind != null ? enumLabel.productKind(i.kind) : '—';
     const size = i.packageSize != null ? `${i.packageSize} L` : '—';
     return `${section} — ${kind} — ${size}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddExtraProductsDrawer({ open, onClose, onAdd }: AddExtraProductsDrawerProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { data: allProducts = [] } = useProducts();
     const { data: inventorySections = [] } = useInventoryItems();

     const [selected, setSelected] = useState<ProductListItemDto[]>([]);
     const [quantities, setQuantities] = useState<Record<string, number>>({});

     // Inventory items
     const [selectedInventory, setSelectedInventory] = useState<InventoryItemListItemDto[]>([]);
     const [inventoryQuantities, setInventoryQuantities] = useState<Record<string, number>>({});

     // Custom (free-text) products
     const [customProducts, setCustomProducts] = useState<ExtraProductEntry[]>([]);
     const [customName, setCustomName] = useState('');
     const [customQty, setCustomQty] = useState(1);

     const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);
     const sortedProducts = useMemo(() => sortProducts(allProducts), [allProducts]);

     // Flat inventory items for Autocomplete, sorted by section → kind → packageSize → name
     const allInventoryItems = useMemo(() => {
          const items: (InventoryItemListItemDto & { _sectionName: string })[] = [];
          for (const section of inventorySections) {
               for (const item of section.items ?? []) {
                    items.push(Object.assign(Object.create(Object.getPrototypeOf(item)), item, { _sectionName: section.name ?? '—' }));
               }
          }
          return items.sort((a, b) => {
               const secCmp = a._sectionName.localeCompare(b._sectionName);
               if (secCmp !== 0) return secCmp;
               const kindA = a.kind ?? Number.MAX_SAFE_INTEGER;
               const kindB = b.kind ?? Number.MAX_SAFE_INTEGER;
               if (kindA !== kindB) return (kindA as number) - (kindB as number);
               const sizeA = a.packageSize ?? 0;
               const sizeB = b.packageSize ?? 0;
               if (sizeA !== sizeB) return sizeA - sizeB;
               return (a.name ?? '').localeCompare(b.name ?? '');
          });
     }, [inventorySections]);

     const handleProductsChange = (_e: unknown, newValue: ProductListItemDto[]) => {
          // Add default quantity for newly added products
          const newIds = new Set(newValue.map((p) => p.id));
          setQuantities((prev) => {
               const next = { ...prev };
               for (const p of newValue) {
                    if (p.id && !(p.id in next)) next[p.id] = 1;
               }
               // Remove quantities for deselected products
               for (const key of Object.keys(next)) {
                    if (!newIds.has(key)) delete next[key];
               }
               return next;
          });
          setSelected(newValue);
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

     const handleInventoryChange = (_e: unknown, newValue: InventoryItemListItemDto[]) => {
          const newIds = new Set(newValue.map((i) => i.id));
          setInventoryQuantities((prev) => {
               const next = { ...prev };
               for (const i of newValue) {
                    if (i.id && !(i.id in next)) next[i.id] = 1;
               }
               for (const key of Object.keys(next)) {
                    if (!newIds.has(key)) delete next[key];
               }
               return next;
          });
          setSelectedInventory(newValue);
     };

     const handleRemoveInventory = (itemId: string) => {
          setSelectedInventory((prev) => prev.filter((i) => i.id !== itemId));
          setInventoryQuantities((prev) => {
               const next = { ...prev };
               delete next[itemId];
               return next;
          });
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
          const inventoryEntries: ExtraProductEntry[] = selectedInventory
               .filter((i) => i.id && (inventoryQuantities[i.id!] ?? 0) > 0)
               .map((i) => ({
                    productId: i.productId ?? i.id!,
                    name: i.name ?? '',
                    kind: i.kind,
                    packageSize: i.packageSize ?? undefined,
                    quantity: inventoryQuantities[i.id!] ?? 1,
                    inventoryItemId: i.id!,
               }));
          onAdd([...catalogEntries, ...inventoryEntries, ...customProducts]);
          setSelected([]);
          setQuantities({});
          setSelectedInventory([]);
          setInventoryQuantities({});
          setCustomProducts([]);
     };

     const handleClose = () => {
          setSelected([]);
          setQuantities({});
          setSelectedInventory([]);
          setInventoryQuantities({});
          setCustomProducts([]);
          onClose();
     };

     const hasValidEntries =
          selected.some((p) => p.id && (quantities[p.id!] ?? 0) > 0) ||
          selectedInventory.some((i) => i.id && (inventoryQuantities[i.id!] ?? 0) > 0) ||
          customProducts.length > 0;

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

               {/* Product picker — searchable Autocomplete, grouped by Brewery — Kind — Size */}
               <Autocomplete
                    multiple
                    disableCloseOnSelect
                    options={sortedProducts}
                    getOptionLabel={(opt) => getProductLabel(opt)}
                    filterOptions={(options, state) => {
                         const input = state.inputValue.toLowerCase();
                         if (!input) return options;
                         return options.filter((p) =>
                              (p.name ?? '').toLowerCase().includes(input) ||
                              (p.breweryName ?? '').toLowerCase().includes(input),
                         );
                    }}
                    groupBy={(opt) => getProductGroup(opt, enumLabel)}
                    value={selected}
                    onChange={handleProductsChange}
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
                              label={t('outgoingShipments.selectProducts')}
                              size="small"
                         />
                    )}
                    sx={{ mb: 2 }}
               />

               {/* Inventory item picker — searchable Autocomplete, grouped by Section — Kind — Size */}
               <Autocomplete
                    multiple
                    disableCloseOnSelect
                    options={allInventoryItems}
                    getOptionLabel={(opt) => getInventoryLabel(opt)}
                    filterOptions={(options, state) => {
                         const input = state.inputValue.toLowerCase();
                         if (!input) return options;
                         return options.filter((i) =>
                              (i.name ?? '').toLowerCase().includes(input) ||
                              (i as any)._sectionName?.toLowerCase().includes(input),
                         );
                    }}
                    groupBy={(opt) => getInventoryGroup(opt as InventoryItemListItemDto & { _sectionName: string }, enumLabel)}
                    value={selectedInventory}
                    onChange={(_e, newValue) => handleInventoryChange(_e, newValue)}
                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                    renderOption={(props, option) => {
                         const { key, ...rest } = props as any;
                         const checked = selectedInventory.some((i) => i.id === option.id);
                         return (
                              <li key={key} {...rest}>
                                   <Checkbox
                                        size="small"
                                        checked={checked}
                                        sx={{ mr: 1, p: 0 }}
                                   />
                                   {option.name}
                              </li>
                         );
                    }}
                    renderInput={(params) => (
                         <TextField
                              {...params}
                              label={t('outgoingShipments.selectInventoryItems')}
                              size="small"
                         />
                    )}
                    sx={{ mb: 2 }}
               />

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
               {(selected.length > 0 || selectedInventory.length > 0 || customProducts.length > 0) && (
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
                                   {selectedInventory.map((item) => (
                                        <TableRow key={`inv-${item.id}`}>
                                             <TableCell>{item.name}</TableCell>
                                             <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                  {item.kind != null ? enumLabel.productKind(item.kind) : '—'}
                                             </TableCell>
                                             <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                  {item.packageSize != null ? `${item.packageSize} L` : '—'}
                                             </TableCell>
                                             <TableCell align="right">
                                                  <TextField
                                                       type="number"
                                                       size="small"
                                                       value={inventoryQuantities[item.id!] ?? 1}
                                                       onChange={(e) => {
                                                            const val = parseInt(e.target.value, 10);
                                                            setInventoryQuantities((prev) => ({
                                                                 ...prev,
                                                                 [item.id!]: isNaN(val) || val < 1 ? 1 : val,
                                                            }));
                                                       }}
                                                       slotProps={{
                                                            htmlInput: { min: 1, style: { textAlign: 'right' } },
                                                       }}
                                                       sx={{ width: 72 }}
                                                  />
                                             </TableCell>
                                             <TableCell>
                                                  <IconButton size="small" onClick={() => handleRemoveInventory(item.id!)}>
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
