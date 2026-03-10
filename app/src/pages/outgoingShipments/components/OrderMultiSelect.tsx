import type { OutgoingShipmentOrderDto } from 'src/generated/api-client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

import { useEnumLabel } from 'src/utils/enumTranslations';

// ---------------------------------------------------------------------------
// Order items table
// ---------------------------------------------------------------------------

export function OrderItemsTable({ order }: { order: OutgoingShipmentOrderDto }) {
     const enumLabel = useEnumLabel();
     const items = order.items ?? [];
     if (items.length === 0) return null;

     return (
          <Table size="medium" sx={{ width: 'auto' }}>
               <TableBody>
                    {items.map((item, idx) => (
                         <TableRow key={item.productId ?? idx} sx={{ '& td': { border: 0, py: 0.25, px: 1 } }}>
                              <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                   {item.productName ?? '-'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.8125rem' }}>
                                   {item.quantity ?? 0}x
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                                   {item.kind != null ? enumLabel.productKind(item.kind) : ''}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                                   {item.packageSize != null ? `${item.packageSize} L` : ''}
                              </TableCell>
                         </TableRow>
                    ))}
               </TableBody>
          </Table>
     );
}

// ---------------------------------------------------------------------------
// OrderMultiSelect
// ---------------------------------------------------------------------------

interface OrderMultiSelectProps {
     availableOrders: OutgoingShipmentOrderDto[];
     selectedOrders: OutgoingShipmentOrderDto[];
     onToggle: (orderId: string) => void;
}

export default function OrderMultiSelect({
     availableOrders,
     selectedOrders,
     onToggle,
}: OrderMultiSelectProps) {
     const { t } = useTranslation();
     const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

     const toggleCollapsed = (id: string) => {
          setCollapsed((prev) => {
               const next = new Set(prev);
               if (next.has(id)) next.delete(id);
               else next.add(id);
               return next;
          });
     };

     const selectedSet = useMemo(() => new Set(selectedOrders.map((o) => o.id ?? '')), [selectedOrders]);

     return (
          <Autocomplete
               multiple
               disableCloseOnSelect
               options={availableOrders}
               value={selectedOrders}
               getOptionLabel={(opt) => opt.clientName ?? ''}
               isOptionEqualToValue={(opt, val) => opt.id === val.id}
               onChange={(_e, _newValue, _reason, details) => {
                    if (details?.option) {
                         onToggle(details.option.id ?? '');
                    }
               }}
               renderTags={(value) =>
                    value.map((order) => (
                         <Chip
                              key={order.id}
                              label={order.clientName ?? order.id}
                              size="medium"
                              onDelete={() => onToggle(order.id ?? '')}
                              sx={{ m: 0.25 }}
                         />
                    ))
               }
               renderOption={(props, option) => {
                    const orderId = option.id ?? '';
                    const isSelected = selectedSet.has(orderId);
                    const items = option.items ?? [];
                    const isExpanded = !collapsed.has(orderId);
                    const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };

                    return (
                         <li key={key} {...rest} style={{ ...rest.style, display: 'block', padding: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.75 }}>
                                   <Checkbox
                                        size="small"
                                        checked={isSelected}
                                        tabIndex={-1}
                                        disableRipple
                                        sx={{ mr: 1, p: 0 }}
                                   />
                                   <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight={isSelected ? 700 : 500} noWrap>
                                             {option.clientName ?? '—'}
                                        </Typography>
                                        {option.requiredDeliveryDate && (
                                             <Typography variant="caption" color="text.secondary">
                                                  {new Date(option.requiredDeliveryDate).toLocaleDateString()}
                                             </Typography>
                                        )}
                                   </Box>
                                   {items.length > 0 && (
                                        <IconButton
                                             size="small"
                                             onClick={(e) => {
                                                  e.stopPropagation();
                                                  e.preventDefault();
                                                  toggleCollapsed(orderId);
                                             }}
                                        >
                                             {isExpanded ? (
                                                  <ExpandLess fontSize="small" />
                                             ) : (
                                                  <ExpandMore fontSize="small" />
                                             )}
                                        </IconButton>
                                   )}
                              </Box>
                              {items.length > 0 && (
                                   <Collapse in={isExpanded}>
                                        <Box sx={{ ml: 4, mr: 1, mb: 0.5 }}>
                                             <OrderItemsTable order={option} />
                                        </Box>
                                   </Collapse>
                              )}
                         </li>
                    );
               }}
               renderInput={(params) => (
                    <TextField {...params} label={t('outgoingShipments.selectOrder')} size="small" />
               )}
               slotProps={{
                    listbox: { sx: { maxHeight: 400 } },
               }}
          />
     );
}
