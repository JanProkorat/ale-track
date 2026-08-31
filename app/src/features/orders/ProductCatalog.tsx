// The product catalog, as the order editor draws it: brewery panels holding one card per product
// name, a row per package size, each with its price and a quantity control.
//
// Extracted from OrderEditor so the recording drawer can offer the same catalog rather than an
// approximation of it — a dropdown listing the whole catalog was the thing nobody could use. The
// components know nothing about orders: a caller passes the quantity each product currently has
// and two callbacks, which is as true of a cart as it is of the products a client took at the door.

import { useState } from 'react';
import {
  Box, Button, Chip, Collapse, IconButton, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import RemoveIcon from '@mui/icons-material/RemoveOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { PriceWithList } from 'src/components/common/PriceWithList';
import { SearchField } from 'src/components/common/SearchField';
import { EmptyState } from 'src/components/common/EmptyState';
import { plural, fmtLiters } from 'src/lib/format';
import { kindLabel, packSizeLabel } from 'src/lib/labels';
import type { BreweryGroupDto, ProductListItemDto } from 'src/generated/api-client';
import {
  KIND_TABS, breweryPanels, countsByKind, groupByName, matchesQuery,
  type KindTab, type NameGroup,
} from './orderCatalogModel';

/** Says out loud what the struck-through ceník price beside it only implies —
 *  ports the prototype's `specialPriceTag`. */
export function ClientPriceChip() {
  return (
    <Chip
      size="small"
      icon={<WalletIcon sx={{ fontSize: '13px !important' }} />}
      label="vlastní cena"
      sx={{
        height: 20,
        fontSize: 11,
        fontWeight: 700,
        color: (t) => t.vars!.palette.brand.amberStrong,
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  );
}

export function QtyControl({ qty, onAdd, onChange }: { qty: number; onAdd: () => void; onChange: (delta: number) => void }) {
  if (qty <= 0) {
    return (
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon fontSize="small" />}
        onClick={onAdd}
        sx={{ flexShrink: 0, color: 'text.primary', borderColor: 'divider', fontWeight: 700, bgcolor: 'background.paper' }}
      >
        Přidat
      </Button>
    );
  }
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
      <IconButton size="small" onClick={() => onChange(-1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 30, height: 30 }} aria-label="Ubrat">
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{qty}</Typography>
      <IconButton size="small" onClick={() => onChange(1)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, width: 30, height: 30 }} aria-label="Přidat">
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

export function ProductRow({
  product, qty, historyBadge, color, onAdd, onChange,
}: {
  product: ProductListItemDto;
  qty: number;
  historyBadge: boolean;
  color?: string;
  onAdd: () => void;
  onChange: (delta: number) => void;
}) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, border: 1, borderRadius: 2,
      borderColor: qty > 0 ? 'warning.main' : 'divider',
      bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent'),
    }}
    >
      <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{product.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          <Chip size="small" label={kindLabel(product.kind)} sx={{ height: 20, fontSize: 11 }} />
          {product.packageSize != null && <Chip size="small" label={packSizeLabel(product.packageSize, product.unitsPerPackage)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />}
          <PriceWithList price={product.priceWithVat} listPrice={product.listPriceWithVat} />
          {product.listPriceWithVat != null && <ClientPriceChip />}
          {historyBadge && <Typography sx={{ fontSize: 11, color: 'info.main', fontWeight: 700 }}>dříve objednáno</Typography>}
        </Stack>
      </Box>
      <QtyControl qty={qty} onAdd={onAdd} onChange={onChange} />
    </Box>
  );
}

