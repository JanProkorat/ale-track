import type { DriverDto } from 'src/generated/api-client';

import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import SectionCard from 'src/components/common/SectionCard';

import { driverSchema, defaultValues } from '../driverFormSchema';

import type { DriverFormValues } from '../driverFormSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriverInlineFormHandle {
     submit: () => void;
     resetForm: () => void;
}

export interface FormHeaderState {
     isDirty: boolean;
     name: string;
}

interface DriverInlineFormProps {
     driver: DriverDto;
     onSubmit: (data: DriverFormValues) => void;
     onFormStateChange: (state: FormHeaderState) => void;
}

// ---------------------------------------------------------------------------
// Map DTO to form values
// ---------------------------------------------------------------------------

function mapDriverToFormValues(driver: DriverDto): DriverFormValues {
     return {
          firstName: driver.firstName ?? '',
          lastName: driver.lastName ?? '',
          phoneNumber: driver.phoneNumber ?? '',
          color: driver.color ?? '#6366f1',
          availableDates: (driver.availableDates ?? []).map((avail) => ({
               from: avail.from ? dayjs(avail.from) : null,
               until: avail.until ? dayjs(avail.until) : null,
          })),
     };
}

// ---------------------------------------------------------------------------
// DriverInlineForm
// ---------------------------------------------------------------------------

const DriverInlineForm = forwardRef<DriverInlineFormHandle, DriverInlineFormProps>(
     function DriverInlineForm({ driver, onSubmit, onFormStateChange }, ref) {
          const { t } = useTranslation();
          const onSubmitRef = { current: onSubmit };
          onSubmitRef.current = onSubmit;

          const [dirty, setDirty] = useState(false);

          const {
               control,
               trigger,
               getValues,
               reset,
               watch,
               formState: { errors },
          } = useForm<DriverFormValues>({
               resolver: zodResolver(driverSchema),
               defaultValues,
          });

          const { fields, append, remove } = useFieldArray({
               control,
               name: 'availableDates',
          });

          const watchedFirstName = watch('firstName');
          const watchedLastName = watch('lastName');

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
                         const values = mapDriverToFormValues(driver);
                         reset(values);
                         setDirty(false);
                    },
               }),
               [trigger, getValues, reset, driver],
          );

          // Notify parent of form state changes
          useEffect(() => {
               onFormStateChange({
                    isDirty: dirty,
                    name: `${watchedFirstName} ${watchedLastName}`.trim(),
               });
          }, [dirty, watchedFirstName, watchedLastName, onFormStateChange]);

          // Reset form when driver data changes
          useEffect(() => {
               if (!driver) return;
               const values = mapDriverToFormValues(driver);
               reset(values);
               setDirty(false);
          }, [driver, reset]);

          return (
               <Stack spacing={2} onChange={markDirty}>
                    {/* Info */}
                    <SectionCard title={t('breweries.info')}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="firstName"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('drivers.firstName')}
                                                  size="small"
                                                  fullWidth
                                                  error={!!errors.firstName}
                                                  helperText={errors.firstName?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="lastName"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('drivers.lastName')}
                                                  size="small"
                                                  fullWidth
                                                  error={!!errors.lastName}
                                                  helperText={errors.lastName?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="phoneNumber"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('drivers.phoneNumber')}
                                                  size="small"
                                                  fullWidth
                                             />
                                        )}
                                   />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="color"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('drivers.color')}
                                                  type="color"
                                                  size="small"
                                                  fullWidth
                                                  slotProps={{
                                                       inputLabel: { shrink: true },
                                                  }}
                                             />
                                        )}
                                   />
                              </Grid>
                         </Grid>
                    </SectionCard>

                    {/* Availability */}
                    <SectionCard
                         title={t('drivers.availability')}
                         action={
                              <Button
                                   variant="contained"
                                   color="inherit"
                                   size="small"
                                   startIcon={<AddIcon />}
                                   onClick={() => { append({ from: null, until: null }); markDirty(); }}
                              >
                                   {t('drivers.addAvailability')}
                              </Button>
                         }
                    >
                         <Stack spacing={2}>
                              {fields.length === 0 && (
                                   <Stack alignItems="center" sx={{ py: 2, color: 'text.secondary' }}>
                                        {t('common.noData')}
                                   </Stack>
                              )}
                              {fields.map((field, index) => (
                                   <Stack
                                        key={field.id}
                                        direction="row"
                                        spacing={2}
                                        alignItems="center"
                                   >
                                        <Controller
                                             name={`availableDates.${index}.from`}
                                             control={control}
                                             render={({ field: dateField }) => (
                                                  <DateTimePicker
                                                       label={t('drivers.from')}
                                                       value={dateField.value ? dayjs(dateField.value) : null}
                                                       onChange={(val) => { dateField.onChange(val); markDirty(); }}
                                                       slotProps={{
                                                            textField: { fullWidth: true, size: 'small' },
                                                       }}
                                                  />
                                             )}
                                        />
                                        <Controller
                                             name={`availableDates.${index}.until`}
                                             control={control}
                                             render={({ field: dateField }) => (
                                                  <DateTimePicker
                                                       label={t('drivers.until')}
                                                       value={dateField.value ? dayjs(dateField.value) : null}
                                                       onChange={(val) => { dateField.onChange(val); markDirty(); }}
                                                       slotProps={{
                                                            textField: { fullWidth: true, size: 'small' },
                                                       }}
                                                  />
                                             )}
                                        />
                                        <IconButton
                                             color="error"
                                             onClick={() => { remove(index); markDirty(); }}
                                             size="small"
                                        >
                                             <DeleteIcon fontSize="small" />
                                        </IconButton>
                                   </Stack>
                              ))}
                         </Stack>
                    </SectionCard>
               </Stack>
          );
     },
);

export default DriverInlineForm;
