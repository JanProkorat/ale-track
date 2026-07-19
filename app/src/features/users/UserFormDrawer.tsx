import { useEffect, useState } from 'react';
import {
  Box, Stack, TextField, Typography, Switch, FormControlLabel, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Radio, Card,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/ShieldOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { apiErrorMessage } from 'src/api/errors';
import { allPerms, type PermissionLevel, type Permissions } from 'src/auth/permissions';
import {
  CreateUserDto, UpdateUserDto, UserRoleType, type UserListItemDto,
} from 'src/generated/api-client';
import { useCreateUser, useUpdateUser } from 'src/hooks/useUsers';
import { PERM_MODULES, permsToDtos, dtosToPerms, isAdminUser } from './permissionModel';

const LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'none', label: 'Bez přístupu' },
  { value: 'view', label: 'Jen čtení' },
  { value: 'edit', label: 'Úpravy' },
];

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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState<Permissions>(allPerms('none'));
  const [errors, setErrors] = useState<{ userName?: string; password?: string }>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setPassword('');
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setUserName(user.userName ?? '');
      setIsAdmin(isAdminUser(user));
      setPerms(dtosToPerms(user.permissions));
    } else {
      setFirstName('');
      setLastName('');
      setUserName('');
      setIsAdmin(false);
      setPerms(allPerms('none'));
    }
  }, [open, user]);

  const submit = async () => {
    const errs: typeof errors = {};
    if (!userName.trim()) errs.userName = 'Zadejte přihlašovací jméno';
    if (!editing && password.length < 6) errs.password = 'Heslo musí mít alespoň 6 znaků';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const userRoles = [isAdmin ? UserRoleType.Admin : UserRoleType.User];
    const permissions = isAdmin ? [] : permsToDtos(perms);

    try {
      if (user?.id) {
        await update.mutateAsync({
          id: user.id,
          data: new UpdateUserDto({ firstName: firstName || undefined, lastName: lastName || undefined, userRoles, permissions }),
        });
        enqueueSnackbar('Uživatel upraven.', { variant: 'success' });
      } else {
        await create.mutateAsync(
          new CreateUserDto({ firstName: firstName || undefined, lastName: lastName || undefined, userName, password, userRoles, permissions })
        );
        enqueueSnackbar('Uživatel přidán.', { variant: 'success' });
      }
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <FormDrawer
      open={open}
      title={editing ? 'Upravit uživatele' : 'Nový uživatel'}
      subtitle={editing ? `@${user?.userName}` : 'Vytvořte účet a nastavte práva k modulům.'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={editing ? 'Uložit změny' : 'Přidat uživatele'}
      width={640}
    >
      <Stack direction="row" spacing={2}>
        <TextField label="Jméno" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth autoFocus />
        <TextField label="Příjmení" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth />
      </Stack>
      {!editing && (
        <Stack direction="row" spacing={2}>
          <TextField label="Přihlašovací jméno" value={userName} onChange={(e) => setUserName(e.target.value)} error={Boolean(errors.userName)} helperText={errors.userName} fullWidth />
          <TextField label="Heslo" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={Boolean(errors.password)} helperText={errors.password} fullWidth />
        </Stack>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Role</Typography>
        <FormControlLabel
          control={<Switch checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />}
          label="Administrátor (plný přístup)"
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Administrátor má vždy přístup ke všem modulům. Pro jemné řízení práv ponechte roli Uživatel.
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Práva k modulům</Typography>
        {isAdmin && (
          <Alert severity="info" icon={<ShieldIcon />} sx={{ mb: 1.5 }}>
            Administrátor má automaticky úpravy ve všech modulech.
          </Alert>
        )}
        <Card variant="outlined" sx={{ opacity: isAdmin ? 0.5 : 1, pointerEvents: isAdmin ? 'none' : 'auto' }}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Modul</TableCell>
                  {LEVELS.map((l) => (
                    <TableCell key={l.value} align="center" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{l.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {PERM_MODULES.map((m) => {
                  const current = isAdmin ? 'edit' : perms[m.key];
                  return (
                    <TableRow key={m.key}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ color: 'text.secondary', display: 'flex' }}>{m.icon}</Box>
                          <Typography sx={{ fontWeight: 600 }}>{m.label}</Typography>
                        </Stack>
                      </TableCell>
                      {LEVELS.map((l) => (
                        <TableCell key={l.value} align="center" sx={{ py: 0.25 }}>
                          <Radio
                            size="small"
                            checked={current === l.value}
                            onChange={() => setPerms((p) => ({ ...p, [m.key]: l.value }))}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
    </FormDrawer>
  );
}
