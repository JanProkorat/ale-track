import { useEffect, useState } from 'react';
import { Box, Tabs, Tab, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import FactoryIcon from '@mui/icons-material/FactoryOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { type BreweryListItemDto } from 'src/generated/api-client';
import { useBreweries, useBrewery, useDeleteBrewery } from 'src/hooks/useBreweries';
import { BreweryDetail } from './BreweryDetail';
import { BreweryFormDrawer } from './BreweryFormDrawer';

export function BreweriesPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('breweries');
  const { enqueueSnackbar } = useSnackbar();

  const list = useBreweries();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default the active tab to the first brewery once the list loads.
  useEffect(() => {
    const rows = list.data;
    if (!rows) return;
    if (selectedId && rows.some((b) => b.id === selectedId)) return;
    setSelectedId(rows[0]?.id ?? null);
  }, [list.data, selectedId]);

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
      <PageHeader
        eyebrow="Evidence"
        title="Pivovary"
        subtitle="Dodavatelé, jejich ceníky a připomínky."
        actions={
          editable && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
              Nový pivovar
            </Button>
          )
        }
      />

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
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs
                value={selectedId ?? rows[0]?.id ?? false}
                onChange={(_e, v: string) => setSelectedId(v)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {rows.map((b) => (
                  <Tab
                    key={b.id}
                    value={b.id}
                    label={b.name}
                    iconPosition="start"
                    icon={<Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: b.color ?? 'grey.400' }} />}
                    sx={{ minHeight: 48 }}
                  />
                ))}
              </Tabs>
            </Box>

            <QueryBoundary query={detail}>
              {(brewery) => (
                <BreweryDetail
                  key={brewery.id}
                  brewery={brewery}
                  editable={editable}
                  onEdit={() => setEditingOpen(true)}
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </QueryBoundary>
          </>
        )}
      </QueryBoundary>

      {/* Create */}
      <BreweryFormDrawer open={formOpen} onClose={() => setFormOpen(false)} />
      {/* Edit (uses the loaded detail) */}
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
