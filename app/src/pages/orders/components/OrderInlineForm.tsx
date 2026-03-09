import type { OrderDto } from 'src/generated/api-client';

import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import SectionCard from 'src/components/common/SectionCard';

import { useClients } from 'src/hooks/useClients';

import OrderItemsEditor from './OrderItemsEditor';
import { orderSchema, defaultValues, orderStateOptions } from '../orderFormSchema';

import type { OrderItemRow } from './OrderItemsEditor';
import type { OrderFormValues } from '../orderFormSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderInlineFormHandle {
     submit: () => void;
     resetForm: () => void;
}

export interface FormHeaderState {
     isDirty: boolean;
     clientName: string;
     state: string;
}

interface OrderInlineFormProps {
     order: OrderDto;
     onSubmit: (data: OrderFormValues) => void;
     onFormStateChange: (state: FormHeaderState) => void;
}

// ---------------------------------------------------------------------------
// Map DTO to form values
// ---------------------------------------------------------------------------

function formatDate(date: Date | undefined | null): string {
     if (!date) return '';
     const d = new Date(date);
     return d.toISOString().split('T')[0];
}

function mapOrderToFormValues(order: OrderDto): OrderFormValues {
     return {
          clientId: order.client?.id ?? '',
          state: (order.state as unknown as string) ?? 'New',
          requiredDeliveryDate: formatDate(order.requiredDeliveryDate),
          actualDeliveryDate: formatDate(order.actualDeliveryDate),
          orderItems: (order.orderItems ?? []).map((item) => ({
               productId: item.productId ?? '',
               quantity: item.quantity ?? 1,
               reminderState: (item.reminderState as unknown as string) ?? undefined,
          })),
     };
}

// ---------------------------------------------------------------------------
// OrderInlineForm
// ---------------------------------------------------------------------------

const OrderInlineForm = forwardRef<OrderInlineFormHandle, OrderInlineFormProps>(
     function OrderInlineForm({ order, onSubmit, onFormStateChange }, ref) {
          const { t } = useTranslation();
          const initialValuesRef = useRef<OrderFormValues>(defaultValues);
          const onSubmitRef = useRef(onSubmit);
          onSubmitRef.current = onSubmit;

          const [dirty, setDirty] = useState(false);

          const { data: clients = [] } = useClients();

          const {
               control,
               trigger,
               getValues,
               reset,
               watch,
               setValue,
               formState: { errors },
          } = useForm<OrderFormValues>({
               resolver: zodResolver(orderSchema),
               defaultValues,
          });

          const watchedClientId = watch('clientId');
          const watchedState = watch('state');
          const orderItems = watch('orderItems');

          const markDirty = () => setDirty(true);

          useImperativeHandle(
               ref,
               () => ({
                    submit: async () => {
                         const isValid = await trigger();
                         if (isValid) {
                              onSubmitRef.current(getValues());
                              setDirty(false);
                         }
                    },
                    resetForm: () => {
                         reset(initialValuesRef.current);
                         setDirty(false);
                    },
               }),
               [trigger, getValues, reset],
          );

          // Notify parent of form state changes
          useEffect(() => {
               const client = clients.find((c) => c.id === watchedClientId);
               onFormStateChange({
                    isDirty: dirty,
                    clientName: client?.name ?? '',
                    state: watchedState,
               });
          }, [dirty, watchedClientId, watchedState, clients, onFormStateChange]);

          // Reset form when order data changes
          useEffect(() => {
               if (!order) return;
               const values = mapOrderToFormValues(order);
               initialValuesRef.current = values;
               reset(values);
               setDirty(false);
          }, [order, reset]);

          const selectedClient = clients.find((c) => c.id === watchedClientId) ?? null;

          const handleItemsChange = (items: OrderItemRow[]) => {
               setValue('orderItems', items);
               markDirty();
          };

          return (
               <Stack spacing={2} onChange={markDirty}>
                    {/* Info */}
                    <SectionCard title={t('orders.info')}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="clientId"
                                        control={control}
                                        render={({ field }) => (
                                             <Autocomplete
                                                  options={clients}
                                                  getOptionLabel={(opt) => opt.name ?? ''}
                                                  value={selectedClient}
                                                  onChange={(_e, newValue) => {
                                                       field.onChange(newValue?.id ?? '');
                                                       markDirty();
                                                  }}
                                                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                                  renderInput={(params) => (
                                                       <TextField
                                                            {...params}
                                                            label={t('orders.client')}
                                                            size="small"
                                                            error={!!errors.clientId}
                                                            helperText={errors.clientId?.message as string}
                                                       />
                                                  )}
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="state"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  onChange={(e) => {
                                                       field.onChange(e);
                                                       markDirty();
                                                  }}
                                                  select
                                                  label={t('orders.state')}
                                                  size="small"
                                                  fullWidth
                                             >
                                                  {orderStateOptions.map((opt) => (
                                                       <MenuItem key={opt.value} value={opt.value}>
                                                            {t(opt.labelKey)}
                                                       </MenuItem>
                                                  ))}
                                             </TextField>
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="requiredDeliveryDate"
                                        control={control}
                                        render={({ field, fieldState: { error } }) => (
                                             <DatePicker
                                                  label={t('orders.requiredDeliveryDate')}
                                                  value={field.value ? dayjs(field.value) : null}
                                                  onChange={(val) => {
                                                       field.onChange(val ? val.format('YYYY-MM-DD') : '');
                                                       markDirty();
                                                  }}
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
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="actualDeliveryDate"
                                        control={control}
                                        render={({ field }) => (
                                             <DatePicker
                                                  label={t('orders.actualDeliveryDate')}
                                                  value={field.value ? dayjs(field.value) : null}
                                                  onChange={(val) => {
                                                       field.onChange(val ? val.format('YYYY-MM-DD') : '');
                                                       markDirty();
                                                  }}
                                                  slotProps={{
                                                       textField: { fullWidth: true, size: 'small' },
                                                  }}
                                             />
                                        )}
                                   />
                              </Grid>
                         </Grid>
                    </SectionCard>

                    {/* Order Items */}
                    <SectionCard title={`${t('orders.items')} (${orderItems?.length ?? 0})`}>
                         <OrderItemsEditor
                              items={orderItems ?? []}
                              onChange={handleItemsChange}
                         />
                    </SectionCard>
               </Stack>
          );
     },
);

export default OrderInlineForm;
