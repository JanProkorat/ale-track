import { useMemo, useState } from 'react';
import { Box, Button, Chip, Collapse, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import { SegControl } from 'src/components/common/SegControl';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { useBreweryColors } from 'src/hooks/useBreweries';
import { fmtDate, fmtLiters, plural } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import {
  bySection,
  historyRows,
  searchRows,
  sellableRows,
  type CatalogSection,
  type HistoryRow,
  type StockGroup,
  type StockRow,
} from './saleCatalogModel';
import { type InventorySectionDto } from 'src/generated/api-client';

/** How long a brewery panel takes to open or shut. Matches ShipmentDetail's collapsing
 *  brewery sections so the two catalogs feel the same. */
const SECTION_MOTION_MS = 180;

type CatalogTab = 'browse' | 'history';

interface HistoryEntry {
  inventoryItemId?: string;
  lastSoldDate?: string | Date;
  lastUnitPriceWithVat?: number;
  lastQuantity?: number;
}

/**
 * Stepper matching the order editor's: a bare + until the row is in the cart, then − n +.
 *
 * Every label names its item. A catalog page is dozens of these, and a screen reader working through
 * a list of identical "Přidat" buttons has no way to tell which beer it is about to add.
 */
function QtyControl({
  qty,
  max,
  itemName,
  onAdd,
  onChange,
}: {
  qty: number;
  max: number;
  itemName: string;
  onAdd: () => void;
  onChange: (delta: number) => void;
}) {
  if (qty === 0) {
    return (
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon fontSize="small" />}
        onClick={onAdd}
        aria-label={`Přidat ${itemName}`}
        sx={{
          flexShrink: 0,
          color: 'text.primary',
          borderColor: 'divider',
          fontWeight: 700,
          bgcolor: 'background.paper',
        }}
      >
        Přidat
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
      <IconButton
        size="small"
        onClick={() => onChange(-1)}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 30, height: 30 }}
        aria-label={`Odebrat ${itemName}`}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {qty}
      </Typography>
      <IconButton
        size="small"
        onClick={() => onChange(1)}
        disabled={qty >= max}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 30, height: 30 }}
        aria-label={`Přidat ${itemName}`}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

/**
 * The chips and stock line under an item's name.
 *
 * Deliberately no price: it is rendered by the row itself, right-aligned beside the stepper, so a
 * single item and a size variant put their price in the same column. Inlining it here — which is what
 * the order editor's ProductRow does — is what made the two shapes disagree.
 */
function RowMeta({ row }: { row: HistoryRow }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
      {row.kind != null && <Chip size="small" label={kindLabel(row.kind)} sx={{ height: 20, fontSize: 11 }} />}
      {row.packageSize != null && (
        <Chip size="small" label={fmtLiters(row.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
      )}
      <Typography sx={{ fontSize: 11.5, color: 'text.disabled', fontWeight: 600 }}>
        skladem {row.quantity ?? 0}
      </Typography>
      {row.lastSoldDate != null && (
        <Typography sx={{ fontSize: 11, color: 'info.main', fontWeight: 700 }}>
          dříve prodáno · naposled {fmtDate(row.lastSoldDate)}
        </Typography>
      )}
    </Stack>
  );
}

/** The brewery's colour swatch, shared by the section header, variant cards and single rows. */
function Swatch({ color }: { color?: string }) {
  return (
    <Box
      sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }}
    />
  );
}

/** The price cell both row shapes use, so the column lines up. */
function PriceCell({ value, formatMoney }: { value?: number; formatMoney: (v?: number) => string }) {
  if (value == null) return null;
  return (
    <Typography
      sx={{ fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
    >
      {formatMoney(value)}
    </Typography>
  );
}

function StockItemRow({
  row,
  qty,
  color,
  formatMoney,
  onAdd,
  onChange,
}: {
  row: HistoryRow;
  qty: number;
  color?: string;
  formatMoney: (v?: number) => string;
  onAdd: () => void;
  onChange: (delta: number) => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.25,
        border: 1,
        borderRadius: 2,
        borderColor: qty > 0 ? 'warning.main' : 'divider',
        bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent'),
      }}
    >
      <Swatch color={color} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>
          {row.name}
        </Typography>
        <RowMeta row={row} />
      </Box>
      <PriceCell value={row.priceWithVat} formatMoney={formatMoney} />
      <QtyControl
        qty={qty}
        max={row.quantity ?? 0}
        itemName={row.name ?? ''}
        onAdd={onAdd}
        onChange={onChange}
      />
    </Box>
  );
}

