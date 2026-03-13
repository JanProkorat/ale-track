import type { ProductListItemDto } from 'src/generated/api-client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Popover from '@mui/material/Popover';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import Autocomplete from '@mui/material/Autocomplete';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TableContainer from '@mui/material/TableContainer';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import RemoveCircleOutlineOutlined from '@mui/icons-material/RemoveCircleOutlineOutlined';

import { useProductsByClientHistory } from 'src/hooks/useProducts';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { useCurrency } from 'src/providers/CurrencyProvider';

import EmptyState from 'src/components/common/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderItemRow {
     productId: string;
     quantity: number;
     reminderState?: string;
}

interface OrderItemsEditorProps {
     clientId: string;
     items: OrderItemRow[];
     onChange: (items: OrderItemRow[]) => void;
}

// ---------------------------------------------------------------------------
// OrderItemsEditor
// ---------------------------------------------------------------------------

export default function OrderItemsEditor({ clientId, items, onChange }: OrderItemsEditorProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { formatPrice } = useCurrency();
     const { data: groupedData } = useProductsByClientHistory(clientId);

     const recentProducts = useMemo(() => groupedData?.recent ?? [], [groupedData?.recent]);
     const breweryGroups = useMemo(() => groupedData?.breweries ?? [], [groupedData?.breweries]);

     // Flat lookup for table rows
     const allProducts = useMemo(() => {
          const map = new Map<string, ProductListItemDto>();
          for (const p of recentProducts) {
               if (p.id) map.set(p.id, p);
          }
          for (const bg of breweryGroups) {
               for (const kg of bg.kinds ?? []) {
                    for (const pg of kg.packageSizes ?? []) {
                         for (const p of pg.items ?? []) {
                              if (p.id) map.set(p.id, p);
                         }
                    }
               }
          }
          return map;
     }, [recentProducts, breweryGroups]);

     // Popover state for reminder "Added" → choose null or Resolved
     const [reminderPopover, setReminderPopover] = useState<{ anchor: HTMLElement; productId: string } | null>(null);

     // Products already selected (by id)
     const selectedIds = useMemo(() => new Set(items.map((i) => i.productId)), [items]);

     // Flat sorted product list for Autocomplete, with group info
     const sortedProductList = useMemo(() => {
          const list: (ProductListItemDto & { _group: string })[] = [];
          const seen = new Set<string>();
          // Recent products first
          for (const p of recentProducts) {
               if (p.id && !seen.has(p.id)) {
                    seen.add(p.id);
                    list.push(Object.assign(Object.create(Object.getPrototypeOf(p)), p, { _group: t('orders.recentProducts') }));
               }
          }
          // Brewery groups
          for (const bg of breweryGroups) {
               for (const kg of bg.kinds ?? []) {
                    const kindLabel = kg.kind != null ? enumLabel.productKind(kg.kind) : '—';
                    for (const pg of kg.packageSizes ?? []) {
                         const sizeLabel = pg.size != null ? `${pg.size} L` : '—';
                         const group = `${bg.breweryName ?? '—'} — ${kindLabel} — ${sizeLabel}`;
                         for (const p of pg.items ?? []) {
                              if (p.id && !seen.has(p.id)) {
                                   seen.add(p.id);
                                   list.push(Object.assign(Object.create(Object.getPrototypeOf(p)), p, { _group: group }));
                              }
                         }
                    }
               }
          }
          return list;
     }, [recentProducts, breweryGroups, enumLabel, t]);

     // Selected products as full objects for Autocomplete value
     const selectedProducts = useMemo(
          () => sortedProductList.filter((p) => selectedIds.has(p.id ?? '')),
          [sortedProductList, selectedIds],
     );

     const handleProductsChange = (_e: unknown, newValue: (ProductListItemDto & { _group: string })[]) => {
          const newIds = new Set(newValue.map((p) => p.id ?? ''));
          // Keep existing items that are still selected (preserving quantities/reminderState)
          const kept = items.filter((i) => newIds.has(i.productId));
          const keptIds = new Set(kept.map((i) => i.productId));
          // Add newly selected items with default quantity
          const added = newValue
               .filter((p) => p.id && !keptIds.has(p.id))
               .map((p) => ({ productId: p.id!, quantity: 1 }));
          onChange([...kept, ...added]);
     };

     // Update quantity for a specific item
     const handleQuantityChange = (productId: string, quantity: number) => {
          onChange(
               items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
          );
     };

     // Remove a single item
     const handleRemove = (productId: string) => {
          onChange(items.filter((i) => i.productId !== productId));
     };

     // Reminder state toggle
     const handleReminderClick = (e: React.MouseEvent<HTMLElement>, productId: string) => {
          const item = items.find((i) => i.productId === productId);
          if (!item) return;

          if (!item.reminderState) {
               updateReminderState(productId, 'Added');
          } else if (item.reminderState === 'Added') {
               setReminderPopover({ anchor: e.currentTarget, productId });
          } else {
               updateReminderState(productId, undefined);
          }
     };

     const updateReminderState = (productId: string, state: string | undefined) => {
          onChange(
               items.map((i) => (i.productId === productId ? { ...i, reminderState: state } : i)),
          );
     };

     return (
          <Box>
               {/* Product picker — searchable Autocomplete, grouped by Brewery — Kind — Size */}
               <Autocomplete
                    multiple
                    disableCloseOnSelect
                    disabled={!clientId}
                    options={sortedProductList}
                    getOptionLabel={(opt) => opt.name ?? ''}
                    filterOptions={(options, state) => {
                         const input = state.inputValue.toLowerCase();
                         if (!input) return options;
                         return options.filter((p) =>
                              (p.name ?? '').toLowerCase().includes(input) ||
                              (p.breweryName ?? '').toLowerCase().includes(input),
                         );
                    }}
                    groupBy={(opt) => (opt as any)._group ?? '—'}
                    value={selectedProducts}
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
                              label={t('orders.addItem')}
                              size="small"
                         />
                    )}
                    sx={{ mb: 2 }}
               />

               {/* Items table */}
               {items.length === 0 ? (
                    <EmptyState message={t('orders.noItems')} />
               ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                         <Table size="small" sx={{ minWidth: 600 }}>
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
                                             {t('orders.product')}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('orders.quantity')}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('products.kind')}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('products.packageSize')}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('products.priceWithVat')}</TableCell>
                                        <TableCell
                                             sx={{
                                                  position: { xs: 'static', sm: 'sticky' },
                                                  right: { sm: 0 },
                                                  zIndex: { sm: 3 },
                                                  bgcolor: 'background.neutral',
                                                  width: 80,
                                             }}
                                        />
                                   </TableRow>
                              </TableHead>
                              <TableBody>
                                   {items.map((item) => {
                                        const product = allProducts.get(item.productId);
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
                                                                      Math.max(1, parseInt(e.target.value, 10) || 1)
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
                                                            position: { xs: 'static', sm: 'sticky' },
                                                            right: { sm: 0 },
                                                            zIndex: { sm: 1 },
                                                            bgcolor: 'background.paper',
                                                            whiteSpace: 'nowrap',
                                                       }}
                                                  >
                                                       <IconButton
                                                            size="small"
                                                            onClick={(e) => handleReminderClick(e, item.productId)}
                                                            color={
                                                                 item.reminderState === 'Added'
                                                                      ? 'warning'
                                                                      : item.reminderState === 'Resolved'
                                                                        ? 'success'
                                                                        : 'default'
                                                            }
                                                       >
                                                            {item.reminderState === 'Added' ? (
                                                                 <NotificationsActiveOutlined fontSize="small" />
                                                            ) : item.reminderState === 'Resolved' ? (
                                                                 <CheckCircleOutlined fontSize="small" />
                                                            ) : (
                                                                 <NotificationsNoneOutlined fontSize="small" />
                                                            )}
                                                       </IconButton>
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

               {/* Reminder state popover (shown when state is "Added") */}
               <Popover
                    open={Boolean(reminderPopover)}
                    anchorEl={reminderPopover?.anchor}
                    onClose={() => setReminderPopover(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'center' }}
               >
                    <MenuItem
                         onClick={() => {
                              if (reminderPopover) updateReminderState(reminderPopover.productId, undefined);
                              setReminderPopover(null);
                         }}
                    >
                         <ListItemIcon>
                              <RemoveCircleOutlineOutlined fontSize="small" />
                         </ListItemIcon>
                         <ListItemText>{t('enums.orderItemReminderState.None')}</ListItemText>
                    </MenuItem>
                    <MenuItem
                         onClick={() => {
                              if (reminderPopover) updateReminderState(reminderPopover.productId, 'Resolved');
                              setReminderPopover(null);
                         }}
                    >
                         <ListItemIcon>
                              <CheckCircleOutlined fontSize="small" color="success" />
                         </ListItemIcon>
                         <ListItemText>{t('enums.orderItemReminderState.Resolved')}</ListItemText>
                    </MenuItem>
               </Popover>
          </Box>
     );
}
