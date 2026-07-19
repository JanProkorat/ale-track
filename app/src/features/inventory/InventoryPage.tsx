import { useState } from 'react';
import { Box, Button, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SearchField } from 'src/components/common/SearchField';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { ViewToggle, type ViewMode } from 'src/components/common/ViewToggle';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { apiErrorMessage } from 'src/api/errors';
import { num, fmtLiters, plural } from 'src/lib/format';
import { L } from 'src/lib/labels';
import { ProductKind, ProductType, type InventoryItemListItemDto } from 'src/generated/api-client';
import { useInventory, useDeleteInventoryItem } from 'src/hooks/useInventory';
import { InventoryItemFormDrawer } from './InventoryItemFormDrawer';

const kindLabel = (k?: ProductKind) => (k != null ? (L.kind[ProductKind[k]] ?? '—') : undefined);
const typeLabel = (t?: ProductType) => (t != null ? (L.ptype[ProductType[t]] ?? '—') : undefined);

/** Kind/type + package size as a secondary line under the item name. */
function itemSubtitle(item: InventoryItemListItemDto): string {
  return [kindLabel(item.kind), typeLabel(item.type), fmtLiters(item.packageSize)]
    .filter(Boolean)
    .join(' · ');
}

/** Section shape after client-side filtering — a plain object (spread off the
 * generated `InventorySectionDto` class instance), not the class itself. */
interface FilteredSection {
  id?: string;
  name?: string;
  items: InventoryItemListItemDto[];
}

function SectionHeading({ section }: { section: FilteredSection }) {
  const count = section.items?.length ?? 0;
  return (
    <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{section.name || 'Bez pivovaru'}</Typography>
      <Typography variant="body2" color="text.secondary">
        {count} {plural(count, 'položka', 'položky', 'položek')}
      </Typography>
    </Stack>
  );
}

function ItemCard({
  item,
  editable,
  formatMoney,
  onEdit,
  onDelete,
}: {
  item: InventoryItemListItemDto;
  editable: boolean;
  formatMoney: (v: number | null | undefined) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{item.name}</Typography>
        {editable && (
          <Stack direction="row" spacing={0.25} flexShrink={0}>
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
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {kindLabel(item.kind) && <Chip size="small" label={kindLabel(item.kind)} />}
        {typeLabel(item.type) && <Chip size="small" variant="outlined" label={typeLabel(item.type)} />}
        {item.packageSize != null && (
          <Chip size="small" variant="outlined" label={fmtLiters(item.packageSize)} />
        )}
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 'auto', pt: 1 }}>
        <Box>
          <Typography
            sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            Množství
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{num(item.quantity ?? 0)}</Typography>
        </Box>
        <Typography sx={{ fontWeight: 600 }}>{formatMoney(item.priceForUnitWithVat)}</Typography>
      </Stack>
      {item.note && (
        <Typography variant="caption" color="text.secondary">
          {item.note}
        </Typography>
      )}
    </Card>
  );
}

export function InventoryPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('inventory');
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();

  const query = useInventory();
  const del = useDeleteInventoryItem();

  const [search, setSearch] = useState('');
  const [section, setSection] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItemListItemDto | undefined>(undefined);
  const [confirm, setConfirm] = useState<InventoryItemListItemDto | null>(null);

  const sectionOptions: ComboOption[] = (query.data ?? []).map((s) => ({
    value: s.name ?? s.id ?? '',
    label: s.name ?? '—',
  }));

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (item: InventoryItemListItemDto) => {
    setEditing(item);
    setFormOpen(true);
  };

  const doDelete = async () => {
    if (!confirm?.id) return;
    try {
      await del.mutateAsync(confirm.id);
      enqueueSnackbar('Položka vyskladněna.', { variant: 'success' });
      setConfirm(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const columns: Column<InventoryItemListItemDto>[] = [
    {
      key: 'name',
      header: 'Název',
      render: (i) => (
        <Box>
          <Typography sx={{ fontWeight: 600 }}>{i.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {itemSubtitle(i)}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'quantity',
      header: 'Množství',
      align: 'right',
      width: 120,
      render: (i) => num(i.quantity ?? 0),
    },
    {
      key: 'price',
      header: 'Cena/ks',
      align: 'right',
      width: 140,
      render: (i) => formatMoney(i.priceForUnitWithVat),
    },
    ...(editable
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 96,
            render: (i: InventoryItemListItemDto) => (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Upravit">
                  <IconButton size="small" onClick={() => openEdit(i)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Smazat">
                  <IconButton size="small" color="error" onClick={() => setConfirm(i)}>
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
        eyebrow="Sklad"
        title="Sklad"
        subtitle="Skladové zásoby podle pivovaru."
        actions={
          <>
            <SearchField value={search} onChange={setSearch} placeholder="Hledat položku…" />
            <Combobox
              value={section}
              onChange={setSection}
              options={sectionOptions}
              placeholder="Všechny pivovary"
              clearable
              fullWidth={false}
              size="small"
            />
            <ViewToggle value={viewMode} onChange={setViewMode} />
            {editable && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                Naskladnit
              </Button>
            )}
          </>
        }
      />

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        <QueryBoundary
          query={query}
          isEmpty={(sections) => sections.every((s) => (s.items ?? []).length === 0)}
          emptyState={
            <EmptyState
              icon={<Inventory2OutlinedIcon />}
              title="Sklad je zatím prázdný"
              description="Naskladněte první položku z nabídky produktů."
              action={
                editable && (
                  <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    Naskladnit
                  </Button>
                )
              }
            />
          }
        >
          {(sections) => {
            const q = search.trim().toLowerCase();
            const filtered = sections
              .filter((s) => !section || s.name === section)
              .map((s) => ({
                ...s,
                items: q
                  ? (s.items ?? []).filter((i) => (i.name ?? '').toLowerCase().includes(q))
                  : (s.items ?? []),
              }))
              .filter((s) => (s.items ?? []).length > 0);

            if (filtered.length === 0) {
              return (
                <EmptyState
                  title="Nic nenalezeno"
                  description="Zkuste upravit hledání nebo filtr pivovaru."
                  dense
                />
              );
            }

            return (
              <Stack spacing={3}>
                {filtered.map((s) => (
                  <Box key={s.id ?? s.name}>
                    <SectionHeading section={s} />
                    {viewMode === 'list' ? (
                      <DataTable
                        columns={columns}
                        rows={s.items ?? []}
                        getRowKey={(i) => i.id ?? ''}
                      />
                    ) : (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                          gap: 2,
                        }}
                      >
                        {(s.items ?? []).map((i) => (
                          <ItemCard
                            key={i.id}
                            item={i}
                            editable={editable}
                            formatMoney={formatMoney}
                            onEdit={() => openEdit(i)}
                            onDelete={() => setConfirm(i)}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            );
          }}
        </QueryBoundary>
      </Card>

      <InventoryItemFormDrawer open={formOpen} item={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Vyskladnit položku?"
        message={
          <>
            Opravdu chcete vyskladnit <strong>{confirm?.name}</strong>? Tuto akci nelze vzít zpět.
          </>
        }
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirm(null)}
      />
    </PageContainer>
  );
}
