import type { ProductListItemDto } from 'src/generated/api-client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Table from '@mui/material/Table';
import Paper from '@mui/material/Paper';
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
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import DeleteIcon from '@mui/icons-material/Delete';
import TableContainer from '@mui/material/TableContainer';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import RemoveCircleOutlineOutlined from '@mui/icons-material/RemoveCircleOutlineOutlined';

import { useProducts } from 'src/hooks/useProducts';

import { useCurrency } from 'src/providers/CurrencyProvider';
import { useEnumLabel } from 'src/utils/enumTranslations';

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
     items: OrderItemRow[];
     onChange: (items: OrderItemRow[]) => void;
}

// ---------------------------------------------------------------------------
// Grouped tree structure
// ---------------------------------------------------------------------------

interface SizeGroup {
     size: string;
     sizeNum: number | undefined;
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
     }

     const result: BreweryGroup[] = [];
     for (const [brewery, kindMap] of [...brewMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          const kinds: KindGroup[] = [];
          for (const [kind, sizeMap] of [...kindMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
               const sizes: SizeGroup[] = [];
               for (const [size, prods] of [...sizeMap.entries()].sort(([a], [b]) => {
                    const na = parseFloat(a) || 0;
                    const nb = parseFloat(b) || 0;
                    return na - nb;
               })) {
                    sizes.push({
                         size,
                         sizeNum: prods[0]?.packageSize ?? undefined,
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
// OrderItemsEditor
// ---------------------------------------------------------------------------

export default function OrderItemsEditor({ items, onChange }: OrderItemsEditorProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { formatPrice } = useCurrency();
     const { data: products = [] } = useProducts();

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

     // Grouped tree
     const tree = useMemo(() => buildTree(products, enumLabel), [products, enumLabel]);

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

     return (
          <Box>
               {/* Product picker trigger */}
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
                    {items.length === 0 ? (
                         <Typography variant="body2" color="text.secondary">
                              {t('orders.addItem')}
                         </Typography>
                    ) : (
                         items.map((item) => {
                              const product = products.find((p) => p.id === item.productId);
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
                         {tree.map((breweryGroup) => {
                              const brewKey = `b:${breweryGroup.brewery}`;
                              const brewOpen = !collapsed.has(brewKey);

                              return (
                                   <Box key={brewKey}>
                                        {/* Brewery header */}
                                        <ListItemButton
                                             onClick={() => toggleCollapsed(brewKey)}
                                             sx={{ py: 0.5 }}
                                        >
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
                                                            {/* Kind header */}
                                                            <ListItemButton
                                                                 onClick={() => toggleCollapsed(kindKey)}
                                                                 sx={{ pl: 4, py: 0.25 }}
                                                            >
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
                                                                                {/* Size header */}
                                                                                <ListItemButton
                                                                                     onClick={() => toggleCollapsed(sizeKey)}
                                                                                     sx={{ pl: 6, py: 0.25 }}
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
                                                  position: 'sticky',
                                                  right: 0,
                                                  zIndex: 3,
                                                  bgcolor: 'background.neutral',
                                                  width: 80,
                                             }}
                                        />
                                   </TableRow>
                              </TableHead>
                              <TableBody>
                                   {items.map((item) => {
                                        const product = products.find((p) => p.id === item.productId);
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
                                                            position: 'sticky',
                                                            right: 0,
                                                            zIndex: 1,
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
