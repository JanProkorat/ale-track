import { useMemo, useState, type ReactNode } from 'react';
import { Box, Button, Card, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
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
import { kindLabel } from 'src/lib/labels';
import { UpdateInventoryItemDto, type InventoryItemListItemDto } from 'src/generated/api-client';
import { useInventory, useDeleteInventoryItem, useUpdateInventoryItem } from 'src/hooks/useInventory';
import { useBreweries } from 'src/hooks/useBreweries';
import { InventoryItemFormDrawer } from './InventoryItemFormDrawer';

/** An item is "low stock" only when it's linked to a catalog product — free/manual
 * entries never carry the warning (matches the prototype's `i.productId && qty<=3`). */
function isLow(item: InventoryItemListItemDto): boolean {
  return Boolean(item.productId) && (item.quantity ?? 0) <= 3;
}

/** Kind + package size as a secondary line under the item name (no beer type,
 * matching the prototype). */
function itemSubtitle(item: InventoryItemListItemDto): string {
  return [kindLabel(item.kind), fmtLiters(item.packageSize)].filter(Boolean).join(' · ');
}

/** − / + quantity stepper (matches the prototype's inline stock adjust). */
function QtyStepper({
  item,
  editable,
  onAdjust,
}: {
  item: InventoryItemListItemDto;
  editable: boolean;
  onAdjust: (item: InventoryItemListItemDto, delta: number) => void;
}) {
  const low = isLow(item);
  const btnSx = { border: 1, borderColor: 'divider', borderRadius: 1.5, width: 30, height: 30 } as const;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end">
      {editable && (
        <IconButton size="small" onClick={() => onAdjust(item, -1)} sx={btnSx} aria-label="Ubrat">
          <RemoveIcon fontSize="small" />
        </IconButton>
      )}
      <Typography sx={{ minWidth: 34, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', ...(low && { color: 'error.main' }) }}>
        {num(item.quantity ?? 0)}
      </Typography>
      {editable && (
        <IconButton size="small" onClick={() => onAdjust(item, 1)} sx={btnSx} aria-label="Přidat">
          <AddIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );
}

/** Section shape after client-side filtering — a plain object (spread off the
 * generated `InventorySectionDto` class instance), not the class itself. */
interface FilteredSection {
  id?: string;
  name?: string;
  items: InventoryItemListItemDto[];
}

function SectionHeading({ section, color }: { section: FilteredSection; color?: string }) {
  const count = section.items?.length ?? 0;
  const label = section.name || 'Ostatní (ručně evidované)';
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      {section.name ? (
        <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
      ) : (
        <Inventory2OutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      )}
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
  color,
  onAdjust,
  onDelete,
}: {
  item: InventoryItemListItemDto;
  editable: boolean;
  color?: string;
  onAdjust: (item: InventoryItemListItemDto, delta: number) => void;
  onDelete: () => void;
}) {
  const low = isLow(item);
  return (
    <Card variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0, mt: 0.5 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>{item.name}</Typography>
          <Typography variant="caption" color="text.secondary">{itemSubtitle(item)}</Typography>
        </Box>
        {item.productId && <StatusPill tone={low ? 'crit' : 'ok'} label={low ? 'nízká' : 'skladem'} />}
      </Stack>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 0.5 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <QtyStepper item={item} editable={editable} onAdjust={onAdjust} />
        {editable && (
          <Tooltip title="Vyskladnit">
            <IconButton size="small" onClick={onDelete} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, color: 'error.main' }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
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
  const update = useUpdateInventoryItem();

  // Brewery colors for the section swatches (best-effort; the color is cosmetic
  // so a missing/forbidden breweries list just falls back to a neutral square).
  const breweries = useBreweries();
  const colorByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of breweries.data ?? []) if (b.name && b.color) m.set(b.name, b.color);
    return m;
  }, [breweries.data]);

  const adjustQty = async (item: InventoryItemListItemDto, delta: number) => {
    const next = Math.max(0, (item.quantity ?? 0) + delta);
    if (!item.id || next === item.quantity) return;
    try {
      await update.mutateAsync({
        id: item.id,
        data: new UpdateInventoryItemDto({ productId: item.productId, name: item.name, quantity: next, note: item.note }),
      });
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

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
      width: 150,
      render: (i) => <QtyStepper item={i} editable={editable} onAdjust={adjustQty} />,
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
              <Stack direction="row" justifyContent="flex-end">
                <Tooltip title="Vyskladnit">
                  <IconButton size="small" onClick={() => setConfirm(i)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, color: 'error.main' }}>
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
            const allItems = filteredSections.flatMap((s) =>
              s.items.map((i) => ({ item: i, color: s.name ? colorByName.get(s.name) : undefined }))
            );
            return (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: 2,
                }}
              >
                {allItems.map(({ item, color }) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    color={color}
                    editable={editable}
                    onAdjust={adjustQty}
                    onDelete={() => setConfirm(item)}
                  />
                ))}
              </Box>
            );
          }

          return (
            <Stack spacing={3}>
              {filteredSections.map((s) => (
                <Box key={s.id ?? s.name ?? 'free'}>
                  <SectionHeading section={s} color={s.name ? colorByName.get(s.name) : undefined} />
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
