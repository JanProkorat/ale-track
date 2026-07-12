import type { ProductDeliveryDto } from 'src/generated/api-client';

import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { useDrivers } from 'src/hooks/useDrivers';
import { useVehicles } from 'src/hooks/useVehicles';

import SectionCard from 'src/components/common/SectionCard';

import DeliveryStopsEditor from './DeliveryStopsEditor';
import { defaultValues, deliveryStateOptions, productDeliverySchema } from '../productDeliveryFormSchema';

import type { StopRow } from './DeliveryStopsEditor';
import type { ProductDeliveryFormValues } from '../productDeliveryFormSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliveryInlineFormHandle {
     submit: () => void;
     resetForm: () => void;
}

export interface FormHeaderState {
     isDirty: boolean;
     deliveryDate: string;
     state: string;
}

interface DeliveryInlineFormProps {
     delivery: ProductDeliveryDto;
     onSubmit: (data: ProductDeliveryFormValues) => void;
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

function mapDeliveryToFormValues(delivery: ProductDeliveryDto): ProductDeliveryFormValues {
     return {
          deliveryDate: formatDate(delivery.deliveryDate),
          state: (delivery.state as unknown as string) ?? 'InPlanning',
          driverIds: (delivery.drivers ?? []).map((d) => d.id ?? '').filter(Boolean),
          vehicleId: delivery.vehicle?.id ?? '',
          note: delivery.note ?? '',
          stops: (delivery.stops ?? []).map((stop) => ({
               publicId: stop.id ?? undefined,
               breweryId: stop.brewery?.id ?? '',
               note: stop.note ?? '',
               products: (stop.products ?? []).map((p) => ({
                    productId: p.productId ?? '',
                    quantity: p.quantity ?? 1,
                    note: p.note ?? '',
               })),
          })),
     };
}

// ---------------------------------------------------------------------------
// DeliveryInlineForm
// ---------------------------------------------------------------------------

const DeliveryInlineForm = forwardRef<DeliveryInlineFormHandle, DeliveryInlineFormProps>(
     function DeliveryInlineForm({ delivery, onSubmit, onFormStateChange }, ref) {
          const { t } = useTranslation();
          const initialValuesRef = useRef<ProductDeliveryFormValues>(defaultValues);
          const onSubmitRef = useRef(onSubmit);
          onSubmitRef.current = onSubmit;

          const [dirty, setDirty] = useState(false);

          const { data: drivers = [] } = useDrivers();
          const { data: vehicles = [] } = useVehicles();

          const {
               control,
               trigger,
               getValues,
               reset,
               watch,
               setValue,
          } = useForm<ProductDeliveryFormValues>({
               resolver: zodResolver(productDeliverySchema),
               defaultValues,
          });

          const watchedDate = watch('deliveryDate');
          const watchedState = watch('state');
          const watchedStops = watch('stops');
          const watchedDriverIds = watch('driverIds');

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
               onFormStateChange({
                    isDirty: dirty,
                    deliveryDate: watchedDate,
                    state: watchedState,
               });
          }, [dirty, watchedDate, watchedState, onFormStateChange]);

          // Reset form when delivery data changes
          useEffect(() => {
               if (!delivery) return;
               const values = mapDeliveryToFormValues(delivery);
               initialValuesRef.current = values;
               reset(values);
               setDirty(false);
          }, [delivery, reset]);

          const selectedVehicle = vehicles.find((v) => v.id === watch('vehicleId')) ?? null;
          const selectedDrivers = drivers.filter((d) => (watchedDriverIds ?? []).includes(d.id ?? ''));

          const handleStopsChange = (stops: StopRow[]) => {
               setValue('stops', stops);
               markDirty();
          };

          return (
               <Stack spacing={2} onChange={markDirty}>
                    {/* Info */}
                    <SectionCard title={t('productDeliveries.info')}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="deliveryDate"
                                        control={control}
                                        render={({ field, fieldState: { error } }) => (
                                             <DatePicker
                                                  label={t('productDeliveries.deliveryDate')}
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
                                        name="state"
                                        control={control}
                                        render={({ field }) => (
                                             <Autocomplete
                                                  options={deliveryStateOptions}
                                                  getOptionLabel={(opt) => t(opt.labelKey)}
                                                  value={deliveryStateOptions.find((o) => o.value === field.value) ?? null}
                                                  onChange={(_e, newValue) => {
                                                       field.onChange(newValue?.value ?? '');
                                                       markDirty();
                                                  }}
                                                  isOptionEqualToValue={(opt, val) => opt.value === val.value}
                                                  size="small"
                                                  fullWidth
                                                  renderInput={(params) => (
                                                       <TextField
                                                            {...params}
                                                            label={t('productDeliveries.state')}
                                                            size="small"
                                                            fullWidth
                                                       />
                                                  )}
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
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
                                             markDirty();
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
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Autocomplete
                                        options={vehicles}
                                        getOptionLabel={(opt) => opt.name ?? ''}
                                        value={selectedVehicle}
                                        onChange={(_e, newValue) => {
                                             setValue('vehicleId', newValue?.id ?? '');
                                             markDirty();
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
                    </SectionCard>

                    {/* Stops */}
                    <SectionCard
                         title={`${t('productDeliveries.stops')} (${watchedStops?.length ?? 0})`}
                         action={
                              <Button
                                   variant="contained"
                                   color="inherit"
                                   size="small"
                                   startIcon={<AddIcon />}
                                   onClick={() => {
                                        handleStopsChange([
                                             ...(watchedStops ?? []),
                                             { breweryId: '', note: '', products: [] },
                                        ]);
                                   }}
                              >
                                   {t('productDeliveries.addStop')}
                              </Button>
                         }
                    >
                         <DeliveryStopsEditor
                              stops={watchedStops ?? []}
                              onChange={handleStopsChange}
                         />
                    </SectionCard>
               </Stack>
          );
     },
);

export default DeliveryInlineForm;
