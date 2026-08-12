import { useEffect, useState } from 'react';
import {
  Box, Stack, TextField, Typography, FormControlLabel, Alert, RadioGroup,
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
import {
  PERM_MODULES, permsToDtos, dtosToPerms, roleOf, ASSIGNABLE_ROLES, ROLE_LABELS,
} from './permissionModel';

// Each access level has its own semantic colour (matching the prototype):
// no access = neutral, read-only = blue, edit = green.
const LEVELS: { value: PermissionLevel; label: string; color: 'default' | 'info' | 'success' }[] = [
  { value: 'none', label: 'Bez přístupu', color: 'default' },
  { value: 'view', label: 'Jen čtení', color: 'info' },
  { value: 'edit', label: 'Úpravy', color: 'success' },
];

// What picking each role means for the person filling the form. The driver line names
// the restrictions, since they are not visible anywhere else in this screen.
const ROLE_HINTS: Record<UserRoleType, string> = {
  [UserRoleType.Admin]: 'Má vždy přístup ke všem modulům, práva se nenastavují.',
  [UserRoleType.Manager]: 'Práva k jednotlivým modulům nastavíte níže.',
  [UserRoleType.Driver]: 'Jako uživatel, ale bez fakturace, cen a rozpisu nakládky — u vývozu vidí jen vykládku.',
};

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
  const [role, setRole] = useState<UserRoleType>(UserRoleType.Manager);
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
      setRole(roleOf(user));
      setPerms(dtosToPerms(user.permissions));
    } else {
      setFirstName('');
      setLastName('');
      setUserName('');
      setRole(UserRoleType.Manager);
      setPerms(allPerms('none'));
    }
  }, [open, user]);

  const submit = async () => {
    const errs: typeof errors = {};
    if (!userName.trim()) errs.userName = 'Zadejte přihlašovací jméno';
    if (!editing && password.length < 6) errs.password = 'Heslo musí mít alespoň 6 znaků';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // A driver still needs the matrix — the role only subtracts content from the
    // modules they were granted.
    const userRoles = [role];
    const permissions = role === UserRoleType.Admin ? [] : permsToDtos(perms);

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
        <RadioGroup
          row
          value={role}
          onChange={(e) => setRole(Number(e.target.value) as UserRoleType)}
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <FormControlLabel key={r} value={r} control={<Radio size="small" />} label={ROLE_LABELS[r]} />
          ))}
        </RadioGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {ROLE_HINTS[role]}
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Práva k modulům</Typography>
        {role === UserRoleType.Admin && (
          <Alert severity="info" icon={<ShieldIcon />} sx={{ mb: 1.5 }}>
            Administrátor má automaticky úpravy ve všech modulech.
          </Alert>
        )}
        {role === UserRoleType.Driver && (
          <Alert severity="info" icon={<ShieldIcon />} sx={{ mb: 1.5 }}>
            Řidič potřebuje čtení u modulu Vývozy. I s právem úprav mu zůstane skrytá fakturace a ceny.
          </Alert>
        )}
        <Card
          variant="outlined"
          sx={{
            opacity: role === UserRoleType.Admin ? 0.5 : 1,
            pointerEvents: role === UserRoleType.Admin ? 'none' : 'auto',
          }}
        >
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
                  const current = role === UserRoleType.Admin ? 'edit' : perms[m.key];
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
                            color={l.color}
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
