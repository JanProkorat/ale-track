import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField, FormControlLabel, Checkbox, FormControl, FormHelperText, FormGroup } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateUserDto,
  UpdateUserDto,
  UserRoleType,
  type UserListItemDto,
} from 'src/generated/api-client';
import { useCreateUser, useUpdateUser } from 'src/hooks/useUsers';

/** Schema depends on mode: create requires userName + password, edit has neither
 * (UpdateUserDto carries only names + roles). */
function makeSchema(editing: boolean) {
  return z.object({
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    userName: editing
      ? z.string().optional()
      : z.string().trim().min(1, 'Zadejte přihlašovací jméno'),
    password: editing ? z.string().optional() : z.string().min(6, 'Heslo musí mít alespoň 6 znaků'),
    roles: z.array(z.nativeEnum(UserRoleType)).min(1, 'Vyberte alespoň jednu roli'),
  });
}
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const empty: FormValues = { firstName: '', lastName: '', userName: '', password: '', roles: [] };

function toForm(u: UserListItemDto): FormValues {
  return {
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    userName: u.userName ?? '',
    password: '',
    roles: u.userRoles ?? [],
  };
}

/** Create/edit a user. `user` undefined → create mode. */
export function UserFormDrawer({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user?: UserListItemDto;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateUser();
  const update = useUpdateUser();
  const editing = Boolean(user);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(makeSchema(editing)), defaultValues: empty });

  useEffect(() => {
    if (open) reset(user ? toForm(user) : empty);
  }, [open, user, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      if (user?.id) {
        await update.mutateAsync({
          id: user.id,
          data: new UpdateUserDto({
            firstName: values.firstName || undefined,
            lastName: values.lastName || undefined,
            userRoles: values.roles,
          }),
        });
        enqueueSnackbar('Uživatel upraven.', { variant: 'success' });
      } else {
        await create.mutateAsync(
          new CreateUserDto({
            firstName: values.firstName || undefined,
            lastName: values.lastName || undefined,
            userName: values.userName ?? '',
            password: values.password ?? '',
            userRoles: values.roles,
          })
        );
        enqueueSnackbar('Uživatel přidán.', { variant: 'success' });
      }
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  });

  const busy = create.isPending || update.isPending;

  return (
    <FormDrawer
      open={open}
      title={editing ? 'Upravit uživatele' : 'Nový uživatel'}
      subtitle={editing ? `@${user?.userName}` : 'Vytvořte nový uživatelský účet.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Přidat uživatele'}
    >
      <Controller
        control={control}
        name="firstName"
        render={({ field }) => (
          <TextField
            {...field}
            label="Jméno"
            error={Boolean(errors.firstName)}
            helperText={errors.firstName?.message}
            fullWidth
            autoFocus
          />
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field }) => (
          <TextField
            {...field}
            label="Příjmení"
            error={Boolean(errors.lastName)}
            helperText={errors.lastName?.message}
            fullWidth
          />
        )}
      />
      {!editing && (
        <Controller
          control={control}
          name="userName"
          render={({ field }) => (
            <TextField
              {...field}
              label="Přihlašovací jméno"
              error={Boolean(errors.userName)}
              helperText={errors.userName?.message}
              fullWidth
            />
          )}
        />
      )}
      {!editing && (
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              {...field}
              type="password"
              label="Heslo"
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              fullWidth
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="roles"
        render={({ field }) => (
          <FormControl error={Boolean(errors.roles)} component="fieldset" variant="standard">
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value.includes(UserRoleType.Admin)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...field.value, UserRoleType.Admin]
                        : field.value.filter((r) => r !== UserRoleType.Admin);
                      field.onChange(next);
                    }}
                  />
                }
                label="Administrátor"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value.includes(UserRoleType.User)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...field.value, UserRoleType.User]
                        : field.value.filter((r) => r !== UserRoleType.User);
                      field.onChange(next);
                    }}
                  />
                }
                label="Uživatel"
              />
            </FormGroup>
            {errors.roles?.message && <FormHelperText>{errors.roles.message}</FormHelperText>}
          </FormControl>
        )}
      />
    </FormDrawer>
  );
}
