import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, useFieldArray } from 'react-hook-form';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DeleteIcon from '@mui/icons-material/Delete';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { useCreateDriver } from 'src/hooks/useDrivers';

import { CreateDriverDto, CreateDriverAvailabilityDto } from 'src/generated/api-client';

import { driverSchema, defaultValues } from '../driverFormSchema';

import type { DriverFormValues } from '../driverFormSchema';

// ---------------------------------------------------------------------------

interface CreateDriverDrawerProps {
     open: boolean;
     onClose: () => void;
     onCreated: (driverId: string) => void;
}

export default function CreateDriverDrawer({ open, onClose, onCreated }: CreateDriverDrawerProps) {
     const { t } = useTranslation();
     const createMutation = useCreateDriver();

     const {
          control,
          handleSubmit,
          reset,
          formState: { errors },
     } = useForm<DriverFormValues>({
          resolver: zodResolver(driverSchema),
          defaultValues,
     });

     const { fields, append, remove } = useFieldArray({
          control,
          name: 'availableDates',
     });

     const handleDrawerOpen = () => {
          reset(defaultValues);
     };

     const onSubmit = (data: DriverFormValues) => {
          const dto = new CreateDriverDto();
          dto.firstName = data.firstName;
          dto.lastName = data.lastName;
          dto.phoneNumber = data.phoneNumber || undefined;
          dto.color = data.color;
          dto.availableDates = data.availableDates.map((avail) => {
               const a = new CreateDriverAvailabilityDto();
               a.from = avail.from ? dayjs(avail.from).toDate() : undefined;
               a.until = avail.until ? dayjs(avail.until).toDate() : undefined;
               return a;
          });

          createMutation.mutate(dto, {
               onSuccess: (newDriverId) => {
                    onCreated(newDriverId);
                    reset(defaultValues);
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
                    paper: { sx: { width: { xs: '100%', sm: 600 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {t('drivers.addDriver')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
                         <Grid container spacing={2}>
                              {/* First Name */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="firstName"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('drivers.firstName')}
                                                  fullWidth
                                                  size="small"
                                                  required
                                                  error={!!errors.firstName}
                                                  helperText={errors.firstName?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* Last Name */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="lastName"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('drivers.lastName')}
                                                  fullWidth
                                                  size="small"
                                                  required
                                                  error={!!errors.lastName}
                                                  helperText={errors.lastName?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* Phone Number */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="phoneNumber"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('drivers.phoneNumber')}
                                                  fullWidth
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* Color */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="color"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('drivers.color')}
                                                  type="color"
                                                  fullWidth
                                                  size="small"
                                                  slotProps={{
                                                       inputLabel: { shrink: true },
                                                  }}
                                             />
                                        )}
                                   />
                              </Grid>
                         </Grid>

                         {/* Availability */}
                         <Stack direction="row" alignItems="center">
                              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                                   {t('drivers.availability')}
                              </Typography>
                              <Button
                                   size="small"
                                   startIcon={<AddIcon />}
                                   onClick={() => append({ from: null, until: null })}
                              >
                                   {t('drivers.addAvailability')}
                              </Button>
                         </Stack>

                         {fields.map((field, index) => (
                              <Stack key={field.id} direction="row" spacing={2} alignItems="center">
                                   <Controller
                                        name={`availableDates.${index}.from`}
                                        control={control}
                                        render={({ field: dateField }) => (
                                             <DateTimePicker
                                                  label={t('drivers.from')}
                                                  value={dateField.value ? dayjs(dateField.value) : null}
                                                  onChange={(val) => dateField.onChange(val)}
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
                                                  onChange={(val) => dateField.onChange(val)}
                                                  slotProps={{
                                                       textField: { fullWidth: true, size: 'small' },
                                                  }}
                                             />
                                        )}
                                   />
                                   <IconButton
                                        color="error"
                                        onClick={() => remove(index)}
                                        size="small"
                                   >
                                        <DeleteIcon fontSize="small" />
                                   </IconButton>
                              </Stack>
                         ))}
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
