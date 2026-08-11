import { useState } from 'react';
import { Button, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SearchField } from 'src/components/common/SearchField';
import { StatusPill } from 'src/components/common/StatusPill';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { UserRoleType, type UserListItemDto } from 'src/generated/api-client';
import { useUsers, useDeleteUser } from 'src/hooks/useUsers';
import { UserFormDrawer } from './UserFormDrawer';
import { isAdminUser, permCounts, roleOf, ROLE_LABELS } from './permissionModel';

// One chip per user, from the single role the form assigns. Rendered from roleOf rather
// than by mapping userRoles, so an account carrying several does not sprout a chip each.
const ROLE_CHIP_COLOR: Record<UserRoleType, 'primary' | 'info' | 'default'> = {
  [UserRoleType.Admin]: 'primary',
  [UserRoleType.Driver]: 'info',
  [UserRoleType.User]: 'default',
};

function RoleChip({ user }: { user: Pick<UserListItemDto, 'userRoles'> }) {
  const role = roleOf(user);
  return <Chip label={ROLE_LABELS[role]} size="small" color={ROLE_CHIP_COLOR[role]} />;
}

function PermSummary({ user }: { user: UserListItemDto }) {
  if (isAdminUser(user)) return <StatusPill tone="amber" label="Plný přístup" />;
  const { edit, view } = permCounts(user);
  if (edit === 0 && view === 0) return <Typography variant="body2" color="text.disabled">Bez práv</Typography>;
  return (
    <Stack direction="row" spacing={0.75}>
      {edit > 0 && <Chip size="small" label={`${edit} úprav`} sx={{ color: 'success.main', fontWeight: 700 }} />}
      {view > 0 && <Chip size="small" label={`${view} čtení`} sx={{ color: 'info.main', fontWeight: 700 }} />}
    </Stack>
  );
}

const fullName = (u: UserListItemDto) => [u.firstName, u.lastName].filter(Boolean).join(' ');

/** Phone layout for one user. Actions live in the card rather than a hidden
 * column, and the row is not clickable, so these buttons are the only ones. */
function UserCard({
  user,
  editable,
  onEdit,
  onDelete,
}: {
  user: UserListItemDto;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>{fullName(user) || user.userName}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>@{user.userName}</Typography>
        </Stack>
        {editable && (
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Tooltip title="Upravit">
              <IconButton size="small" onClick={onEdit}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Smazat">
              <IconButton size="small" color="error" onClick={onDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        <RoleChip user={user} />
        <PermSummary user={user} />
      </Stack>
    </Stack>
  );
}

export function UsersPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('users');
  const { enqueueSnackbar } = useSnackbar();

  const query = useUsers();
  const del = useDeleteUser();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItemDto | undefined>(undefined);
  const [confirm, setConfirm] = useState<UserListItemDto | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (u: UserListItemDto) => {
    setEditing(u);
    setFormOpen(true);
  };

  const doDelete = async () => {
    if (!confirm?.id) return;
    try {
      await del.mutateAsync(confirm.id);
      enqueueSnackbar('Uživatel smazán.', { variant: 'success' });
      setConfirm(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const columns: Column<UserListItemDto>[] = [
    {
      key: 'name',
      header: 'Jméno',
      // Mirrors the fallback in render, so a user with no full name sorts under the same
      // text the row actually shows.
      sortValue: (u) => fullName(u) || u.userName,
      render: (u) => (
        <Typography sx={{ fontWeight: 600 }}>{fullName(u) || u.userName}</Typography>
      ),
    },
    {
      key: 'userName',
      header: 'Přihlašovací jméno',
      sortValue: (u) => u.userName,
      render: (u) => (
        <Typography variant="body2" color="text.secondary">
          @{u.userName}
        </Typography>
      ),
    },
    {
      key: 'roles',
      header: 'Role',
      // Sorted by the label on screen, which under Czech collation still puts
      // Administrátor first, then Řidič, then Uživatel.
      sortValue: (u) => ROLE_LABELS[roleOf(u)],
      render: (u) => (
        <Stack direction="row" spacing={0.5}>
          <RoleChip user={u} />
        </Stack>
      ),
    },
    {
      key: 'perms',
      header: 'Práva k modulům',
      hideOnMobile: true,
      render: (u) => <PermSummary user={u} />,
    },
    ...(editable
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 96,
            render: (u: UserListItemDto) => (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Upravit">
                  <IconButton size="small" onClick={() => openEdit(u)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Smazat">
                  <IconButton size="small" color="error" onClick={() => setConfirm(u)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ),
          },
        ]
      : []),
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Správa"
        title="Uživatelé"
        subtitle="Správa uživatelů a jejich práv k jednotlivým modulům."
        actions={
          <>
            {/* Full width on a phone so it claims its own row: at its default 260px
                the search and the button shrink side by side instead of wrapping. */}
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Hledat uživatele…"
              width={{ xs: '100%', compact: 260 }}
            />
            {editable && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                Přidat uživatele
              </Button>
            )}
          </>
        }
      />

      <Card sx={{ p: { xs: 1, sm: 1.5 } }}>
        <QueryBoundary
          query={query}
          isEmpty={(rows) => rows.length === 0}
          emptyState={
            <EmptyState
              icon={<PersonOutlineIcon />}
              title="Zatím žádní uživatelé"
              description="Přidejte první uživatelský účet."
              action={
                editable && (
                  <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    Přidat uživatele
                  </Button>
                )
              }
            />
          }
        >
          {(rows) => {
            const q = search.trim().toLowerCase();
            const filtered = q
              ? rows.filter((u) =>
                  [u.firstName, u.lastName, u.userName]
                    .filter(Boolean)
                    .some((v) => (v ?? '').toLowerCase().includes(q))
                )
              : rows;
            if (filtered.length === 0) {
              return (
                <EmptyState title="Nic nenalezeno" description={`Pro „${search}" nemáme žádného uživatele.`} dense />
              );
            }
            return (
              <DataTable
                columns={columns}
                rows={filtered}
                getRowKey={(u) => u.id ?? u.userName ?? ''}
                paginated
                pageSizeKey="users"
                defaultSort={{ key: 'name', direction: 'asc' }}
                pageResetKey={search}
                mobileCard={(u) => (
                  <UserCard
                    user={u}
                    editable={editable}
                    onEdit={() => openEdit(u)}
                    onDelete={() => setConfirm(u)}
                  />
                )}
              />
            );
          }}
        </QueryBoundary>
      </Card>

      <UserFormDrawer open={formOpen} user={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Smazat uživatele?"
        message={
          <>
            Opravdu chcete smazat uživatele{' '}
            <strong>{(confirm ? fullName(confirm) : '') || confirm?.userName}</strong>? Tuto akci
            nelze vzít zpět.
          </>
        }
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirm(null)}
      />
    </PageContainer>
  );
}
