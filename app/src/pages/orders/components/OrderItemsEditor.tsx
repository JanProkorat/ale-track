import type { KindGroupDto, BreweryGroupDto, PackageGroupDto, ProductListItemDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Table from '@mui/material/Table';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ListItemButton from '@mui/material/ListItemButton';
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

     // Flat lookup for table rows and chip labels
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

     // Product picker popover
     const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);

     // Collapsible sections: track collapsed keys (all expanded by default)
     const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

     const toggleCollapsed = useCallback((key: string) => {
          setCollapsed((prev) => {
               const next = new Set(prev);
               if (next.has(key)) next.delete(key);
               else next.add(key);
               return next;
          });
     }, []);

     // Products already selected (by id)
     const selectedIds = useMemo(() => new Set(items.map((i) => i.productId)), [items]);

     // Toggle a product in the selection
     const toggleProduct = (product: ProductListItemDto) => {
          const id = product.id ?? '';
          if (selectedIds.has(id)) {
               onChange(items.filter((i) => i.productId !== id));
          } else {
               onChange([...items, { productId: id, quantity: 1 }]);
          }
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

     // --- Render helpers for the pre-grouped tree ---

     const renderProductItem = (product: ProductListItemDto, indent: number) => {
          const checked = selectedIds.has(product.id ?? '');
          return (
               <ListItemButton
                    key={product.id}
                    onClick={() => toggleProduct(product)}
                    sx={{ pl: indent, py: 0.25 }}
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
     };

     const renderPackageGroup = (pg: PackageGroupDto, parentKey: string) => {
          const sizeLabel = pg.size != null ? `${pg.size} L` : '—';
          const sizeKey = `${parentKey}:s:${sizeLabel}`;
          const sizeOpen = !collapsed.has(sizeKey);

          return (
               <Box key={sizeKey}>
                    <ListItemButton onClick={() => toggleCollapsed(sizeKey)} sx={{ pl: 6, py: 0.25 }}>
                         <ListItemText
                              primary={sizeLabel}
                              primaryTypographyProps={{ fontSize: '0.8125rem', color: 'text.secondary' }}
                         />
                         {sizeOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </ListItemButton>
                    <Collapse in={sizeOpen}>
                         {(pg.items ?? []).map((product) => renderProductItem(product, 8))}
                    </Collapse>
               </Box>
          );
     };

     const renderKindGroup = (kg: KindGroupDto, parentKey: string) => {
          const kindLabel = kg.kind != null ? enumLabel.productKind(kg.kind) : '—';
          const kindKey = `${parentKey}:k:${kindLabel}`;
          const kindOpen = !collapsed.has(kindKey);

          return (
               <Box key={kindKey}>
                    <ListItemButton onClick={() => toggleCollapsed(kindKey)} sx={{ pl: 4, py: 0.25 }}>
                         <ListItemText
                              primary={kindLabel}
                              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.8125rem' }}
                         />
                         {kindOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </ListItemButton>
                    <Collapse in={kindOpen}>
                         {(kg.packageSizes ?? []).map((pg) => renderPackageGroup(pg, kindKey))}
                    </Collapse>
               </Box>
          );
     };

     const renderBreweryGroup = (bg: BreweryGroupDto) => {
          const brewKey = `b:${bg.breweryName ?? '—'}`;
          const brewOpen = !collapsed.has(brewKey);

          return (
               <Box key={brewKey}>
                    <ListItemButton onClick={() => toggleCollapsed(brewKey)} sx={{ py: 0.5 }}>
                         <ListItemText
                              primary={bg.breweryName ?? '—'}
                              primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }}
                         />
                         {brewOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </ListItemButton>
                    <Collapse in={brewOpen}>
                         {(bg.kinds ?? []).map((kg) => renderKindGroup(kg, brewKey))}
                    </Collapse>
               </Box>
          );
     };

     return (
          <Box>
               {/* Product picker trigger */}
               <Box
                    onClick={(e) => clientId && setPickerAnchor(e.currentTarget as HTMLElement)}
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
                         cursor: clientId ? 'pointer' : 'default',
                         opacity: clientId ? 1 : 0.5,
                         '&:hover': clientId ? { borderColor: 'text.primary' } : undefined,
                    }}
               >
                    {items.length === 0 ? (
                         <Typography variant="body2" color="text.secondary">
                              {t('orders.addItem')}
                         </Typography>
                    ) : (
                         items.map((item) => {
                              const product = allProducts.get(item.productId);
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

               {/* Product picker popover with recent + brewery tree */}
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
                         {/* Recent (history) section */}
                         {recentProducts.length > 0 && (
                              <>
                                   <ListItemButton
                                        onClick={() => toggleCollapsed('recent')}
                                        sx={{ py: 0.5, bgcolor: 'action.hover' }}
                                   >
                                        <ListItemText
                                             primary={t('orders.recentProducts')}
                                             primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem', color: 'primary.main' }}
                                        />
                                        {!collapsed.has('recent') ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                   </ListItemButton>
                                   <Collapse in={!collapsed.has('recent')}>
                                        {recentProducts.map((product) => renderProductItem(product, 2))}
                                   </Collapse>
                                   <Divider />
                              </>
                         )}

                         {/* Brewery groups */}
                         {breweryGroups.map((bg) => renderBreweryGroup(bg))}
                    </List>
               </Popover>

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
