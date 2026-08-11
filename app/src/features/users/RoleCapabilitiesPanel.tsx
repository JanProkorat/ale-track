// Role x capability visibility matrix. Split outer/inner so hooks never run
// on data that may still be missing: the outer component owns the query
// states via QueryBoundary, the inner one takes the loaded rows as a plain
// prop and is where all the local edit state (useState/useMemo) lives.
import { Fragment, useMemo, useState } from 'react';
import {
  Box,
  Button,
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

export function RoleCapabilitiesPanel() {
  const query = useRoleCapabilities();

  return (
    <QueryBoundary query={query}>
      {(rows) => <RoleCapabilitiesEditor rows={rows} />}
    </QueryBoundary>
  );
}

function RoleCapabilitiesEditor({ rows }: { rows: RoleCapabilityDto[] }) {
  const { enqueueSnackbar } = useSnackbar();
  const save = useSetRoleCapabilities();

  // Default-allow: anything without a stored row is visible.
  const initial = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const role of EDITABLE_ROLES) {
      for (const capability of CAPABILITY_REGISTRY) {
        map.set(cellKey(role, capability.key), true);
      }
    }
    for (const row of rows) {
      if (row.capabilityKey && row.role !== undefined) {
        map.set(cellKey(row.role, row.capabilityKey), row.isVisible ?? true);
      }
    }
    return map;
  }, [rows]);

  const [visible, setVisible] = useState(initial);

  const toggle = (role: UserRoleType, capabilityKey: string) => {
    setVisible((previous) => {
      const next = new Map(previous);
      const key = cellKey(role, capabilityKey);
      next.set(key, !next.get(key));
      return next;
    });
  };

  // The whole set every time, so a capability that had no row yet is written explicitly
  // — and no duplicate/Admin rows can ever be sent, since the source is the full matrix.
  const submit = () => {
    const items = EDITABLE_ROLES.flatMap((role) =>
      CAPABILITY_REGISTRY.map((capability) => new RoleCapabilityDto({
        role,
        capabilityKey: capability.key,
        isVisible: visible.get(cellKey(role, capability.key)) ?? true,
      })),
    );

    save.mutate(items, {
      onSuccess: () => enqueueSnackbar(
        'Uloženo. Změny se u přihlášených uživatelů projeví po dalším přihlášení.',
        { variant: 'success' },
      ),
      onError: (error) => enqueueSnackbar(apiErrorMessage(error), { variant: 'error' }),
    });
  };

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary" sx={{ fontSize: 13 }}>
        Nastavení platí pro celou roli, ne pro jednotlivé uživatele. Zamčené položky se navíc
        vynucují na serveru.
      </Typography>

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
              {groups().map((group) => (
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
                            checked={role === UserRoleType.Admin
                              || (visible.get(cellKey(role, capability.key)) ?? true)}
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

      <Box>
        <Button variant="contained" onClick={submit} disabled={save.isPending}>Uložit</Button>
      </Box>
    </Stack>
  );
}
