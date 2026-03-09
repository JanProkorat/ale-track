import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { CreateVehicleDto } from 'src/generated/api-client';

import { useCreateVehicle } from 'src/hooks/useVehicles';

// ---------------------------------------------------------------------------

interface FormValues {
     name: string;
     maxWeight: string;
}

const defaultValues: FormValues = { name: '', maxWeight: '' };

interface CreateVehicleDrawerProps {
     open: boolean;
     onClose: () => void;
     onCreated: () => void;
}

export default function CreateVehicleDrawer({ open, onClose, onCreated }: CreateVehicleDrawerProps) {
     const { t } = useTranslation();
     const createMutation = useCreateVehicle();

     const {
          control,
          handleSubmit,
          reset,
          formState: { errors },
     } = useForm<FormValues>({ defaultValues });

     const handleDrawerOpen = () => {
          reset(defaultValues);
     };

     const onSubmit = (data: FormValues) => {
          const dto = new CreateVehicleDto();
          dto.name = data.name;
          dto.maxWeight = data.maxWeight ? Number(data.maxWeight) : undefined;

          createMutation.mutate(dto, {
               onSuccess: () => {
                    onCreated();
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
                    paper: { sx: { width: { xs: '100%', sm: 400 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {t('vehicles.addVehicle')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1 }}>
                         <Controller
                              name="name"
                              control={control}
                              rules={{ required: t('common.required') }}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        label={t('vehicles.name')}
                                        fullWidth
                                        size="small"
                                        required
                                        error={!!errors.name}
                                        helperText={errors.name?.message as string}
                                   />
                              )}
                         />

                         <Controller
                              name="maxWeight"
                              control={control}
                              render={({ field }) => (
                                   <TextField
                                        {...field}
                                        label={t('vehicles.maxWeight')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        slotProps={{
                                             input: {
                                                  endAdornment: (
                                                       <InputAdornment position="end">kg</InputAdornment>
                                                  ),
                                             },
                                        }}
                                   />
                              )}
                         />
                    </Stack>

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
