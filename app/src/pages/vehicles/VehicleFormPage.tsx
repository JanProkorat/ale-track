import { z } from 'zod';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';

import { useVehicle, useCreateVehicle, useUpdateVehicle } from 'src/hooks/useVehicles';

import { CreateVehicleDto, UpdateVehicleDto } from 'src/generated/api-client';

import PageHeader from 'src/components/common/PageHeader';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const vehicleSchema = z.object({
     name: z.string().min(1),
     maxWeight: z.number().positive().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const defaultValues: VehicleFormValues = {
     name: '',
     maxWeight: undefined,
};

// ---------------------------------------------------------------------------
// VehicleFormPage
// ---------------------------------------------------------------------------

export default function VehicleFormPage() {
     const { t } = useTranslation();
     const { id } = useParams<{ id: string }>();
     const navigate = useNavigate();
     const isEdit = !!id;

     const { data: vehicle, isLoading } = useVehicle(id ?? '');
     const createMutation = useCreateVehicle();
     const updateMutation = useUpdateVehicle();

     const {
          control,
          handleSubmit,
          reset,
          formState: { errors },
     } = useForm<VehicleFormValues>({
          resolver: zodResolver(vehicleSchema),
          defaultValues,
     });

     // Populate form when vehicle data is loaded in edit mode
     useEffect(() => {
          if (vehicle && isEdit) {
               reset({
                    name: vehicle.name ?? '',
                    maxWeight: vehicle.maxWeight ?? undefined,
               });
          }
     }, [vehicle, isEdit, reset]);

     const onSubmit = (data: VehicleFormValues) => {
          if (isEdit && id) {
               const dto = new UpdateVehicleDto();
               dto.name = data.name;
               dto.maxWeight = data.maxWeight;

               updateMutation.mutate(
                    { id, data: dto },
                    { onSuccess: () => navigate('/vehicles') }
               );
          } else {
               const dto = new CreateVehicleDto();
               dto.name = data.name;
               dto.maxWeight = data.maxWeight;

               createMutation.mutate(dto, {
                    onSuccess: () => navigate('/vehicles'),
               });
          }
     };

     if (isEdit && isLoading) return <LoadingSpinner />;

     const isSaving = createMutation.isPending || updateMutation.isPending;

     return (
          <Box>
               <PageHeader title={isEdit ? t('vehicles.editVehicle') : t('vehicles.addVehicle')} />

               <Card>
                    <CardContent>
                         <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                              <Grid container spacing={3}>
                                   {/* Name */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="name"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       label={t('vehicles.name')}
                                                       fullWidth
                                                       error={!!errors.name}
                                                       helperText={errors.name?.message as string}
                                                  />
                                             )}
                                        />
                                   </Grid>

                                   {/* Max Weight */}
                                   <Grid size={{ xs: 12, sm: 6 }}>
                                        <Controller
                                             name="maxWeight"
                                             control={control}
                                             render={({ field }) => (
                                                  <TextField
                                                       {...field}
                                                       value={field.value ?? ''}
                                                       onChange={(e) =>
                                                            field.onChange(
                                                                 e.target.value === ''
                                                                      ? undefined
                                                                      : Number(e.target.value)
                                                            )
                                                       }
                                                       label={t('vehicles.maxWeight')}
                                                       type="number"
                                                       fullWidth
                                                       error={!!errors.maxWeight}
                                                       helperText={errors.maxWeight?.message as string}
                                                       slotProps={{
                                                            htmlInput: { min: 0 },
                                                       }}
                                                  />
                                             )}
                                        />
                                   </Grid>
                              </Grid>

                              {/* Actions */}
                              <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
                                   <Button variant="outlined" onClick={() => navigate('/vehicles')}>
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
