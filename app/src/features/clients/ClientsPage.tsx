import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Card, Chip, Stack, Typography } from '@mui/material';
import { useQueries } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/AddOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import LocationOnIcon from '@mui/icons-material/LocationOnOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import MailIcon from '@mui/icons-material/MailOutlineOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SearchField } from 'src/components/common/SearchField';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { apiErrorMessage } from 'src/api/errors';
import { initials, plural } from 'src/lib/format';
import { L, regionName, regionLabel, isEmailContact } from 'src/lib/labels';
import { type AddressDto, type ClientDto, type ClientListItemDto } from 'src/generated/api-client';
import { useClients, useClient, useDeleteClient } from 'src/hooks/useClients';
import { PATHS } from 'src/routes/paths';
import { ClientDetail } from './ClientDetail';
import { ClientFormDrawer } from './ClientFormDrawer';

// Hash-based avatar tint per client id (matches the prototype's `colorFor`) —
// clients have no stored color like breweries, so a deterministic hash keeps
// the same client visually stable across renders.
const AVATAR_COLORS = ['#F08C00', '#0E7C9B', '#7C3AED', '#15873F', '#C22A2A', '#B4620A', '#0891B2', '#DB2777'];
function colorFor(str: string): string {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function clientInitials(name: string): string {
  const [a, b] = name.trim().split(/\s+/);
  return initials(a, b);
}
function formatZip(zip?: string): string {
  const z = (zip ?? '').replace(/\s/g, '');
  return /^\d{5}$/.test(z) ? `${z.slice(0, 3)} ${z.slice(3)}` : (zip ?? '');
}
function addrOneLine(a?: AddressDto): string {
  if (!a) return '—';
  return `${a.streetName} ${a.streetNumber}, ${formatZip(a.zip)} ${a.city}`;
}

export function ClientsPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('clients');
  const { enqueueSnackbar } = useSnackbar();
  const ds = useDataSource();
  const navigate = useNavigate();
  const { id: selectedId } = useParams();

  const list = useClients();
  const clients = useMemo(() => list.data ?? [], [list.data]);

  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The list endpoint only returns {id, name, region}; business name, address
  // and contacts for the "Sídlo"/"Kontakty" columns come from the per-client
  // detail (shares its cache with the detail view, like the brewery product
  // counts on BreweriesPage).
  const detailQueries = useQueries({
    queries: clients.map((c) => ({
      queryKey: qk.clients.detail(c.id ?? ''),
      queryFn: ({ signal }: { signal: AbortSignal }) => ds.getClientDetailEndpoint(c.id!, signal),
      enabled: Boolean(c.id),
    })),
  });
  const detailFor = (id?: string): ClientDto | undefined => {
    const i = clients.findIndex((c) => c.id === id);
    return i >= 0 ? detailQueries[i]?.data : undefined;
  };

  const detail = useClient(selectedId ?? undefined);
  const del = useDeleteClient();

  const regionOptions: ComboOption[] = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach((c) => {
      const key = regionName(c.region);
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.keys(L.region)
      .filter((r) => counts[r])
      .map((r) => ({ value: r, label: `${L.region[r]} (${counts[r]})` }));
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (region && regionName(c.region) !== region) return false;
      if (!q) return true;
      const bn = detailFor(c.id)?.businessName ?? '';
      return (c.name ?? '').toLowerCase().includes(q) || bn.toLowerCase().includes(q);
    });
    // `detailQueries` is a dependency (not just `clients`) so business-name
    // search re-filters once the per-row detail calls resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, search, region, detailQueries]);

  const grouped = useMemo(() => {
    const byRegion: Record<string, ClientListItemDto[]> = {};
    filtered.forEach((c) => {
      const key = regionName(c.region) ?? 'Other';
      (byRegion[key] ??= []).push(c);
    });
    return Object.keys(L.region).filter((r) => byRegion[r]?.length).map((r) => ({ region: r, rows: byRegion[r] }));
  }, [filtered]);

  const openCreate = () => setFormOpen(true);
  const openEdit = () => setEditingOpen(true);

  const doDelete = async () => {
    if (!selectedId) return;
    try {
      await del.mutateAsync(selectedId);
      enqueueSnackbar('Klient smazán.', { variant: 'success' });
      setConfirmDelete(false);
      navigate(PATHS.clients);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const columns: Column<ClientListItemDto>[] = [
    {
      key: 'client',
      header: 'Klient',
      render: (c) => {
        const d = detailFor(c.id);
        const color = colorFor(c.id ?? c.name ?? '');
        return (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0,
                fontWeight: 800, fontSize: 13, bgcolor: `${color}22`, color,
              }}
            >
              {clientInitials(c.name ?? '?')}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>{c.name}</Typography>
              {d?.businessName && (
                <Typography variant="body2" color="text.secondary" noWrap>{d.businessName}</Typography>
              )}
            </Box>
          </Stack>
        );
      },
    },
    {
      key: 'address',
      header: 'Sídlo',
      render: (c) => <Typography color="text.secondary">{addrOneLine(detailFor(c.id)?.officialAddress)}</Typography>,
    },
    {
      key: 'contacts',
      header: 'Kontakty',
      render: (c) => {
        const contacts = detailFor(c.id)?.contacts ?? [];
        if (contacts.length === 0) return <Typography color="text.secondary">—</Typography>;
        return (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {contacts.map((ct, i) => (
              <Chip
                key={i}
                size="small"
                variant="outlined"
                icon={isEmailContact(ct.type) ? <MailIcon /> : <PhoneIcon />}
                label={ct.value}
                title={ct.value}
              />
            ))}
          </Stack>
        );
      },
    },
    {
      key: 'chevron',
      header: '',
      align: 'right',
      width: 40,
      render: () => <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />,
    },
  ];

  const newClientButton = editable && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Nový klient
    </Button>
  );

  return (
    <PageContainer>
      {selectedId ? (
        <QueryBoundary query={detail}>
          {(client) => (
            <ClientDetail
              client={client}
              editable={editable}
              onBack={() => navigate(PATHS.clients)}
              onEdit={openEdit}
              onDelete={() => setConfirmDelete(true)}
            />
          )}
        </QueryBoundary>
      ) : (
        <>
          <PageHeader
            eyebrow="Evidence"
            title="Klienti"
            subtitle="Odběratelé sdružení do regionů — adresy, kontakty a objednávky."
            actions={newClientButton}
          />

          <QueryBoundary
            query={list}
            isEmpty={(rows) => rows.length === 0}
            emptyState={
              <EmptyState
                icon={<PeopleAltOutlinedIcon />}
                title="Zatím žádní klienti"
                description="Přidejte prvního klienta a jeho adresu."
                action={newClientButton}
              />
            }
          >
            {() => (
              <>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
                  <Box sx={{ minWidth: 220 }}>
                    <SearchField value={search} onChange={setSearch} placeholder="Hledat klienta…" width="100%" />
                  </Box>
                  <Box sx={{ width: 220 }}>
                    <Combobox
                      value={region}
                      onChange={setRegion}
                      options={regionOptions}
                      placeholder="Všechny regiony"
                      clearable
                      fullWidth
                      size="small"
                    />
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
                    {filtered.length} {plural(filtered.length, 'klient', 'klienti', 'klientů')}
                  </Typography>
                </Stack>

                {grouped.length === 0 ? (
                  <EmptyState
                    icon={<PeopleAltOutlinedIcon />}
                    title="Žádní klienti"
                    action={
                      (search || region) && (
                        <Button size="small" onClick={() => { setSearch(''); setRegion(null); }}>
                          Zrušit filtry
                        </Button>
                      )
                    }
                  />
                ) : (
                  <Stack spacing={3}>
                    {grouped.map(({ region: r, rows }) => (
                      <Box key={r}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <LocationOnIcon sx={{ fontSize: 16, color: 'primary.dark' }} />
                          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{regionLabel(r) ?? L.region[r]}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {rows.length} {plural(rows.length, 'klient', 'klienti', 'klientů')}
                          </Typography>
                        </Stack>
                        <Card sx={{ p: { xs: 1, sm: 1.5 } }}>
                          <DataTable
                            columns={columns}
                            rows={rows}
                            getRowKey={(c) => c.id ?? ''}
                            onRowClick={(c) => navigate(`${PATHS.clients}/${c.id}`)}
                          />
                        </Card>
                      </Box>
                    ))}
                  </Stack>
                )}
              </>
            )}
          </QueryBoundary>
        </>
      )}

      <ClientFormDrawer open={formOpen} onClose={() => setFormOpen(false)} />
      <ClientFormDrawer open={editingOpen} client={detail.data} onClose={() => setEditingOpen(false)} />

      <ConfirmDialog
        open={confirmDelete}
        title="Smazat klienta?"
        message={<>Opravdu smazat <strong>{detail.data?.name}</strong>? Klient bude odstraněn, jeho objednávky zůstanou v historii.</>}
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}
