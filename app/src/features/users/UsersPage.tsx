import { useState } from 'react';
import { Alert, Button, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import ShieldIcon from '@mui/icons-material/ShieldOutlined';
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
import { isAdminUser, permCounts } from './permissionModel';

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
      render: (u) => (
        <Typography sx={{ fontWeight: 600 }}>{fullName(u) || u.userName}</Typography>
      ),
    },
    {
      key: 'userName',
      header: 'Přihlašovací jméno',
      render: (u) => (
        <Typography variant="body2" color="text.secondary">
          @{u.userName}
        </Typography>
      ),
    },
    {
      key: 'roles',
      header: 'Role',
      render: (u) => (
        <Stack direction="row" spacing={0.5}>
          {(u.userRoles ?? []).map((r) =>
            r === UserRoleType.Admin ? (
              <Chip key="admin" label="Administrátor" size="small" color="primary" />
            ) : (
              <Chip key="user" label="Uživatel" size="small" />
            )
          )}
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
            <SearchField value={search} onChange={setSearch} placeholder="Hledat uživatele…" />
            {editable && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                Přidat uživatele
              </Button>
            )}
          </>
        }
      />

      <Alert
        severity="warning"
        icon={<ShieldIcon />}
        sx={{ mb: 2, bgcolor: (t) => t.vars!.palette.brand.amberSoft, color: 'text.secondary', border: 1, borderColor: (t) => t.vars!.palette.brand.amberTint }}
      >
        <strong>Granulární oprávnění.</strong> U každého uživatele lze nastavit přístup ke každému
        modulu zvlášť — bez přístupu / jen čtení / úpravy.
      </Alert>

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
