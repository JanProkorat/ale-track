import { useEffect, useState } from 'react';
import { Box, Button, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useQueries } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FactoryIcon from '@mui/icons-material/FactoryOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { apiErrorMessage } from 'src/api/errors';
import { type BreweryListItemDto } from 'src/generated/api-client';
import { useBreweries, useBrewery, useDeleteBrewery } from 'src/hooks/useBreweries';
import { BreweryDetail } from './BreweryDetail';
import { BreweryFormDrawer } from './BreweryFormDrawer';

function CountBadge({ n, active, color }: { n: number; active: boolean; color: string }) {
  return (
    <Box
      component="span"
      sx={{
        px: 0.9, py: 0.1, borderRadius: 999, fontSize: 11.5, fontWeight: 700,
        bgcolor: (t) => (active ? alpha(color, 0.18) : t.palette.brand.greyTint),
        color: active ? 'text.primary' : 'text.secondary',
      }}
    >
      {n}
    </Box>
  );
}

export function BreweriesPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('breweries');
  const { enqueueSnackbar } = useSnackbar();
  const ds = useDataSource();

  const list = useBreweries();
  const breweries = list.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default the active tab to the first brewery once the list loads.
  useEffect(() => {
    const rows = list.data;
    if (!rows || rows.length === 0) return;
    if (selectedId && rows.some((b) => b.id === selectedId)) return;
    setSelectedId(rows[0]?.id ?? null);
  }, [list.data, selectedId]);

  // Per-brewery product counts for the tab badges (shares cache with the detail).
  const countQueries = useQueries({
    queries: breweries.map((b) => ({
      queryKey: qk.breweryProducts(b.id ?? '', {}),
      queryFn: ({ signal }: { signal: AbortSignal }) => ds.getBreweryProductsListEndpoint(b.id!, {}, signal),
      enabled: Boolean(b.id),
    })),
  });
  const countFor = (id?: string) => {
    const i = breweries.findIndex((b) => b.id === id);
    return i >= 0 ? countQueries[i]?.data?.length ?? 0 : 0;
  };

  const detail = useBrewery(selectedId ?? undefined);
  const del = useDeleteBrewery();
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doDelete = async () => {
    if (!selectedId) return;
    try {
      await del.mutateAsync(selectedId);
      enqueueSnackbar('Pivovar smazán.', { variant: 'success' });
      setConfirmDelete(false);
      setSelectedId(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <PageContainer>
      <PageHeader eyebrow="Evidence" title="Pivovary" />

      <QueryBoundary
        query={list}
        isEmpty={(rows) => rows.length === 0}
        emptyState={
          <EmptyState
            icon={<FactoryIcon />}
            title="Zatím žádné pivovary"
            description="Přidejte první pivovar a jeho ceník."
            action={editable && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>Nový pivovar</Button>}
          />
        }
      >
        {(rows: BreweryListItemDto[]) => (
          <>
            {/* Brewery tab strip */}
            <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5, borderBottom: '2px solid', borderColor: 'divider', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.5, flex: 1, overflowX: 'auto' }}>
                {rows.map((b) => {
                  const active = b.id === selectedId;
                  const color = b.color ?? '#8791A0';
                  return (
                    <Box
                      key={b.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedId(b.id ?? null)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.1, cursor: 'pointer',
                        px: 2.1, py: 1.6, whiteSpace: 'nowrap',
                        borderRadius: '7px 7px 0 0',
                        borderBottom: '3px solid',
                        borderColor: active ? color : 'transparent',
                        mb: '-2px',
                        bgcolor: active ? 'background.paper' : 'transparent',
                        color: active ? 'text.primary' : 'text.secondary',
                        transition: 'background .15s, color .15s',
                        '&:hover': { color: 'text.primary', bgcolor: active ? 'background.paper' : 'action.hover' },
                      }}
                    >
                      <Box sx={{ width: 11, height: 11, borderRadius: '4px', bgcolor: color, flexShrink: 0, boxShadow: `0 0 0 3px ${alpha(color, 0.18)}` }} />
                      <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{b.name}</Typography>
                      <CountBadge n={countFor(b.id)} active={active} color={color} />
                      {active && editable && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 0.75, pl: 1, borderLeft: '1px solid', borderColor: 'divider' }}>
                          <Tooltip title="Upravit pivovar">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditingOpen(true); }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Smazat pivovar">
                            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
              {editable && (
                <>
                  <Divider orientation="vertical" flexItem sx={{ my: 1 }} />
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)} sx={{ flexShrink: 0, alignSelf: 'center' }}>
                    Nový pivovar
                  </Button>
                </>
              )}
            </Box>

            <QueryBoundary query={detail}>
              {(brewery) => <BreweryDetail key={brewery.id} brewery={brewery} editable={editable} />}
            </QueryBoundary>
          </>
        )}
      </QueryBoundary>

      <BreweryFormDrawer open={formOpen} onClose={() => setFormOpen(false)} />
      <BreweryFormDrawer open={editingOpen} brewery={detail.data} onClose={() => setEditingOpen(false)} />

      <ConfirmDialog
        open={confirmDelete}
        title="Smazat pivovar?"
        message={<>Opravdu smazat <strong>{detail.data?.name}</strong> včetně jeho ceníku? Tuto akci nelze vzít zpět.</>}
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}
