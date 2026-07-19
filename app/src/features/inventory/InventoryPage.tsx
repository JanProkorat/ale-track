import { useMemo, useState, type ReactNode } from 'react';
import { Box, Button, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SearchField } from 'src/components/common/SearchField';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { ViewToggle, type ViewMode } from 'src/components/common/ViewToggle';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { StatusPill } from 'src/components/common/StatusPill';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { apiErrorMessage } from 'src/api/errors';
import { num, fmtLiters } from 'src/lib/format';
import { kindLabel, ptypeLabel } from 'src/lib/labels';
import { type InventoryItemListItemDto } from 'src/generated/api-client';
import { useInventory, useDeleteInventoryItem } from 'src/hooks/useInventory';
import { InventoryItemFormDrawer } from './InventoryItemFormDrawer';

const typeLabel = ptypeLabel;

/** An item is "low stock" only when it's linked to a catalog product — free/manual
 * entries never carry the warning (matches the prototype's `i.productId && qty<=3`). */
function isLow(item: InventoryItemListItemDto): boolean {
  return Boolean(item.productId) && (item.quantity ?? 0) <= 3;
}

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
  if (!section.name) {
    // Manually-entered items with no brewery — the prototype's "Ostatní (ručně evidované)" group.
    return (
      <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>Ostatní (ručně evidované)</Typography>
    );
  }
  return (
    <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{section.name}</Typography>
      <Typography variant="body2" color="text.secondary">
        {count} položek
      </Typography>
    </Stack>
  );
}

/** One stat cell inside the shared stat bar — plain inline cell (not its own
 * floating Card), separated from its neighbour by a left border. */
function StatCell({
  icon,
  label,
  value,
  critical,
  first,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  critical?: boolean;
  first?: boolean;
}) {
  return (
    <Box
      sx={{
        flex: '0 1 auto',
        minWidth: 112,
        px: 1.875,
        py: 1.375,
        ...(!first && { borderLeft: '1px solid', borderColor: 'divider' }),
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          bgcolor: (t) => (critical ? t.palette.brand.critTint : t.palette.brand.greyTint),
          color: critical ? 'error.main' : 'text.secondary',
          '& svg': { fontSize: 18 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, ...(critical && { color: 'error.main' }) }}>
          {value}
        </Typography>
      </Box>
    </Box>
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
  const low = isLow(item);
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
      <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center">
        {kindLabel(item.kind) && <Chip size="small" label={kindLabel(item.kind)} />}
        {typeLabel(item.type) && <Chip size="small" variant="outlined" label={typeLabel(item.type)} />}
        {item.packageSize != null && (
          <Chip size="small" variant="outlined" label={fmtLiters(item.packageSize)} />
        )}
        {item.productId && <StatusPill tone={low ? 'crit' : 'ok'} label={low ? 'nízká' : 'skladem'} />}
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 'auto', pt: 1 }}>
        <Box>
          <Typography
            sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            Množství
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, ...(low && { color: 'error.main' }) }}>
            {num(item.quantity ?? 0)}
          </Typography>
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
    value: s.id ?? s.name ?? '',
    label: s.name || 'Ostatní (ruční)',
  }));

  // Overall stock stats — computed across ALL sections/items regardless of the
  // current search/brewery filter (matches the prototype's stat bar, which
  // always reflects the whole stock, not the filtered view below it).
  const stats = useMemo(() => {
    const sections = query.data ?? [];
    let totalItems = 0;
    let totalQty = 0;
    let low = 0;
    for (const s of sections) {
      for (const i of s.items ?? []) {
        totalItems += 1;
        totalQty += i.quantity ?? 0;
        if (isLow(i)) low += 1;
      }
    }
    return { totalItems, totalQty, low };
  }, [query.data]);

  const filteredSections = useMemo<FilteredSection[]>(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? [])
      .filter((s) => !section || (s.id ?? s.name ?? '') === section)
      .map((s) => ({
        id: s.id,
        name: s.name,
        items: q ? (s.items ?? []).filter((i) => (i.name ?? '').toLowerCase().includes(q)) : (s.items ?? []),
      }))
      .filter((s) => s.items.length > 0);
  }, [query.data, search, section]);

  const filteredCount = filteredSections.reduce((n, s) => n + s.items.length, 0);

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
      header: 'Produkt',
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
      key: 'price',
      header: 'Cena/ks',
      align: 'right',
      width: 120,
      render: (i) => formatMoney(i.priceForUnitWithVat),
    },
    {
      key: 'quantity',
      header: 'Skladem',
      align: 'right',
      width: 100,
      render: (i) => (
        <Typography component="span" sx={{ fontWeight: 700, ...(isLow(i) && { color: 'error.main' }) }}>
          {num(i.quantity ?? 0)}
        </Typography>
      ),
    },
    {
      key: 'status',
      header: 'Stav',
      width: 140,
      render: (i) => (i.productId ? <StatusPill tone={isLow(i) ? 'crit' : 'ok'} label={isLow(i) ? 'nízká zásoba' : 'skladem'} /> : null),
    },
    {
      key: 'note',
      header: 'Pozn.',
      render: (i) => <Typography color="text.secondary">{i.note ?? ''}</Typography>,
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
        subtitle="Evidence zboží na skladě. Naskladňuje dovoz, vyskladňuje vývoz — lze i ručně."
        actions={
          editable && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Ruční položka
            </Button>
          )
        }
      />

      <Card sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <StatCell first icon={<WarehouseOutlinedIcon />} label="Položek na skladě" value={stats.totalItems} />
          <StatCell icon={<Inventory2OutlinedIcon />} label="Kusů celkem" value={num(stats.totalQty)} />
          <StatCell
            icon={<WarningAmberOutlinedIcon />}
            label="Nízká zásoba"
            value={stats.low}
            critical={stats.low > 0}
          />
          <Box
            sx={{
              flex: '1 1 340px',
              minWidth: 300,
              borderLeft: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1.125,
              px: 1.75,
              py: 1.375,
              flexWrap: 'nowrap',
            }}
          >
            <Box sx={{ flex: '1 1 auto', minWidth: 120 }}>
              <SearchField value={search} onChange={setSearch} placeholder="Hledat…" width="100%" />
            </Box>
            <Box sx={{ width: 180, flex: '0 0 auto' }}>
              <Combobox
                value={section}
                onChange={setSection}
                options={sectionOptions}
                placeholder="Všechny pivovary"
                clearable
                fullWidth
                size="small"
              />
            </Box>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </Box>
        </Box>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.25, mx: 0.25 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
          {filteredCount} položek
        </Typography>
      </Box>

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
                  Ruční položka
                </Button>
              )
            }
          />
        }
      >
        {() => {
          if (filteredSections.length === 0) {
            return (
              <EmptyState title="Nic nenalezeno" description="Zkuste upravit hledání nebo filtr pivovaru." dense />
            );
          }

          // Grid view is a single flat tile grid across all matching sections;
          // list view stays grouped per brewery — matching the prototype exactly.
          if (viewMode === 'grid') {
            const allItems = filteredSections.flatMap((s) => s.items);
            return (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: 2,
                }}
              >
                {allItems.map((i) => (
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
            );
          }

          return (
            <Stack spacing={3}>
              {filteredSections.map((s) => (
                <Box key={s.id ?? s.name ?? 'free'}>
                  <SectionHeading section={s} />
                  <Card variant="outlined">
                    <DataTable columns={columns} rows={s.items} getRowKey={(i) => i.id ?? ''} />
                  </Card>
                </Box>
              ))}
            </Stack>
          );
        }}
      </QueryBoundary>

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
