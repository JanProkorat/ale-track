// Role x capability visibility matrix, in the same right-side drawer the user form uses.
// State is seeded in an effect rather than by an inner component taking loaded rows as a prop
// (the shape this had as a full page): FormDrawer owns the submit button, so the edit state has
// to live above it. Seeding on every fresh `data` also means a save's own refetch re-syncs the
// checkboxes instead of leaving them showing pre-save values.
import { Fragment, useMemo, useState } from 'react';
import {
  Card,
  Checkbox,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { apiErrorMessage } from 'src/api/errors';
import { RoleCapabilityDto, UserRoleType } from 'src/generated/api-client';
import { CAPABILITY_REGISTRY, type CapabilityMeta } from 'src/auth/capabilityRegistry';
import { NAV_GROUPS } from 'src/layout/nav-config';
import { useRoleCapabilities, useSetRoleCapabilities } from 'src/hooks/useRoleCapabilities';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from './permissionModel';

/** Editable roles: Admin bypasses capabilities entirely, so its column is fixed. */
const EDITABLE_ROLES = ASSIGNABLE_ROLES.filter((role) => role !== UserRoleType.Admin);

/** Capability groups in nav order, with cross-application ones grouped last. */
function groups(): { heading: string; items: CapabilityMeta[] }[] {
  const byModule = NAV_GROUPS.flatMap((group) => group.items)
    .map((item) => ({
      heading: item.label,
      items: CAPABILITY_REGISTRY.filter((capability) => capability.module === item.key) as CapabilityMeta[],
    }))
    .filter((group) => group.items.length > 0);

  const crossApp = CAPABILITY_REGISTRY.filter((capability) => capability.module === null) as CapabilityMeta[];

  return crossApp.length > 0
    ? [...byModule, { heading: 'Napříč aplikací', items: crossApp }]
    : byModule;
}

/** Key for the local edit map. */
const cellKey = (role: UserRoleType, capabilityKey: string) => `${role}:${capabilityKey}`;

// Enums are numeric in the generated client but arrive as strings on the wire (Program.cs
// registers JsonStringEnumConverter) — resolve both, the same way permissionModel.ts does for
// ModuleType. Skipping this is silent: the row keys simply never match the cell keys, every cell
// falls back to default-allow, and a saved denial looks like it was never saved.
function roleFromApi(role: UserRoleType | string | number | undefined): UserRoleType | undefined {
  if (role == null) return undefined;
  if (typeof role === 'number') return role;
  const parsed = UserRoleType[role as keyof typeof UserRoleType];
  return typeof parsed === 'number' ? parsed : undefined;
}

/** The registry key matching `stored`, ignoring case — the backend compares keys
 *  case-insensitively, so a row saved with different casing must still be read here. */
function registryKeyOf(storedKey: string): string | undefined {
  return CAPABILITY_REGISTRY.find(
    (capability) => capability.key.toLowerCase() === storedKey.toLowerCase(),
  )?.key;
}

/** Visibility as stored, keyed per cell. Absent means default-allow, i.e. visible. */
function storedVisibility(rows: RoleCapabilityDto[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const row of rows) {
    const role = roleFromApi(row.role);
    const key = row.capabilityKey ? registryKeyOf(row.capabilityKey) : undefined;
    if (role !== undefined && key) {
      map.set(cellKey(role, key), row.isVisible ?? true);
    }
  }
  return map;
}

export function RoleCapabilitiesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const query = useRoleCapabilities();
  const save = useSetRoleCapabilities();

  // Edits are held as overrides layered over the server's values at render time, rather than
  // copied into state once. That avoids seeding from an effect — an effect keyed on `query.data`
  // re-runs whenever the query hands back a new array reference, which loops. It also means a
  // background refetch cannot clobber edits in progress: untouched cells follow the server,
  // touched ones stay as the admin left them.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  const stored = useMemo(() => storedVisibility(query.data ?? []), [query.data]);
  const capabilityGroups = useMemo(groups, []);

  const isVisible = (role: UserRoleType, capabilityKey: string) => {
    const key = cellKey(role, capabilityKey);
    return overrides.get(key) ?? stored.get(key) ?? true;
  };

  const toggle = (role: UserRoleType, capabilityKey: string) => {
    setOverrides((previous) => {
      const next = new Map(previous);
      next.set(cellKey(role, capabilityKey), !isVisible(role, capabilityKey));
      return next;
    });
  };

  // Reopening should show what the server has, not last time's abandoned edits.
  const close = () => {
    setOverrides(new Map());
    onClose();
  };

  // The whole matrix every time, so a capability that had no row yet is written explicitly
  // — and no duplicate/Admin rows can ever be sent, since the source is the full matrix.
  const submit = () => {
    const items = EDITABLE_ROLES.flatMap((role) =>
      CAPABILITY_REGISTRY.map((capability) => new RoleCapabilityDto({
        role,
        capabilityKey: capability.key,
        isVisible: isVisible(role, capability.key),
      })),
    );

    save.mutate(items, {
      onSuccess: () => {
        enqueueSnackbar(
          'Uloženo. Změny se u přihlášených uživatelů projeví po dalším přihlášení.',
          { variant: 'success' },
        );
        close();
      },
      onError: (error) => enqueueSnackbar(apiErrorMessage(error), { variant: 'error' }),
    });
  };

  return (
    <FormDrawer
      open={open}
      title="Role a komponenty"
      subtitle="Nastavení platí pro celou roli, ne pro jednotlivé uživatele. Zamčené položky se navíc vynucují na serveru."
      onClose={close}
      onSubmit={submit}
      busy={save.isPending}
      width={640}
    >
      <QueryBoundary query={query}>
        {() => (
          <Card variant="outlined">
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
                    <TableCell sx={{ fontWeight: 700 }}>Modul / komponenta</TableCell>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <TableCell key={role} align="center" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {ROLE_LABELS[role]}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {capabilityGroups.map((group) => (
                    <Fragment key={group.heading}>
                      <TableRow>
                        <TableCell colSpan={ASSIGNABLE_ROLES.length + 1} sx={{ fontWeight: 700 }}>
                          {group.heading}
                        </TableCell>
                      </TableRow>
                      {group.items.map((capability) => (
                        <TableRow key={capability.key} hover>
                          <TableCell>
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pl: 2 }}>
                              {capability.guardsData ? (
                                <Tooltip title="Vynucuje se i na serveru — skrytí je skutečná hranice, ne jen úprava vzhledu.">
                                  <LockOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                </Tooltip>
                              ) : (
                                <Tooltip title="Jen zjednodušuje rozhraní — server tuto položku nijak nekontroluje.">
                                  <LockOpenOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                                </Tooltip>
                              )}
                              <Typography sx={{ fontWeight: 600 }}>{capability.label}</Typography>
                            </Stack>
                          </TableCell>
                          {ASSIGNABLE_ROLES.map((role) => (
                            <TableCell key={role} align="center" sx={{ py: 0.25 }}>
                              <Checkbox
                                size="small"
                                inputProps={{ 'aria-label': `${capability.label} – ${ROLE_LABELS[role]}` }}
                                disabled={role === UserRoleType.Admin}
                                checked={role === UserRoleType.Admin || isVisible(role, capability.key)}
                                onChange={() => toggle(role, capability.key)}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}
      </QueryBoundary>
    </FormDrawer>
  );
}
