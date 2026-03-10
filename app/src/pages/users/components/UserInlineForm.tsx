import type { UserListItemDto } from 'src/generated/api-client';

import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { UserRoleType } from 'src/generated/api-client';

import SectionCard from 'src/components/common/SectionCard';

import { userSchema, defaultValues } from '../userFormSchema';

import type { UserFormValues } from '../userFormSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserInlineFormHandle {
     submit: () => void;
     resetForm: () => void;
}

export interface FormHeaderState {
     isDirty: boolean;
     userName: string;
     displayName: string;
}

interface UserInlineFormProps {
     user: UserListItemDto;
     onSubmit: (data: UserFormValues) => void;
     onFormStateChange: (state: FormHeaderState) => void;
}

// ---------------------------------------------------------------------------
// Map DTO to form values
// ---------------------------------------------------------------------------

function mapUserToFormValues(user: UserListItemDto): UserFormValues {
     return {
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          userRoles: (user.userRoles ?? []).map((role) => {
               if (typeof role === 'string') {
                    return UserRoleType[role as keyof typeof UserRoleType];
               }
               return role as number;
          }),
     };
}

// ---------------------------------------------------------------------------
// All available roles
// ---------------------------------------------------------------------------

const allRoles = [UserRoleType.Admin, UserRoleType.User];

// ---------------------------------------------------------------------------
// UserInlineForm
// ---------------------------------------------------------------------------

const UserInlineForm = forwardRef<UserInlineFormHandle, UserInlineFormProps>(
     function UserInlineForm({ user, onSubmit, onFormStateChange }, ref) {
          const { t } = useTranslation();
          const enumLabel = useEnumLabel();
          const onSubmitRef = useRef(onSubmit);
          onSubmitRef.current = onSubmit;

          const [dirty, setDirty] = useState(false);

          const {
               control,
               trigger,
               getValues,
               reset,
               watch,
               setValue,
               formState: { errors },
          } = useForm<UserFormValues>({
               resolver: zodResolver(userSchema),
               defaultValues,
          });

          const watchedFirstName = watch('firstName');
          const watchedLastName = watch('lastName');
          const watchedRoles = watch('userRoles');

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
                         const values = mapUserToFormValues(user);
                         reset(values);
                         setDirty(false);
                    },
               }),
               [trigger, getValues, reset, user],
          );

          // Notify parent of form state changes
          useEffect(() => {
               onFormStateChange({
                    isDirty: dirty,
                    userName: user.userName ?? '',
                    displayName: `${watchedFirstName ?? ''} ${watchedLastName ?? ''}`.trim(),
               });
          }, [dirty, watchedFirstName, watchedLastName, user.userName, onFormStateChange]);

          // Reset form when user data changes
          useEffect(() => {
               if (!user) return;
               const values = mapUserToFormValues(user);
               reset(values);
               setDirty(false);
          }, [user, reset]);

          const handleRoleToggle = (role: UserRoleType) => {
               const current = getValues('userRoles');
               const next = current.includes(role)
                    ? current.filter((r) => r !== role)
                    : [...current, role];
               setValue('userRoles', next);
               markDirty();
          };

          return (
               <Stack spacing={2} onChange={markDirty}>
                    {/* Info */}
                    <SectionCard title={t('users.editUser')}>
                         <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                   <Controller
                                        name="firstName"
                                        control={control}
                                        render={({ field }) => (
                                             <TextField
                                                  {...field}
                                                  label={t('users.firstName')}
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
                                                  label={t('users.lastName')}
                                                  size="small"
                                                  fullWidth
                                                  error={!!errors.lastName}
                                                  helperText={errors.lastName?.message as string}
                                             />
                                        )}
                                   />
                              </Grid>
                         </Grid>
                    </SectionCard>

                    {/* Roles */}
                    <SectionCard title={t('users.roles')}>
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
                    </SectionCard>
               </Stack>
          );
     },
);

export default UserInlineForm;
