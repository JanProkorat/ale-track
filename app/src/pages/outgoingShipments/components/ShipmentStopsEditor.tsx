import type { DragEndEvent } from '@dnd-kit/core';
import type {
     OutgoingShipmentStopDto,
     OutgoingShipmentOrderDto,
     OutgoingShipmentProductDto,
} from 'src/generated/api-client';

import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { useMemo, useState, useCallback } from 'react';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSensor, DndContext, useSensors, closestCenter, PointerSensor, KeyboardSensor } from '@dnd-kit/core';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import ListItemText from '@mui/material/ListItemText';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ListItemButton from '@mui/material/ListItemButton';
import TableContainer from '@mui/material/TableContainer';
import DragHandle from '@mui/icons-material/DragIndicator';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { useCurrency } from 'src/providers/CurrencyProvider';
import { OutgoingShipmentStopAddressKind } from 'src/generated/api-client';

import SectionCard from 'src/components/common/SectionCard';

import { addressKindOptions } from '../outgoingShipmentFormSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShipmentStopRow {
     clientOrderId: string;
     order: number;
     selectedAddressKind: string;
}

interface ShipmentStopsEditorProps {
     stops: ShipmentStopRow[];
     onChange: (stops: ShipmentStopRow[]) => void;
     availableOrders: OutgoingShipmentOrderDto[];
     /** Read-only stop details from the detail DTO (for display) */
     stopDetails?: OutgoingShipmentStopDto[];
}

// ---------------------------------------------------------------------------
// Products table (read-only display from stop details)
// ---------------------------------------------------------------------------

function StopProductsTable({ products }: { products: OutgoingShipmentProductDto[] }) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const { formatPrice } = useCurrency();

     if (products.length === 0) return null;

     return (
          <TableContainer sx={{ overflowX: 'auto' }}>
               <Table size="small" sx={{ minWidth: 400 }}>
                    <TableHead>
                         <TableRow>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('productDeliveries.product')}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('productDeliveries.quantity')}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('products.kind')}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('products.packageSize')}</TableCell>
                         </TableRow>
                    </TableHead>
                    <TableBody>
                         {products.map((product, idx) => (
                              <TableRow key={product.id ?? idx}>
                                   <TableCell sx={{ whiteSpace: 'nowrap' }}>{product.name ?? '-'}</TableCell>
                                   <TableCell align="right">{product.quantity ?? 0}</TableCell>
                                   <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {product.kind != null ? enumLabel.productKind(product.kind) : '-'}
                                   </TableCell>
                                   <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {product.packageSize != null ? `${product.packageSize} L` : '-'}
                                   </TableCell>
                              </TableRow>
                         ))}
                    </TableBody>
               </Table>
          </TableContainer>
     );
}

// ---------------------------------------------------------------------------
// Order select picker with collapsible items
// ---------------------------------------------------------------------------

