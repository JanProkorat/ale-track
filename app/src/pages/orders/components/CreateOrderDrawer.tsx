import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { useClients } from 'src/hooks/useClients';
import { useCreateOrder } from 'src/hooks/useOrders';

import {
     CreateOrderDto,
     CreateOrderItemDto,
     OrderItemReminderState,
} from 'src/generated/api-client';

import { createOrderSchema, createDefaultValues } from '../orderFormSchema';

import type { CreateOrderFormValues } from '../orderFormSchema';

import OrderItemsEditor from './OrderItemsEditor';

import type { OrderItemRow } from './OrderItemsEditor';

// ---------------------------------------------------------------------------

interface CreateOrderDrawerProps {
     open: boolean;
     onClose: () => void;
     onCreated: (orderId: string) => void;
}

export default function CreateOrderDrawer({
     open,
     onClose,
     onCreated,
}: CreateOrderDrawerProps) {
     const { t } = useTranslation();
     const createMutation = useCreateOrder();
     const { data: clients = [] } = useClients();

     const [items, setItems] = useState<OrderItemRow[]>([]);

     const {
          control,
          handleSubmit,
          watch,
          reset,
          formState: { errors },
     } = useForm<CreateOrderFormValues>({
          resolver: zodResolver(createOrderSchema),
          defaultValues: createDefaultValues,
     });

     const watchedClientId = watch('clientId');

     const handleDrawerOpen = () => {
          reset(createDefaultValues);
          setItems([]);
     };

     const onSubmit = (data: CreateOrderFormValues) => {
          const dto = new CreateOrderDto();
          dto.clientId = data.clientId;
          dto.requiredDeliveryDate = data.requiredDeliveryDate
               ? new Date(data.requiredDeliveryDate)
               : undefined;
          dto.orderItems = items.map((item) => {
               const itemDto = new CreateOrderItemDto();
               itemDto.productId = item.productId;
               itemDto.quantity = item.quantity;
               itemDto.reminderState = item.reminderState
                    ? (item.reminderState as unknown as OrderItemReminderState)
                    : undefined;
               return itemDto;
          });

          createMutation.mutate(dto, {
               onSuccess: (newOrderId) => {
                    onCreated(newOrderId);
                    reset(createDefaultValues);
                    setItems([]);
               },
          });
     };

     const selectedClient = clients.find((c) => c.id === watchedClientId) ?? null;

     return (
          <Drawer
               anchor="right"
               open={open}
               onClose={onClose}
               slotProps={{
                    transition: { onEnter: handleDrawerOpen },
                    paper: { sx: { width: { xs: '100%', sm: 600 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {t('orders.addOrder')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
                         {/* Client */}
                         <Controller
                              name="clientId"
                              control={control}
                              render={({ field }) => (
                                   <Autocomplete
                                        options={clients}
                                        getOptionLabel={(opt) => opt.name ?? ''}
                                        value={selectedClient}
                                        onChange={(_e, newValue) => field.onChange(newValue?.id ?? '')}
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

                         {/* Required Delivery Date */}
                         <Controller
                              name="requiredDeliveryDate"
                              control={control}
                              render={({ field, fieldState: { error } }) => (
                                   <DatePicker
                                        label={t('orders.requiredDeliveryDate')}
                                        value={field.value ? dayjs(field.value) : null}
                                        onChange={(val) => field.onChange(val ? val.format('YYYY-MM-DD') : '')}
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

                         <Divider />

                         {/* Order items */}
                         <Typography variant="subtitle2">
                              {t('orders.items')}
                         </Typography>

                         <OrderItemsEditor
                              items={items}
                              onChange={setItems}
                         />
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
