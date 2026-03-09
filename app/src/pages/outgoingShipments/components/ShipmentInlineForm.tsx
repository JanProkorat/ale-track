import type { OutgoingShipmentDetailDto } from 'src/generated/api-client';

import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useRef, useMemo, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import SectionCard from 'src/components/common/SectionCard';

import { useDrivers } from 'src/hooks/useDrivers';
import { useVehicles } from 'src/hooks/useVehicles';
import { useOutgoingShipmentOrders } from 'src/hooks/useOutgoingShipments';

import RouteMapSection from './RouteMapSection';
import OrderMultiSelect from './OrderMultiSelect';
import ShipmentLoadingTable from './ShipmentLoadingTable';
import { outgoingShipmentSchema, defaultValues, shipmentStateOptions } from '../outgoingShipmentFormSchema';

import type { OutgoingShipmentFormValues } from '../outgoingShipmentFormSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShipmentInlineFormHandle {
     submit: () => void;
     resetForm: () => void;
}

export interface FormHeaderState {
     isDirty: boolean;
     name: string;
     state: string;
}

interface ShipmentInlineFormProps {
     shipment: OutgoingShipmentDetailDto;
     onSubmit: (data: OutgoingShipmentFormValues) => void;
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

function mapShipmentToFormValues(shipment: OutgoingShipmentDetailDto): OutgoingShipmentFormValues {
     return {
          name: shipment.name ?? '',
          deliveryDate: formatDate(shipment.deliveryDate),
          state: (shipment.state as unknown as string) ?? 'Created',
          vehicleId: shipment.vehicleId ?? '',
          driverIds: shipment.driverIds ?? [],
          clientOrderShipments: (shipment.stops ?? []).map((stop, i) => ({
               clientOrderId: stop.orderId ?? '',
               order: stop.order ?? (i + 1),
               selectedAddressKind: (stop.selectedAddressKind as unknown as string) ?? 'Official',
          })),
     };
}

// ---------------------------------------------------------------------------
// ShipmentInlineForm
// ---------------------------------------------------------------------------

const ShipmentInlineForm = forwardRef<ShipmentInlineFormHandle, ShipmentInlineFormProps>(
     function ShipmentInlineForm({ shipment, onSubmit, onFormStateChange }, ref) {
          const { t } = useTranslation();
          const initialValuesRef = useRef<OutgoingShipmentFormValues>(defaultValues);
          const onSubmitRef = useRef(onSubmit);
          onSubmitRef.current = onSubmit;

          const [dirty, setDirty] = useState(false);

          const { data: drivers = [] } = useDrivers();
          const { data: vehicles = [] } = useVehicles();
          const { data: availableOrders = [] } = useOutgoingShipmentOrders(shipment.id);

          const {
               control,
               trigger,
               getValues,
               reset,
               watch,
               setValue,
               formState: { errors },
          } = useForm<OutgoingShipmentFormValues>({
               resolver: zodResolver(outgoingShipmentSchema),
               defaultValues,
          });

          const watchedName = watch('name');
          const watchedState = watch('state');
          const watchedDriverIds = watch('driverIds');
          const watchedStops = watch('clientOrderShipments');

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
                    name: watchedName,
                    state: watchedState,
               });
          }, [dirty, watchedName, watchedState, onFormStateChange]);

          // Reset form when shipment data changes
          useEffect(() => {
               if (!shipment) return;
               const values = mapShipmentToFormValues(shipment);
               initialValuesRef.current = values;
               reset(values);
               setDirty(false);
          }, [shipment, reset]);

          const selectedVehicle = vehicles.find((v) => v.id === watch('vehicleId')) ?? null;
          const selectedDrivers = drivers.filter((d) => (watchedDriverIds ?? []).includes(d.id ?? ''));

          const handleStopsChange = (stops: typeof watchedStops) => {
               setValue('clientOrderShipments', stops);
               markDirty();
          };

          const selectedOrderIds = useMemo(
               () => new Set((watchedStops ?? []).map((s) => s.clientOrderId)),
               [watchedStops],
          );
          const selectedOrders = useMemo(
               () => availableOrders.filter((o) => selectedOrderIds.has(o.id ?? '')),
               [availableOrders, selectedOrderIds],
          );

          const toggleOrder = useCallback(
               (orderId: string) => {
                    const current = watchedStops ?? [];
                    if (selectedOrderIds.has(orderId)) {
                         const updated = current
                              .filter((s) => s.clientOrderId !== orderId)
                              .map((s, i) => ({ ...s, order: i + 1 }));
                         setValue('clientOrderShipments', updated);
                    } else {
                         setValue('clientOrderShipments', [
                              ...current,
                              { clientOrderId: orderId, order: current.length + 1, selectedAddressKind: 'Official' },
                         ]);
                    }
                    markDirty();
               },
               [watchedStops, selectedOrderIds, setValue],
          );

          return (
               <Stack spacing={2} onChange={markDirty}>
                    {/* Info */}
                    <SectionCard title={t('outgoingShipments.editShipment')}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
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
                                                  label={t('outgoingShipments.state')}
                                                  size="small"
                                                  fullWidth
                                             >
                                                  {shipmentStateOptions.map((opt) => (
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
                                        name="deliveryDate"
                                        control={control}
                                        render={({ field, fieldState: { error } }) => (
                                             <DatePicker
                                                  label={t('outgoingShipments.deliveryDate')}
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
                                                  label={t('outgoingShipments.vehicle')}
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>
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
                                             markDirty();
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
                              <Grid size={{ xs: 12 }}>
                                   <OrderMultiSelect
                                        availableOrders={availableOrders}
                                        selectedOrders={selectedOrders}
                                        onToggle={toggleOrder}
                                   />
                              </Grid>
                         </Grid>
                    </SectionCard>

                    {/* Route Map */}
                    <SectionCard title={t('outgoingShipments.routeMap')}>
                         <RouteMapSection
                              stops={shipment.stops}
                              formStops={watchedStops ?? []}
                              onStopsChange={handleStopsChange}
                         />
                    </SectionCard>

                    {/* Nakládka */}
                    <SectionCard title={t('outgoingShipments.loading')}>
                         <ShipmentLoadingTable
                              stops={shipment.stops}
                              formStops={watchedStops ?? []}
                              availableOrders={availableOrders}
                         />
                    </SectionCard>
               </Stack>
          );
     },
);

export default ShipmentInlineForm;
