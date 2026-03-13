import type { DragEndEvent } from '@dnd-kit/core';
import type { OutgoingShipmentOrderDto } from 'src/generated/api-client';

import dayjs from 'dayjs';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useMemo, useState, useCallback } from 'react';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSensor, DndContext, useSensors, closestCenter, PointerSensor, KeyboardSensor } from '@dnd-kit/core';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DeleteIcon from '@mui/icons-material/Delete';
import Autocomplete from '@mui/material/Autocomplete';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DragHandle from '@mui/icons-material/DragIndicator';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { useDrivers } from 'src/hooks/useDrivers';
import { useVehicles } from 'src/hooks/useVehicles';
import { useCreateOutgoingShipment, useOutgoingShipmentOrders } from 'src/hooks/useOutgoingShipments';

import {
     ClientOrderShipmentDto,
     CreateOutgoingShipmentDto,
     OutgoingShipmentStopAddressKind,
} from 'src/generated/api-client';

import OrderMultiSelect, { OrderItemsTable } from './OrderMultiSelect';
import { createDefaultValues, createOutgoingShipmentSchema } from '../outgoingShipmentFormSchema';

import type { CreateOutgoingShipmentFormValues } from '../outgoingShipmentFormSchema';

// ---------------------------------------------------------------------------
// Sortable selected order card
// ---------------------------------------------------------------------------