function OrderSelectPicker({
     availableOrders,
     selectedOrderId,
     onSelect,
}: {
     availableOrders: OutgoingShipmentOrderDto[];
     selectedOrderId: string;
     onSelect: (orderId: string) => void;
}) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
     const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

     const toggleExpanded = (id: string) => {
          setExpanded((prev) => {
               const next = new Set(prev);
               if (next.has(id)) next.delete(id);
               else next.add(id);
               return next;
          });
     };

     const selectedOrder = availableOrders.find((o) => o.id === selectedOrderId) ?? null;
     const label = selectedOrder
          ? `${selectedOrder.clientName ?? ''} — ${selectedOrder.requiredDeliveryDate ? new Date(selectedOrder.requiredDeliveryDate).toLocaleDateString() : ''}`
          : '';

     return (
          <>
               <TextField
                    label={t('outgoingShipments.selectOrder')}
                    size="small"
                    fullWidth
                    value={label}
                    onClick={(e) => setAnchorEl(e.currentTarget as HTMLElement)}
                    slotProps={{ input: { readOnly: true, sx: { cursor: 'pointer' } } }}
               />

               <Popover
                    open={Boolean(anchorEl)}
                    anchorEl={anchorEl}
                    onClose={() => setAnchorEl(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    slotProps={{
                         paper: {
                              sx: {
                                   width: anchorEl?.offsetWidth ?? 400,
                                   maxHeight: 420,
                                   overflow: 'auto',
                              },
                         },
                    }}
               >
                    {availableOrders.length === 0 ? (
                         <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                              {t('common.noData')}
                         </Typography>
                    ) : (
                         <List dense disablePadding>
                              {availableOrders.map((order) => {
                                   const orderId = order.id ?? '';
                                   const isExpanded = expanded.has(orderId);
                                   const isSelected = orderId === selectedOrderId;
                                   const items = order.items ?? [];

                                   return (
                                        <Box key={orderId}>
                                             <ListItemButton
                                                  sx={{
                                                       py: 0.75,
                                                       bgcolor: isSelected ? 'action.selected' : undefined,
                                                  }}
                                             >
                                                  <ListItemText
                                                       onClick={() => {
                                                            onSelect(orderId);
                                                            setAnchorEl(null);
                                                       }}
                                                       primary={order.clientName ?? '—'}
                                                       secondary={
                                                            order.requiredDeliveryDate
                                                                 ? new Date(order.requiredDeliveryDate).toLocaleDateString()
                                                                 : undefined
                                                       }
                                                       primaryTypographyProps={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.875rem' }}
                                                  />
                                                  {items.length > 0 && (
                                                       <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 toggleExpanded(orderId);
                                                            }}
                                                       >
                                                            {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                                       </IconButton>
                                                  )}
                                             </ListItemButton>

                                             {items.length > 0 && (
                                                  <Collapse in={isExpanded}>
                                                       <Table size="small" sx={{ ml: 2, mr: 1, mb: 1, width: 'auto' }}>
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
                                                  </Collapse>
                                             )}
                                        </Box>
                                   );
                              })}
                         </List>
                    )}
               </Popover>
          </>
     );
}

// ---------------------------------------------------------------------------
// Sortable stop card
// ---------------------------------------------------------------------------

function SortableStopCard({
     id,
     stop,
     stopIndex,
     availableOrders,
     stopDetail,
     onStopChange,
     onRemove,
}: {
     id: string;
     stop: ShipmentStopRow;
     stopIndex: number;
     availableOrders: OutgoingShipmentOrderDto[];
     stopDetail?: OutgoingShipmentStopDto;
     onStopChange: (index: number, partial: Partial<ShipmentStopRow>) => void;
     onRemove: (index: number) => void;
}) {
     const { t } = useTranslation();
     const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

     // The selected order can come from availableOrders or from stopDetail
     const selectedOrder = availableOrders.find((o) => o.id === stop.clientOrderId) ?? null;
     const clientName = selectedOrder?.clientName ?? stopDetail?.clientName ?? '';
     const title = clientName || `${t('outgoingShipments.stops')} ${stopIndex + 1}`;

     const style = {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
     };

     return (
          <Box ref={setNodeRef} style={style}>
               <SectionCard
                    title={title}
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
                         <OrderSelectPicker
                              availableOrders={availableOrders}
                              selectedOrderId={stop.clientOrderId}
                              onSelect={(orderId) => onStopChange(stopIndex, { clientOrderId: orderId })}
                         />

                         <TextField
                              select
                              label={t('outgoingShipments.addressKind')}
                              size="small"
                              fullWidth
                              value={stop.selectedAddressKind}
                              onChange={(e) =>
                                   onStopChange(stopIndex, { selectedAddressKind: e.target.value })
                              }
                         >
                              {addressKindOptions.map((opt) => (
                                   <MenuItem key={opt.value} value={opt.value}>
                                        {t(opt.labelKey)}
                                   </MenuItem>
                              ))}
                         </TextField>

                         {/* Show address info if available */}
                         {stopDetail && (
                              <Box>
                                   {stopDetail.selectedAddressKind === OutgoingShipmentStopAddressKind.Contact &&
                                   stopDetail.contactAddress ? (
                                        <Typography variant="body2" color="text.secondary">
                                             {[
                                                  stopDetail.contactAddress.streetName,
                                                  stopDetail.contactAddress.streetNumber,
                                                  stopDetail.contactAddress.city,
                                                  stopDetail.contactAddress.zip,
                                             ]
                                                  .filter(Boolean)
                                                  .join(', ')}
                                        </Typography>
                                   ) : stopDetail.officialAddress ? (
                                        <Typography variant="body2" color="text.secondary">
                                             {[
                                                  stopDetail.officialAddress.streetName,
                                                  stopDetail.officialAddress.streetNumber,
                                                  stopDetail.officialAddress.city,
                                                  stopDetail.officialAddress.zip,
                                             ]
                                                  .filter(Boolean)
                                                  .join(', ')}
                                        </Typography>
                                   ) : null}
                              </Box>
                         )}

                         {/* Products (read-only from detail) */}
                         {stopDetail?.products && stopDetail.products.length > 0 && (
                              <StopProductsTable products={stopDetail.products} />
                         )}
                    </Stack>
               </SectionCard>
          </Box>
     );
}

// ---------------------------------------------------------------------------
// ShipmentStopsEditor
// ---------------------------------------------------------------------------

export default function ShipmentStopsEditor({
     stops,
     onChange,
     availableOrders,
     stopDetails,
}: ShipmentStopsEditorProps) {
     const { t } = useTranslation();

     const sortableIds = useMemo(
          () => stops.map((stop, i) => stop.clientOrderId || `new-${i}`),
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
                    const reordered = arrayMove(stops, oldIndex, newIndex).map((s, i) => ({
                         ...s,
                         order: i + 1,
                    }));
                    onChange(reordered);
               }
          },
          [stops, onChange, sortableIds],
     );

     const handleRemoveStop = (index: number) => {
          const updated = stops.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
          onChange(updated);
     };

     const handleStopChange = (index: number, partial: Partial<ShipmentStopRow>) => {
          const updated = stops.map((stop, i) => (i === index ? { ...stop, ...partial } : stop));
          onChange(updated);
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
                                   availableOrders={availableOrders}
                                   stopDetail={stopDetails?.find((d) => d.orderId === stop.clientOrderId)}
                                   onStopChange={handleStopChange}
                                   onRemove={handleRemoveStop}
                              />
                         ))}
                    </Stack>
               </SortableContext>
          </DndContext>
     );
}
