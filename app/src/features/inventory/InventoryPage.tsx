import { useMemo, useState } from 'react';
import { Box, Button, Card, Chip, Collapse, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SearchField } from 'src/components/common/SearchField';
import { StatCell } from 'src/components/common/StatCell';
import { Combobox, type ComboOption } from 'src/components/common/Combobox';
import { ViewToggle, type ViewMode } from 'src/components/common/ViewToggle';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { num, plural } from 'src/lib/format';
import { UpdateInventoryItemDto, type InventoryItemListItemDto } from 'src/generated/api-client';
import { useInventory, useDeleteInventoryItem, useUpdateInventoryItem } from 'src/hooks/useInventory';
import { useBreweries } from 'src/hooks/useBreweries';
import { InventoryItemFormDrawer } from './InventoryItemFormDrawer';
import { groupInventoryItems, isLow, type InventoryGroup } from './inventoryModel';
import { InventoryProductCard, InventoryProductPanel } from './InventoryProductPanel';

/** Section shape after client-side filtering — a plain object (spread off the
 * generated `InventorySectionDto` class instance), not the class itself. */
interface FilteredSection {
  id?: string;
  name?: string;
  items: InventoryItemListItemDto[];
}

/** A filtered section with its products folded together and its colour resolved. */
interface GroupedSection extends FilteredSection {
  color?: string;
  groups: InventoryGroup[];
}

/** One brewery's stock: a card whose head folds the whole section away. Same
 * affordance as the delivery editor's brewery stops, so a long sklad can be
 * narrowed to the brewery being counted. */
function BrewerySection({
  section,
  color,
  editable,
  onAdjust,
  onDelete,
}: {
  section: GroupedSection;
  color?: string;
  editable: boolean;
  onAdjust: (item: InventoryItemListItemDto, delta: number) => void;
  onDelete: (item: InventoryItemListItemDto) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const count = section.items.length;
  const label = section.name || 'Ostatní (ručně evidované)';
  const toggle = () => setCollapsed((v) => !v);

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        }}
        sx={{
          px: 2, py: 1.5, cursor: 'pointer',
          borderBottom: collapsed ? 0 : 1, borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <ExpandMoreIcon
          fontSize="small"
          sx={{ color: 'text.secondary', flexShrink: 0, transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : 'none' }}
        />
        {section.name ? (
          <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        ) : (
          <Inventory2OutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        )}
        <Typography sx={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1, minWidth: 0 }} noWrap>
          {label}
        </Typography>
        <Chip
          size="small"
          label={`${count} ${plural(count, 'položka', 'položky', 'položek')}`}
          sx={{ height: 22, fontSize: 11.5, fontWeight: 600 }}
        />
      </Stack>

      <Collapse in={!collapsed} unmountOnExit>
        <Stack spacing={1.25} sx={{ p: 2 }}>
          {section.groups.map((group) => (
            <InventoryProductPanel
              key={group.key}
              group={group}
              color={color}
              editable={editable}
              onAdjust={onAdjust}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      </Collapse>
    </Card>
  );
}

export function InventoryPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('inventory');
  const { enqueueSnackbar } = useSnackbar();

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
    // The backend forbids changing productId/name on update (they're immutable)
    // and requires quantity > 0, so send only quantity + the existing note.
    const next = Math.max(1, (item.quantity ?? 1) + delta);
    if (!item.id || next === item.quantity) return;
    try {
      await update.mutateAsync({
        id: item.id,
        data: new UpdateInventoryItemDto({ quantity: next, note: item.note ?? undefined }),
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

  // Both views render products, not rows: a beer stocked in three keg sizes is
  // one panel/tile with three lines. The brewery colour is resolved here so the
  // grid, which flattens the sections away, keeps it.
  const groupedSections = useMemo<GroupedSection[]>(
    () => filteredSections.map((s) => ({
      id: s.id,
      name: s.name,
      items: s.items,
      color: s.name ? colorByName.get(s.name) : undefined,
      groups: groupInventoryItems(s.items),
    })),
    [filteredSections, colorByName],
  );

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
          // Either way a product's sizes travel together (groupInventoryItems).
          if (viewMode === 'grid') {
            const allGroups = groupedSections.flatMap((s) =>
              s.groups.map((group) => ({ group, color: s.color }))
            );
            return (
              <Box
                sx={{
                  // Masonry by CSS columns, not grid. A grid keeps row tracks,
                  // so one tall tile (a product with several sizes) sets the
                  // height of its whole row and leaves gaps under every short
                  // neighbour. Columns have no rows to align, so tiles stack
                  // flush. The trade is reading order: down each column, not
                  // across — which keeps a brewery's run contiguous anyway.
                  columnWidth: '290px',
                  // Spacing units, not pixels: sx multiplies gap values by 8,
                  // so a literal 16 here would be a 128px gutter.
                  columnGap: 2,
                  '& > *': {
                    breakInside: 'avoid',
                    WebkitColumnBreakInside: 'avoid',
                    mb: 2,
                  },
                }}
              >
                {allGroups.map(({ group, color }) => (
                  <InventoryProductCard
                    key={group.key}
                    group={group}
                    color={color}
                    editable={editable}
                    onAdjust={adjustQty}
                    onDelete={setConfirm}
                  />
                ))}
              </Box>
            );
          }

          return (
            <Stack spacing={2}>
              {groupedSections.map((s) => (
                <BrewerySection
                  key={s.id ?? s.name ?? 'free'}
                  section={s}
                  color={s.color}
                  editable={editable}
                  onAdjust={adjustQty}
                  onDelete={setConfirm}
                />
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
