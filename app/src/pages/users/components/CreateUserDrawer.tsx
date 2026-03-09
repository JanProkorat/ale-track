import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { CreateUserDto, UserRoleType } from 'src/generated/api-client';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { useCreateUser } from 'src/hooks/useUsers';

import { createUserSchema, createDefaultValues } from '../userFormSchema';

import type { CreateUserFormValues } from '../userFormSchema';

// ---------------------------------------------------------------------------

const allRoles = [UserRoleType.Admin, UserRoleType.User];

interface CreateUserDrawerProps {
     open: boolean;
     onClose: () => void;
     onCreated: (userId: string) => void;
}

export default function CreateUserDrawer({ open, onClose, onCreated }: CreateUserDrawerProps) {
     const { t } = useTranslation();
     const enumLabel = useEnumLabel();
     const createMutation = useCreateUser();

     const {
          control,
          handleSubmit,
          reset,
          watch,
          getValues,
          setValue,
          formState: { errors },
     } = useForm<CreateUserFormValues>({
          resolver: zodResolver(createUserSchema),
          defaultValues: createDefaultValues,
     });

     const watchedRoles = watch('userRoles');

     const handleDrawerOpen = () => {
          reset(createDefaultValues);
     };

     const handleRoleToggle = (role: UserRoleType) => {
          const current = getValues('userRoles');
          const next = current.includes(role)
               ? current.filter((r) => r !== role)
               : [...current, role];
          setValue('userRoles', next);
     };

     const onSubmit = (data: CreateUserFormValues) => {
          const dto = new CreateUserDto();
          dto.userName = data.userName;
          dto.password = data.password;
          dto.firstName = data.firstName || undefined;
          dto.lastName = data.lastName || undefined;
          dto.userRoles = data.userRoles;

          createMutation.mutate(dto, {
               onSuccess: (newUserId) => {
                    onCreated(newUserId);
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
                    paper: { sx: { width: { xs: '100%', sm: 480 }, p: 3 } },
               }}
          >
               <Typography variant="h6" sx={{ mb: 3 }}>
                    {t('users.addUser')}
               </Typography>

               <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
               >
                    <Stack spacing={3} sx={{ flex: 1, overflow: 'auto' }}>
                         <Grid container spacing={2}>
                              {/* Username */}
                              <Grid size={{ xs: 12 }}>
                                   <Controller
                                        name="userName"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('users.userName')}
                                                  fullWidth
                                                  size="small"
                                                  required
                                                  error={!!errors.userName}
                                                  helperText={errors.userName?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* Password */}
                              <Grid size={{ xs: 12 }}>
                                   <Controller
                                        name="password"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('users.password')}
                                                  type="password"
                                                  fullWidth
                                                  size="small"
                                                  required
                                                  error={!!errors.password}
                                                  helperText={errors.password?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>

                              {/* First Name */}
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="firstName"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('users.firstName')}
                                                  fullWidth
                                                  size="small"
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
                                                  label={t('users.lastName')}
                                                  fullWidth
                                                  size="small"
                                             />
                                        )}
                                   />
                              </Grid>
                         </Grid>

                         {/* Roles */}
                         <Box>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                   {t('users.roles')}
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                   {allRoles.map((role) => {
                                        const selected = (watchedRoles ?? []).includes(role);
                                        return (
                                             <Chip
                                                  key={role}
                                                  label={enumLabel.userRole(role)}
                                                  color={selected ? 'primary' : 'default'}
                                                  variant={selected ? 'filled' : 'outlined'}
                                                  onClick={() => handleRoleToggle(role)}
                                                  sx={{ cursor: 'pointer' }}
                                             />
                                        );
                                   })}
                              </Stack>
                         </Box>
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
