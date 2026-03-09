import { z } from 'zod';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import DeleteIcon from '@mui/icons-material/Delete';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { useDriver, useCreateDriver, useUpdateDriver } from 'src/hooks/useDrivers';

import {
     CreateDriverDto,
     UpdateDriverDto,
     CreateDriverAvailabilityDto,
     UpdateDriverAvailabilityDto,
} from 'src/generated/api-client';

import PageHeader from 'src/components/common/PageHeader';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const availabilitySchema = z.object({
     from: z.any().nullable(),
     until: z.any().nullable(),
});

const driverSchema = z.object({
     firstName: z.string().min(1),
     lastName: z.string().min(1),
     phoneNumber: z.string().optional().or(z.literal('')),
     color: z.string().min(1),
     availableDates: z.array(availabilitySchema),
});

type DriverFormValues = z.infer<typeof driverSchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const defaultValues: DriverFormValues = {
     firstName: '',
     lastName: '',
     phoneNumber: '',
     color: '#6366f1',
     availableDates: [],
};

// ---------------------------------------------------------------------------
// DriverFormPage
// ---------------------------------------------------------------------------

export default function DriverFormPage() {
     const { t } = useTranslation();
     const { id } = useParams<{ id: string }>();
     const navigate = useNavigate();
     const isEdit = !!id;

     const { data: driver, isLoading } = useDriver(id ?? '');
     const createMutation = useCreateDriver();
     const updateMutation = useUpdateDriver();

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

     // Populate form when driver data is loaded in edit mode
     useEffect(() => {
          if (driver && isEdit) {
               reset({
                    firstName: driver.firstName ?? '',
                    lastName: driver.lastName ?? '',
                    phoneNumber: driver.phoneNumber ?? '',
                    color: driver.color ?? '#6366f1',
                    availableDates: (driver.availableDates ?? []).map((avail) => ({
                         from: avail.from ? dayjs(avail.from) : null,
                         until: avail.until ? dayjs(avail.until) : null,
                    })),
               });
          }
     }, [driver, isEdit, reset]);

     const onSubmit = (data: DriverFormValues) => {
          if (isEdit && id) {
               const dto = new UpdateDriverDto();
               dto.firstName = data.firstName;
               dto.lastName = data.lastName;
               dto.phoneNumber = data.phoneNumber || undefined;
               dto.color = data.color;
               dto.availableDates = data.availableDates.map((avail) => {
                    const a = new UpdateDriverAvailabilityDto();
                    a.from = avail.from ? dayjs(avail.from).toDate() : undefined;
                    a.until = avail.until ? dayjs(avail.until).toDate() : undefined;
                    return a;
               });

               updateMutation.mutate(
                    { id, data: dto },
                    { onSuccess: () => navigate('/drivers') },
               );
          } else {
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
                    onSuccess: () => navigate('/drivers'),
               });
          }
     };

     if (isEdit && isLoading) return <LoadingSpinner />;

     const isSaving = createMutation.isPending || updateMutation.isPending;

     return (
          <Box>
               <PageHeader title={isEdit ? t('drivers.editDriver') : t('drivers.addDriver')} />

               <Card>
                    <CardContent>
                         <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                              <Grid container spacing={3}>
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
                                                       error={!!errors.phoneNumber}
                                                       helperText={errors.phoneNumber?.message as string}
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
                                                       error={!!errors.color}
                                                       helperText={errors.color?.message as string}
                                                       slotProps={{
                                                            inputLabel: { shrink: true },
                                                       }}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Availability dates */}
                                   <Grid size={12}>
                                        <Stack
                                             direction="row"
                                             alignItems="center"
                                             justifyContent="space-between"
                                             sx={{ mb: 2 }}
                                        >
                                             <Typography variant="subtitle1">
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

                                        <Stack spacing={2}>
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
                                                                 <DatePicker
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
                                                                 <DatePicker
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
                                                            <DeleteIcon />
                                                       </IconButton>
                                                  </Stack>
                                             ))}
                                        </Stack>
                                   </Grid>
                              </Grid>

                              {/* Actions */}
                              <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
                                   <Button variant="outlined" onClick={() => navigate('/drivers')}>
                                        {t('common.cancel')}
                                   </Button>
                                   <LoadingButton type="submit" variant="contained" loading={isSaving}>
                                        {t('common.save')}
                                   </LoadingButton>
                              </Stack>
                         </Box>
                    </CardContent>
               </Card>
          </Box>
     );
}
