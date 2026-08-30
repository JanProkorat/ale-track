// The "Další zboží" catalog: suppliers' price lists, browsable.
//
// Moved out of OrderEditor so the recording drawer can use the same control rather than an
// imitation of it — the same reason ProductCatalog holds the brewery panels. The editor keeps its
// own search box (it is shared with the other two tabs); the drawer takes
// {@link SupplierGoodCatalogBrowser}, which brings its own.

import { useMemo, useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PropaneOutlinedIcon from '@mui/icons-material/PropaneOutlined';
import { EmptyState } from 'src/components/common/EmptyState';
import { SearchField } from 'src/components/common/SearchField';
import { chargeKindLabel } from 'src/lib/labels';
import { type SupplierDto, type SupplierGoodDto } from 'src/generated/api-client';
import { QtyControl } from './ProductCatalog';
import { groupSupplierGoods, primaryPrice } from './supplierGoodCatalogModel';

/** One row of the tab — a good off a supplier's price list. Priced by
 *  {@link primaryPrice}, with no client-price override: a supplier charges every
 *  client the same, so there is no ceník to strike through. */
export function SupplierGoodRow({
  good, supplierName, qty, formatMoney, onAdd, onChange,
}: {
  good: SupplierGoodDto;
  supplierName: string;
  qty: number;
  formatMoney: (czk: number) => string;
  onAdd: () => void;
  onChange: (delta: number) => void;
}) {
  const price = primaryPrice(good);
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, border: 1, borderRadius: 2,
      borderColor: qty > 0 ? 'warning.main' : 'divider',
      bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent'),
    }}
    >
      <PropaneOutlinedIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{good.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          {good.size && <Chip size="small" label={good.size} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />}
          <Chip size="small" label={supplierName} sx={{ height: 20, fontSize: 11 }} />
          {price?.kind != null && (
            <Chip size="small" label={chargeKindLabel(price.kind)} sx={{ height: 20, fontSize: 11 }} />
          )}
          {price ? (
            <Typography sx={{ fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(price.price)}</Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">bez ceny</Typography>
          )}
        </Stack>
      </Box>
      <QtyControl qty={qty} onAdd={onAdd} onChange={onChange} />
    </Box>
  );
}

/** A supplier and its goods, collapsible — the "Další zboží" counterpart of
 *  `BreweryGroupPanel`, and deliberately the same shape so the two browse
 *  tabs read as one control. */
export function SupplierGoodPanel({
  supplierName, goods, open, onToggle, qtyOf, formatMoney, onAdd, onChange,
}: {
  supplierName: string;
  goods: SupplierGoodDto[];
  open: boolean;
  onToggle: () => void;
  qtyOf: (goodId: string) => number;
  formatMoney: (czk: number) => string;
  onAdd: (goodId: string) => void;
  onChange: (goodId: string, delta: number) => void;
}) {
  return (
    <Box sx={{ mb: 1.25, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, width: '100%', textAlign: 'left',
          bgcolor: 'action.hover', border: 0, borderBottom: open ? 1 : 0, borderColor: 'divider',
          px: 1.5, py: 1.25, font: 'inherit', cursor: 'pointer', color: 'text.primary',
        }}
      >
        <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
        <LocalShippingOutlinedIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{supplierName}</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 600, fontSize: 12.5 }}>{goods.length}</Typography>
        <Box sx={{ flex: 1 }} />
      </Box>
      {open && (
        <Box sx={{ p: 1.5, bgcolor: 'background.default' }}>
          <Stack spacing={1.1}>
            {goods.map((g) => (
              <SupplierGoodRow
                key={g.id}
                good={g}
                supplierName={supplierName}
                qty={qtyOf(g.id ?? '')}
                formatMoney={formatMoney}
                onAdd={() => onAdd(g.id ?? '')}
                onChange={(d) => onChange(g.id ?? '', d)}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

/**
 * The whole tab as one control: search, panels, empty state.
 *
 * The mirror of `ProductCatalogBrowser`, for the screens that have no search box of their own.
 */
export function SupplierGoodCatalogBrowser({
  suppliers,
  quantities,
  formatMoney,
  onAdd,
  onChange,
  exclude,
  panelsOpenByDefault = true,
  emptyTitle = 'Žádné zboží dodavatelů',
}: {
  suppliers: SupplierDto[];
  quantities: Map<string, number>;
  formatMoney: (czk: number) => string;
  onAdd: (goodId: string) => void;
  onChange: (goodId: string, delta: number) => void;
  /** Goods the screen already has a row for, so the catalog does not offer them twice. */
  exclude?: ReadonlySet<string | undefined>;
  /** False in a drawer, where an expanded catalog would bury everything under it. */
  panelsOpenByDefault?: boolean;
  emptyTitle?: string;
}) {
  const [query, setQuery] = useState('');
  const [openById, setOpenById] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => groupSupplierGoods(suppliers, query)
      .map((g) => ({ ...g, goods: g.goods.filter((good) => !exclude?.has(good.id)) }))
      .filter((g) => g.goods.length > 0),
    [suppliers, query, exclude],
  );

  return (
    <Stack spacing={1.25}>
      <SearchField value={query} onChange={setQuery} placeholder="Hledat zboží nebo dodavatele…" width="100%" />

      {groups.length === 0 ? (
        <EmptyState
          icon={<LocalShippingOutlinedIcon />}
          title={query.trim() ? 'Nic nenalezeno' : emptyTitle}
          description={query.trim() ? 'Zkuste jiné hledání.' : undefined}
          dense
        />
      ) : (
        <Box>
          {groups.map((g) => (
            <SupplierGoodPanel
              key={g.supplierId}
              supplierName={g.supplierName}
              goods={g.goods}
              open={openById[g.supplierId] ?? panelsOpenByDefault}
              onToggle={() => setOpenById((prev) => ({
                ...prev,
                [g.supplierId]: !(prev[g.supplierId] ?? panelsOpenByDefault),
              }))}
              qtyOf={(goodId) => quantities.get(goodId) ?? 0}
              formatMoney={formatMoney}
              onAdd={onAdd}
              onChange={onChange}
            />
          ))}
        </Box>
      )}
    </Stack>
  );
}