export function VariantCard({
  group, historyBadge, color, quantities, onAdd, onChange,
}: {
  group: NameGroup;
  historyBadge: boolean;
  color?: string;
  quantities: Map<string, number>;
  onAdd: (productId: string) => void;
  onChange: (productId: string, delta: number) => void;
}) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.1, bgcolor: 'action.hover' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{group.name}</Typography>
        {historyBadge && <Typography sx={{ fontSize: 11, color: 'info.main', fontWeight: 700 }}>dříve objednáno</Typography>}
        <Box sx={{ flex: 1 }} />
        <Chip size="small" label={`${group.items.length} ${plural(group.items.length, 'velikost', 'velikosti', 'velikostí')}`} sx={{ height: 20, fontSize: 11 }} />
      </Stack>
      <Stack>
        {group.items.map((v) => {
          const qty = quantities.get(v.id ?? '') ?? 0;
          return (
            <Stack
              key={v.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: (t) => (qty > 0 ? t.vars!.palette.brand.amberTint : 'transparent') }}
            >
              <Chip size="small" label={kindLabel(v.kind)} sx={{ height: 20, fontSize: 11 }} />
              <Chip size="small" label={packSizeLabel(v.packageSize, v.unitsPerPackage) ?? fmtLiters(v.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
              <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>{v.description ?? ''}</Typography>
              {v.listPriceWithVat != null && <ClientPriceChip />}
              <PriceWithList price={v.priceWithVat} listPrice={v.listPriceWithVat} />
              <QtyControl qty={qty} onAdd={() => onAdd(v.id ?? '')} onChange={(d) => onChange(v.id ?? '', d)} />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

export function CatalogGroupList({
  products, historyBadge, quantities, colorForBrewery, onAdd, onChange,
}: {
  products: ProductListItemDto[];
  historyBadge: boolean;
  quantities: Map<string, number>;
  colorForBrewery: (breweryId?: string) => string | undefined;
  onAdd: (productId: string) => void;
  onChange: (productId: string, delta: number) => void;
}) {
  const groups = groupByName(products);
  return (
    <Stack spacing={1.1}>
      {groups.map((g) => (g.items.length > 1 ? (
        <VariantCard
          key={g.name}
          group={g}
          historyBadge={historyBadge}
          color={colorForBrewery(g.items[0].breweryId)}
          quantities={quantities}
          onAdd={onAdd}
          onChange={onChange}
        />
      ) : (
        <ProductRow
          key={g.items[0].id}
          product={g.items[0]}
          qty={quantities.get(g.items[0].id ?? '') ?? 0}
          historyBadge={historyBadge}
          color={colorForBrewery(g.items[0].breweryId)}
          onAdd={() => onAdd(g.items[0].id ?? '')}
          onChange={(d) => onChange(g.items[0].id ?? '', d)}
        />
      )))}
    </Stack>
  );
}

/**
 * How long a brewery takes to open, shared by the panel and its chevron so the two move as one
 * gesture. Short on purpose: browsing a catalog means opening and closing several in a row, and
 * MUI's default 300ms reads as sluggish when you are hunting for a product.
 */
const PANEL_MS = 180;

export function BreweryGroupPanel({
  brewery, products, color, open, onToggle, quantities, onAdd, onChange,
}: {
  brewery: BreweryGroupDto;
  products: ProductListItemDto[];
  color?: string;
  open: boolean;
  onToggle: () => void;
  quantities: Map<string, number>;
  onAdd: (productId: string) => void;
  onChange: (productId: string, delta: number) => void;
}) {
  return (
    // The whole brewery — header + its products — is one bordered card, so the
    // products clearly live *inside* the brewery rather than beside it.
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
        <ChevronRightIcon
          fontSize="small"
          sx={{
            color: 'text.disabled', flexShrink: 0,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: `transform ${PANEL_MS}ms`,
          }}
        />
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{brewery.breweryName}</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 600, fontSize: 12.5 }}>{products.length}</Typography>
        <Box sx={{ flex: 1 }} />
      </Box>
      {/* Unmounted while closed, not merely hidden: a drawer full of collapsed breweries would
          otherwise mount the whole catalog, and a closed panel's rows would answer a search. */}
      <Collapse in={open} timeout={PANEL_MS} unmountOnExit>
        <Box sx={{ p: 1.5, bgcolor: 'background.default' }}>
          <CatalogGroupList
            products={products}
            historyBadge={false}
            quantities={quantities}
            colorForBrewery={() => color}
            onAdd={onAdd}
            onChange={onChange}
          />
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * The whole browse experience: search, the kind filter, and a collapsible panel per brewery.
 *
 * Owns its own query, filter and open panels, because the two callers want none of that in their
 * own state. `exclude` is what already has a row elsewhere on the caller's form — a product on the
 * order is recorded against its own line, so offering it here as well would write a second entry
 * for one product.
 */
export function ProductCatalogBrowser({
  breweries,
  quantities,
  onAdd,
  onChange,
  exclude,
  colorForBrewery,
  panelsOpenByDefault = true,
  emptyTitle = 'Žádné produkty v této kategorii',
}: {
  breweries: BreweryGroupDto[];
  quantities: Map<string, number>;
  onAdd: (productId: string) => void;
  onChange: (productId: string, delta: number) => void;
  exclude?: ReadonlySet<string | undefined>;
  colorForBrewery?: (breweryId?: string) => string | undefined;
  /** False in a drawer, where an expanded catalog would bury everything under it. */
  panelsOpenByDefault?: boolean;
  emptyTitle?: string;
}) {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindTab | 'all'>('all');
  const [openById, setOpenById] = useState<Record<string, boolean>>({});

  const matches = (product: ProductListItemDto) =>
    matchesQuery(product, query) && !exclude?.has(product.id);

  const panels = breweryPanels(breweries, kindFilter, matches);
  const counts = countsByKind(breweries, matches);

  return (
    <Stack spacing={1.25}>
      <SearchField value={query} onChange={setQuery} placeholder="Hledat produkt…" width="100%" />

      <ToggleButtonGroup
        exclusive
        size="small"
        value={kindFilter}
        onChange={(_e, v: KindTab | 'all' | null) => v !== null && setKindFilter(v)}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          '& .MuiToggleButtonGroup-grouped': { flex: '1 1 0', minWidth: 'max-content' },
        }}
      >
        <ToggleButton value="all" sx={{ textTransform: 'none', fontWeight: 700 }}>Vše</ToggleButton>
        {KIND_TABS.map((k) => (
          <ToggleButton key={k} value={k} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {kindLabel(k)}
            <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>{counts.get(k) ?? 0}</Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {panels.length === 0 ? (
        <EmptyState title={emptyTitle} dense />
      ) : panels.map(({ brewery, items }) => {
        const id = brewery.breweryId ?? '';
        return (
          <BreweryGroupPanel
            key={id}
            brewery={brewery}
            products={items}
            color={colorForBrewery?.(brewery.breweryId)}
            open={openById[id] ?? panelsOpenByDefault}
            onToggle={() => setOpenById((prev) => ({ ...prev, [id]: !(prev[id] ?? panelsOpenByDefault) }))}
            quantities={quantities}
            onAdd={onAdd}
            onChange={onChange}
          />
        );
      })}
    </Stack>
  );
}
