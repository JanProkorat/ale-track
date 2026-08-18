import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, Card, Chip, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import FactoryIcon from '@mui/icons-material/FactoryOutlined';
import MailIcon from '@mui/icons-material/MailOutlineOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SearchField } from 'src/components/common/SearchField';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { type SortState } from 'src/components/common/dataTableModel';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { StatusPill } from 'src/components/common/StatusPill';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { initials, plural } from 'src/lib/format';
import { isEmailContact } from 'src/lib/labels';
import { type SupplierGoodDto, type SupplierListItemDto } from 'src/generated/api-client';
import { useDeleteSupplier, useDeleteSupplierGood, useSupplier, useSuppliers } from 'src/hooks/useSuppliers';
import { PATHS } from 'src/routes/paths';
import { SupplierDetail } from './SupplierDetail';
import { SupplierFormDrawer } from './SupplierFormDrawer';
import { SupplierGoodDrawer } from './SupplierGoodDrawer';
import { OpeningHoursDrawer } from './OpeningHoursDrawer';
import { supplierDetailTab, type SupplierTab } from './supplierDetailTab';
import { matchesSupplierSearch } from './supplierGoods';
import { addressOneLine } from './supplierFormat';
import { hoursOfDay, hoursText, openBadgeText, openState, weekdayIdx } from './supplierHours';