function VariantCard({
  group,
  qtyOf,
  color,
  formatMoney,
  onAdd,
  onChange,
}: {
  group: StockGroup;
  qtyOf: (id: string) => number;
  color?: string;
  formatMoney: (v?: number) => string;
  onAdd: (row: StockRow) => void;
  onChange: (id: string, delta: number) => void;
}) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.1, bgcolor: 'action.hover' }}>
        <Swatch color={color} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{group.name}</Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          size="small"
          label={`${group.items.length} ${plural(group.items.length, 'velikost', 'velikosti', 'velikostí')}`}
          sx={{ height: 20, fontSize: 11 }}
        />
      </Stack>
      <Stack>
        {group.items.map((variant) => {
          const qty = qtyOf(variant.id ?? '');
          return (
            <Stack
              key={variant.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                px: 1.5,
                py: 1,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent'),
              }}
            >
              {variant.kind != null && (
                <Chip size="small" label={kindLabel(variant.kind)} sx={{ height: 20, fontSize: 11 }} />
              )}
              {variant.packageSize != null && (
                <Chip
                  size="small"
                  label={fmtLiters(variant.packageSize)}
                  sx={{ height: 20, fontSize: 11, fontWeight: 800 }}
                />
              )}
              <Typography variant="caption" color="text.disabled" sx={{ flex: 1, minWidth: 0 }} noWrap>
                skladem {variant.quantity ?? 0}
              </Typography>
              <PriceCell value={variant.priceWithVat} formatMoney={formatMoney} />
              <QtyControl
                qty={qty}
                max={variant.quantity ?? 0}
                itemName={
                  variant.packageSize != null
                    ? `${variant.name ?? ''} ${fmtLiters(variant.packageSize)}`
                    : (variant.name ?? '')
                }
                onAdd={() => onAdd(variant)}
                onChange={(delta) => onChange(variant.id ?? '', delta)}
              />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

/**
 * One brewery as a collapsible bordered card — header plus its products inside — so the products
 * clearly live *within* the brewery rather than beside it. Mirrors the order editor's
 * BreweryGroupPanel.
 */
function BrewerySectionPanel({
  section,
  color,
  open,
  onToggle,
  qtyOf,
  formatMoney,
  onAdd,
  onChange,
}: {
  section: CatalogSection;
  color?: string;
  open: boolean;
  onToggle: () => void;
  qtyOf: (id: string) => number;
  formatMoney: (v?: number) => string;
  onAdd: (row: StockRow) => void;
  onChange: (id: string, delta: number) => void;
}) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          textAlign: 'left',
          bgcolor: 'action.hover',
          border: 0,
          borderBottom: open ? 1 : 0,
          borderColor: 'divider',
          px: 1.5,
          py: 1.25,
          font: 'inherit',
          cursor: 'pointer',
          color: 'text.primary',
        }}
      >
        <ChevronRightIcon
          fontSize="small"
          sx={{
            color: 'text.disabled',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: `transform ${SECTION_MOTION_MS}ms ease`,
            flexShrink: 0,
          }}
        />
        <Swatch color={color} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{section.name}</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 600, fontSize: 12.5 }}>
          {section.itemCount}
        </Typography>
        <Box sx={{ flex: 1 }} />
      </Box>
      <Collapse in={open} timeout={SECTION_MOTION_MS} unmountOnExit>
        <Box sx={{ p: 1.5, bgcolor: 'background.default' }}>
          <Stack spacing={1}>
            {section.groups.map((group) =>
              group.items.length > 1 ? (
                <VariantCard
                  key={group.name}
                  group={group}
                  qtyOf={qtyOf}
                  color={color}
                  formatMoney={formatMoney}
                  onAdd={onAdd}
                  onChange={onChange}
                />
              ) : (
                <StockItemRow
                  key={group.items[0].id}
                  row={group.items[0]}
                  qty={qtyOf(group.items[0].id ?? '')}
                  color={color}
                  formatMoney={formatMoney}
                  onAdd={() => onAdd(group.items[0])}
                  onChange={(delta) => onChange(group.items[0].id ?? '', delta)}
                />
              )
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * The sale editor's stock catalog: browse everything on the shelf, or re-add what this client bought
 * before.
 *
 * The history tab is only rendered when there is a client to have a history — a walk-in gets the
 * browse tab alone, with no segmented control at all, rather than a disabled tab explaining itself.
 */
export function SaleCatalog({
  sections,
  history,
  showHistory,
  qtyOf,
  onAdd,
  onChange,
}: {
  sections: InventorySectionDto[] | undefined;
  history: HistoryEntry[] | undefined;
  showHistory: boolean;
  qtyOf: (inventoryItemId: string) => number;
  onAdd: (row: StockRow, suggestedPrice?: number, suggestedQuantity?: number) => void;
  onChange: (inventoryItemId: string, delta: number) => void;
}) {
  const { formatMoney } = useCurrency();
  const breweryColor = useBreweryColors();
  const [tab, setTab] = useState<CatalogTab>('browse');
  const [search, setSearch] = useState('');
  // Keyed by section name and holding only the closed ones, so a brewery that appears after a
  // refetch starts open rather than hidden.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const stock = useMemo(() => sellableRows(sections), [sections]);
  const matching = useMemo(() => searchRows(stock, search), [stock, search]);
  const sectioned = useMemo(() => bySection(matching), [matching]);

  const remembered = useMemo(() => historyRows(history, stock), [history, stock]);
  const rememberedMatching = useMemo(() => searchRows(remembered, search) as HistoryRow[], [remembered, search]);

  // Falling back to browse keeps the tab honest when the buyer switches to a walk-in mid-edit.
  const activeTab: CatalogTab = showHistory ? tab : 'browse';

  return (
    <Stack spacing={1.5}>
      {showHistory && (
        <SegControl
          value={activeTab}
          onChange={setTab}
          options={[
            { value: 'browse', label: 'Procházet sklad' },
            {
              value: 'history',
              label: (
                <Box component="span">
                  Dříve prodané
                  {remembered.length > 0 && (
                    <Box component="span" sx={{ ml: 0.5, opacity: 0.55 }}>
                      {remembered.length}
                    </Box>
                  )}
                </Box>
              ),
            },
          ]}
        />
      )}

      <TextField
        size="small"
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Hledat ve skladu…"
        slotProps={{
          input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> },
        }}
      />

      {activeTab === 'history' ? (
        rememberedMatching.length === 0 ? (
          <Typography sx={{ color: 'text.disabled', py: 3, textAlign: 'center', fontSize: 13.5 }}>
            {remembered.length === 0
              ? 'Tento klient u pultu zatím nic nekoupil.'
              : 'Nic neodpovídá hledanému výrazu.'}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {rememberedMatching.map((row) => (
              <StockItemRow
                key={row.id}
                row={row}
                qty={qtyOf(row.id ?? '')}
                formatMoney={formatMoney}
                onAdd={() => onAdd(row, row.lastUnitPriceWithVat, row.lastQuantity)}
                onChange={(delta) => onChange(row.id ?? '', delta)}
              />
            ))}
          </Stack>
        )
      ) : sectioned.length === 0 ? (
        <Typography sx={{ color: 'text.disabled', py: 3, textAlign: 'center', fontSize: 13.5 }}>
          {stock.length === 0 ? 'Na skladě není nic k prodeji.' : 'Nic neodpovídá hledanému výrazu.'}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {sectioned.map((section) => (
            <BrewerySectionPanel
              key={section.name}
              section={section}
              color={breweryColor(section.id)}
              open={openSections[section.name] !== false}
              onToggle={() =>
                setOpenSections((prev) => ({ ...prev, [section.name]: prev[section.name] === false }))
              }
              qtyOf={qtyOf}
              formatMoney={formatMoney}
              onAdd={(row) => onAdd(row)}
              onChange={onChange}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