function SortableOrderCard({
     id,
     order,
     index,
     onRemove,
}: {
     id: string;
     order: OutgoingShipmentOrderDto;
     index: number;
     onRemove: (orderId: string) => void;
}) {
     const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
     // Items expanded by default — track collapsed state locally
     const [collapsed, setCollapsed] = useState(false);
     const items = order.items ?? [];

     const style = {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
     };

     return (
          <Paper ref={setNodeRef} style={style} variant="outlined" sx={{ p: 1.5 }}>
               <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton
                         size="small"
                         sx={{ cursor: 'grab', touchAction: 'none' }}
                         {...attributes}
                         {...listeners}
                    >
                         <DragHandle fontSize="small" />
                    </IconButton>

                    <Chip label={index + 1} size="small" variant="outlined" sx={{ minWidth: 28 }} />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                         <Typography variant="body2" fontWeight={600} noWrap>
                              {order.clientName ?? '—'}
                         </Typography>
                         {order.requiredDeliveryDate && (
                              <Typography variant="caption" color="text.secondary">
                                   {new Date(order.requiredDeliveryDate).toLocaleDateString()}
                              </Typography>
                         )}
                    </Box>

                    {items.length > 0 && (
                         <IconButton size="small" onClick={() => setCollapsed((p) => !p)}>
                              {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                         </IconButton>
                    )}

                    <IconButton size="small" color="error" onClick={() => onRemove(order.id ?? '')}>
                         <DeleteIcon fontSize="small" />
                    </IconButton>
               </Stack>

               {items.length > 0 && (
                    <Collapse in={!collapsed}>
                         <Box sx={{ mt: 1, ml: 5 }}>
                              <OrderItemsTable order={order} />
                         </Box>
                    </Collapse>
               )}
          </Paper>
     );
}

// ---------------------------------------------------------------------------
// CreateShipmentDrawer
// ---------------------------------------------------------------------------

interface CreateShipmentDrawerProps {
     open: boolean;
     onClose: () => void;
     onCreated: (shipmentId: string) => void;
}

export default function CreateShipmentDrawer({
     open,
     onClose,
     onCreated,
}: CreateShipmentDrawerProps) {
     const { t } = useTranslation();
     const createMutation = useCreateOutgoingShipment();
     const { data: drivers = [] } = useDrivers();
     const { data: vehicles = [] } = useVehicles();
     const { data: availableOrders = [] } = useOutgoingShipmentOrders(null);

     // Ordered array of selected order IDs (preserves insertion + drag order)
     const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

     const {
          control,
          handleSubmit,
          reset,
          watch,
          setValue,
          formState: { errors },
     } = useForm<CreateOutgoingShipmentFormValues>({
          resolver: zodResolver(createOutgoingShipmentSchema),
          defaultValues: createDefaultValues,
     });

     const watchedDriverIds = watch('driverIds');
     const selectedDrivers = drivers.filter((d) => (watchedDriverIds ?? []).includes(d.id ?? ''));
     const selectedVehicle = vehicles.find((v) => v.id === watch('vehicleId')) ?? null;

     const handleDrawerOpen = () => {
          reset(createDefaultValues);
          setSelectedOrderIds([]);
     };

     const toggleOrder = useCallback((orderId: string) => {
          setSelectedOrderIds((prev) => {
               if (prev.includes(orderId)) return prev.filter((id) => id !== orderId);
               return [...prev, orderId];
          });
     }, []);

     const removeOrder = useCallback((orderId: string) => {
          setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
     }, []);

     // DnD for reordering selected orders
     const sensors = useSensors(
          useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
          useSensor(KeyboardSensor),
     );

     const handleDragEnd = useCallback((event: DragEndEvent) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          setSelectedOrderIds((prev) => {
               const oldIndex = prev.indexOf(active.id as string);
               const newIndex = prev.indexOf(over.id as string);
               if (oldIndex === -1 || newIndex === -1) return prev;
               return arrayMove(prev, oldIndex, newIndex);
          });
     }, []);

     const selectedOrders = useMemo(
          () => selectedOrderIds
               .map((id) => availableOrders.find((o) => o.id === id))
               .filter((o): o is OutgoingShipmentOrderDto => !!o),
          [selectedOrderIds, availableOrders],
     );

     const onSubmit = (data: CreateOutgoingShipmentFormValues) => {
          const dto = new CreateOutgoingShipmentDto();
          dto.name = data.name;
          dto.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : undefined;
          dto.driverIds = data.driverIds;
          dto.vehicleId = data.vehicleId || undefined;
          dto.clientOrderShipments = selectedOrderIds.map((orderId, i) => {
               const stopDto = new ClientOrderShipmentDto();
               stopDto.clientOrderId = orderId;
               stopDto.order = i + 1;
               stopDto.selectedAddressKind = OutgoingShipmentStopAddressKind.Official;
               return stopDto;
          });

          createMutation.mutate(dto, {
               onSuccess: (newShipmentId) => {
                    onCreated(newShipmentId);
                    reset(createDefaultValues);
                    setSelectedOrderIds([]);
               },
          });
     };

     return (
          <Drawer
               anchor="right"
               open={open}
               onClose={onClose}
               slotProps={{
                    transition: { onEnter: handleDrawerOpen },
                    paper: { sx: { width: { xs: '100%', sm: 560 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {t('outgoingShipments.addShipment')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
                         <Grid container spacing={2}>
                              {/* Name */}
                              <Grid size={{ xs: 12 }}>
                                   <Controller
                                        name="name"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('outgoingShipments.name')}
                                                  size="small"
                                                  fullWidth
                                                  error={!!errors.name}
                                                  helperText={errors.name?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* Delivery Date */}
                              <Grid size={{ xs: 12 }}>
                                   <Controller
                                        name="deliveryDate"
                                        control={control}
                                        render={({ field, fieldState: { error } }) => (
                                             <DatePicker
                                                  label={t('outgoingShipments.deliveryDate')}
                                                  value={field.value ? dayjs(field.value) : null}
                                                  onChange={(val) =>
                                                       field.onChange(val ? val.format('YYYY-MM-DD') : '')
                                                  }
                                                  slotProps={{
                                                       textField: {
                                                            fullWidth: true,
                                                            size: 'small',
                                                            error: !!error,
                                                            helperText: error?.message,
                                                       },
                                                  }}
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* Drivers */}
                              <Grid size={{ xs: 12 }}>
                                   <Autocomplete
                                        multiple
                                        disableCloseOnSelect
                                        options={drivers}
                                        getOptionLabel={(opt) =>
                                             `${opt.firstName ?? ''} ${opt.lastName ?? ''}`.trim()
                                        }
                                        value={selectedDrivers}
                                        onChange={(_e, newValue) => {
                                             setValue(
                                                  'driverIds',
                                                  newValue.map((d) => d.id ?? '').filter(Boolean),
                                             );
                                        }}
                                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                        renderInput={(params) => (
                                             <TextField
                                                  {...params}
                                                  label={t('outgoingShipments.drivers')}
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* Vehicle */}
                              <Grid size={{ xs: 12 }}>
                                   <Autocomplete
                                        options={vehicles}
                                        getOptionLabel={(opt) => opt.name ?? ''}
                                        value={selectedVehicle}
                                        onChange={(_e, newValue) => {
                                             setValue('vehicleId', newValue?.id ?? '');
                                        }}
                                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                        renderInput={(params) => (
                                             <TextField
                                                  {...params}
                                                  label={t('outgoingShipments.vehicle')}
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>
                         </Grid>

                         <Divider />

                         {/* Orders section */}
                         <Typography variant="subtitle2">
                              {t('outgoingShipments.stops')} ({selectedOrderIds.length})
                         </Typography>

                         <OrderMultiSelect
                              availableOrders={availableOrders}
                              selectedOrders={selectedOrders}
                              onToggle={toggleOrder}
                         />

                         {/* Sortable selected orders list */}
                         {selectedOrders.length > 0 && (
                              <DndContext
                                   sensors={sensors}
                                   collisionDetection={closestCenter}
                                   modifiers={[restrictToVerticalAxis]}
                                   onDragEnd={handleDragEnd}
                              >
                                   <SortableContext items={selectedOrderIds} strategy={verticalListSortingStrategy}>
                                        <Stack spacing={1}>
                                             {selectedOrders.map((order, idx) => (
                                                  <SortableOrderCard
                                                       key={order.id!}
                                                       id={order.id!}
                                                       order={order}
                                                       index={idx}
                                                       onRemove={removeOrder}
                                                  />
                                             ))}
                                        </Stack>
                                   </SortableContext>
                              </DndContext>
                         )}
                    </Stack>

                    {/* Actions */}
                    <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
                         <Button variant="outlined" onClick={onClose}>
                              {t('common.cancel')}
                         </Button>
                         <LoadingButton
                              type="submit"
                              variant="contained"
                              loading={createMutation.isPending}
                         >
                              {t('common.save')}
                         </LoadingButton>
                    </Stack>
               </Box>
          </Drawer>
     );
}
