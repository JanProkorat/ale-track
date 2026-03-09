import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { CreateProductsDeliveryDto } from 'src/generated/api-client';

import { useDrivers } from 'src/hooks/useDrivers';
import { useVehicles } from 'src/hooks/useVehicles';
import { useCreateProductDelivery } from 'src/hooks/useProductDeliveries';

import { createProductDeliverySchema, createDefaultValues } from '../productDeliveryFormSchema';

import type { CreateProductDeliveryFormValues } from '../productDeliveryFormSchema';

// ---------------------------------------------------------------------------

interface CreateDeliveryDrawerProps {
     open: boolean;
     onClose: () => void;
     onCreated: (deliveryId: string) => void;
}

export default function CreateDeliveryDrawer({
     open,
     onClose,
     onCreated,
}: CreateDeliveryDrawerProps) {
     const { t } = useTranslation();
     const createMutation = useCreateProductDelivery();
     const { data: drivers = [] } = useDrivers();
     const { data: vehicles = [] } = useVehicles();

     const {
          control,
          handleSubmit,
          reset,
          watch,
          setValue,
          getValues,
     } = useForm<CreateProductDeliveryFormValues>({
          resolver: zodResolver(createProductDeliverySchema),
          defaultValues: createDefaultValues,
     });

     const watchedDriverIds = watch('driverIds');
     const selectedDrivers = drivers.filter((d) => (watchedDriverIds ?? []).includes(d.id ?? ''));
     const selectedVehicle = vehicles.find((v) => v.id === watch('vehicleId')) ?? null;

     const handleDrawerOpen = () => {
          reset(createDefaultValues);
     };

     const onSubmit = (data: CreateProductDeliveryFormValues) => {
          const dto = new CreateProductsDeliveryDto();
          dto.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : new Date();
          dto.driverIds = data.driverIds;
          dto.vehicleId = data.vehicleId || undefined;
          dto.note = data.note || undefined;
          dto.stops = [];

          createMutation.mutate(dto, {
               onSuccess: (newDeliveryId) => {
                    onCreated(newDeliveryId);
                    reset(createDefaultValues);
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
                    paper: { sx: { width: { xs: '100%', sm: 500 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {t('productDeliveries.addDelivery')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
                         <Grid container spacing={2}>
                              {/* Delivery Date */}
                              <Grid size={{ xs: 12 }}>
                                   <Controller
                                        name="deliveryDate"
                                        control={control}
                                        render={({ field, fieldState: { error } }) => (
                                             <DatePicker
                                                  label={t('productDeliveries.deliveryDate')}
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
                                                  label={t('productDeliveries.drivers')}
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
                                                  label={t('productDeliveries.vehicle')}
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* Note */}
                              <Grid size={{ xs: 12 }}>
                                   <Controller
                                        name="note"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('productDeliveries.note')}
                                                  size="small"
                                                  fullWidth
                                                  multiline
                                                  minRows={2}
                                             />
                                        )}
                                   />
                              </Grid>
                         </Grid>
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