// Hash-based avatar tint per supplier id, matching the prototype's `colorFor` — suppliers
// carry no stored colour, so a deterministic hash keeps each one visually stable.
const AVATAR_COLORS = ['#F08C00', '#0E7C9B', '#7C3AED', '#15873F', '#C22A2A', '#B4620A', '#0891B2', '#DB2777'];
function colorFor(str: string): string {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function supplierInitials(name: string): string {
  const [a, b] = name.trim().split(/\s+/);
  return initials(a, b);
}

export function SuppliersPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('suppliers');
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { id: selectedId } = useParams();

  // The open sub-tab lives in the URL, so a bookmarked tab survives a refresh. Replace
  // rather than push: switching tabs should not add a step between detail and list.
  const [searchParams, setSearchParams] = useSearchParams();
  const detailTab = supplierDetailTab(searchParams.get('tab'));
  const selectTab = (next: SupplierTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'info') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const list = useSuppliers();
  const detail = useSupplier(selectedId ?? undefined);
  const del = useDeleteSupplier();
  const delGood = useDeleteSupplierGood();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [goodOpen, setGoodOpen] = useState(false);
  const [editingGood, setEditingGood] = useState<SupplierGoodDto | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteGood, setConfirmDeleteGood] = useState<SupplierGoodDto | undefined>();
  const [sort, setSort] = useState<SortState | undefined>({ key: 'supplier', direction: 'asc' });

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const filtered = useMemo(
    () => rows.filter((s) => matchesSupplierSearch({ ...s, goodNames: s.goodNames }, search)),
    [rows, search],
  );

  const doDelete = async () => {
    if (!selectedId) return;
    try {
      await del.mutateAsync(selectedId);
      enqueueSnackbar('Dodavatel smazán.', { variant: 'success' });
      setConfirmDelete(false);
      navigate(PATHS.suppliers);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const doDeleteGood = async () => {
    if (!selectedId || !confirmDeleteGood?.id) return;
    try {
      await delGood.mutateAsync({ supplierId: selectedId, goodId: confirmDeleteGood.id });
      enqueueSnackbar('Zboží smazáno.', { variant: 'success' });
      setConfirmDeleteGood(undefined);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const columns: Column<SupplierListItemDto>[] = [
    {
      key: 'supplier',
      header: 'Dodavatel',
      sortValue: (s) => s.name,
      render: (s) => {
        const color = colorFor(s.id ?? s.name ?? '');
        return (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center',
                flexShrink: 0, fontWeight: 800, fontSize: 13, bgcolor: `${color}22`, color,
              }}
            >
              {supplierInitials(s.name ?? '?')}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>{s.name}</Typography>
              {s.businessName && (
                <Typography variant="body2" color="text.secondary" noWrap>{s.businessName}</Typography>
              )}
            </Box>
          </Stack>
        );
      },
    },
    {
      key: 'address',
      header: 'Sídlo',
      sortValue: (s) => addressOneLine(s.officialAddress),
      render: (s) => <Typography color="text.secondary">{addressOneLine(s.officialAddress)}</Typography>,
    },
    {
      key: 'goods',
      header: 'Zboží',
      align: 'right',
      sortValue: (s) => s.goodsCount ?? 0,
      render: (s) => <Typography>{s.goodsCount ?? 0}</Typography>,
    },
    {
      key: 'today',
      header: 'Dnes',
      // Computed from the viewer's clock, so it is deliberately not sortable — the order
      // would change under the reader as the day moves on.
      render: (s) => {
        const now = new Date();
        const state = openState(s.openingHours, now);
        return (
          <Stack direction="row" spacing={1} alignItems="center">
            <StatusPill tone={state.open ? 'ok' : 'grey'} label={openBadgeText(state)} />
            {!state.nonstop && (
              <Typography variant="body2" color="text.secondary">
                {hoursText(hoursOfDay(s.openingHours, weekdayIdx(now)))}
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      key: 'contacts',
      header: 'Kontakty',
      render: (s) => {
        const contacts = s.contacts ?? [];
        if (contacts.length === 0) return <Typography color="text.secondary">—</Typography>;
        return (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {contacts.map((c, i) => (
              <Chip
                key={i}
                size="small"
                variant="outlined"
                icon={isEmailContact(c.type) ? <MailIcon /> : <PhoneIcon />}
                label={c.value}
                title={c.value}
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

  const newSupplierButton = editable && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
      Nový dodavatel
    </Button>
  );

  // Phone layout: identity first, then where it is and whether it is open now.
  const supplierCard = (s: SupplierListItemDto) => {
    const color = colorFor(s.id ?? s.name ?? '');
    const now = new Date();
    const state = openState(s.openingHours, now);
    return (
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center',
              flexShrink: 0, fontWeight: 800, fontSize: 13, bgcolor: `${color}22`, color,
            }}
          >
            {supplierInitials(s.name ?? '?')}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{s.name}</Typography>
            {s.businessName && (
              <Typography variant="body2" color="text.secondary" noWrap>{s.businessName}</Typography>
            )}
          </Box>
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
        </Stack>
        <Typography sx={{ fontSize: 12.5 }} color="text.secondary">
          {addressOneLine(s.officialAddress)}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusPill tone={state.open ? 'ok' : 'grey'} label={openBadgeText(state)} />
          {!state.nonstop && (
            <Typography variant="body2" color="text.secondary">
              {hoursText(hoursOfDay(s.openingHours, weekdayIdx(now)))}
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {s.goodsCount ?? 0} {plural(s.goodsCount ?? 0, 'druh', 'druhy', 'druhů')}
          </Typography>
        </Stack>
      </Stack>
    );
  };

  return (
    <PageContainer>
      {selectedId ? (
        <QueryBoundary query={detail}>
          {(supplier) => (
            <SupplierDetail
              supplier={supplier}
              editable={editable}
              tab={detailTab}
              onTabChange={selectTab}
              onBack={() => navigate(PATHS.suppliers)}
              onEdit={() => setEditingOpen(true)}
              onDelete={() => setConfirmDelete(true)}
              onEditHours={() => setHoursOpen(true)}
              onAddGood={() => { setEditingGood(undefined); setGoodOpen(true); }}
              onEditGood={(good) => { setEditingGood(good); setGoodOpen(true); }}
              onDeleteGood={(good) => setConfirmDeleteGood(good)}
            />
          )}
        </QueryBoundary>
      ) : (
        <>
          <PageHeader
            eyebrow="Evidence"
            title="Dodavatelé"
            subtitle="Firmy, kde kupujeme nebo plníme všechno kromě piva — CO₂ a Biogon, obaly, sanitaci."
            actions={newSupplierButton}
          />

          <QueryBoundary
            query={list}
            isEmpty={(data) => data.length === 0}
            emptyState={
              <EmptyState
                icon={<FactoryIcon />}
                title="Zatím žádní dodavatelé"
                description="Přidejte firmu, kde kupujete CO₂, obaly nebo sanitaci."
                action={newSupplierButton}
              />
            }
          >
            {() => (
              <>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
                  <Box sx={{ minWidth: 280 }}>
                    <SearchField
                      value={search}
                      onChange={setSearch}
                      placeholder="Hledat dodavatele nebo zboží…"
                      width="100%"
                    />
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
                    {filtered.length} {plural(filtered.length, 'dodavatel', 'dodavatelé', 'dodavatelů')}
                  </Typography>
                </Stack>

                {filtered.length === 0 ? (
                  <EmptyState
                    icon={<FactoryIcon />}
                    title="Žádní dodavatelé"
                    action={
                      search ? (
                        <Button size="small" onClick={() => setSearch('')}>Zrušit hledání</Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <Card sx={{ p: { xs: 1, sm: 1.5 } }}>
                    <DataTable
                      columns={columns}
                      rows={filtered}
                      getRowKey={(s) => s.id ?? ''}
                      onRowClick={(s) => navigate(`${PATHS.suppliers}/${s.id}`)}
                      mobileCard={supplierCard}
                      paginated
                      pageSizeKey="suppliers"
                      sort={sort}
                      onSortChange={setSort}
                      pageResetKey={`${search}|${sort?.key ?? ''}|${sort?.direction ?? ''}`}
                    />
                  </Card>
                )}
              </>
            )}
          </QueryBoundary>
        </>
      )}

      <SupplierFormDrawer open={formOpen} onClose={() => setFormOpen(false)} />
      <SupplierFormDrawer open={editingOpen} supplier={detail.data} onClose={() => setEditingOpen(false)} />

      {selectedId && (
        <>
          <OpeningHoursDrawer
            open={hoursOpen}
            supplierId={selectedId}
            supplierName={detail.data?.name ?? ''}
            hours={detail.data?.openingHours ?? []}
            onClose={() => setHoursOpen(false)}
          />
          <SupplierGoodDrawer
            open={goodOpen}
            supplierId={selectedId}
            good={editingGood}
            onClose={() => setGoodOpen(false)}
          />
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Smazat dodavatele?"
        message={
          <>
            Opravdu smazat <strong>{detail.data?.name}</strong>? Zmizí i jeho ceník a otevírací
            doba.
          </>
        }
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteGood)}
        title="Smazat zboží?"
        message={
          <>
            „<strong>{confirmDeleteGood?.name}</strong>“ zmizí z ceníku i se všemi cenami.
          </>
        }
        busy={delGood.isPending}
        onConfirm={doDeleteGood}
        onClose={() => setConfirmDeleteGood(undefined)}
      />
    </PageContainer>
  );
}
