import { useMemo } from 'react';
import { Box, Stack, Typography, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { kindLabel, ptypeLabel, KIND_ORDER } from 'src/lib/labels';
import { fmtLiters } from 'src/lib/format';
import { ProductKind, type BreweryProductListItemDto } from 'src/generated/api-client';

type P = BreweryProductListItemDto;

function kindName(k: P['kind']): string {
  return typeof k === 'number' ? (ProductKind[k] ?? '') : String(k ?? '');
}
function pkgLabel(p: P): string {
  return [kindLabel(p.kind), fmtLiters(p.packageSize)].filter(Boolean).join(' ');
}
function pkgSortKey(p: P): number {
  return (KIND_ORDER[kindName(p.kind)] ?? 99) * 1000 + (p.packageSize ?? 0);
}

/** One package's price, as a compact tile. */
function PackageTile({
  p,
  editable,
  onEdit,
  onDelete,
}: {
  p: P;
  editable: boolean;
  onEdit: (p: P) => void;
  onDelete: (p: P) => void;
}) {
  const { formatMoney } = useCurrency();
  return (
    <Box
      onClick={editable ? () => onEdit(p) : undefined}
      sx={{
        position: 'relative',
        minWidth: 116,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: editable ? 'pointer' : 'default',
        transition: 'border-color .12s, background .12s',
        '&:hover': editable ? { borderColor: 'primary.main', bgcolor: (t) => t.palette.brand.amberSoft, '& .cenik-del': { opacity: 1 } } : undefined,
      }}
    >
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {pkgLabel(p)}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {formatMoney(p.priceWithVat)}
      </Typography>
      {p.priceForUnitWithVat != null && (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
          {formatMoney(p.priceForUnitWithVat)}/j.
        </Typography>
      )}
      {editable && (
        <Tooltip title="Smazat produkt">
          <IconButton
            className="cenik-del"
            size="small"
            color="error"
            onClick={(e) => { e.stopPropagation(); onDelete(p); }}
            sx={{ position: 'absolute', top: 2, right: 2, opacity: 0, transition: 'opacity .12s', bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}
          >
            <DeleteIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

/** Ceník grouped by beer name — each beer lists only its real packages as
 * price tiles. Scales to large, sparse catalogs (unlike a package-matrix pivot)
 * while still keeping same-named / multi-package beers together on one row. */
export function Cenik({
  products,
  editable,
  onEdit,
  onDelete,
}: {
  products: P[];
  editable: boolean;
  onEdit: (p: P) => void;
  onDelete: (p: P) => void;
}) {
  const beers = useMemo(() => {
    const byName = new Map<string, { name: string; type?: P['type']; order: number; items: P[] }>();
    for (const p of products) {
      const name = p.name ?? '—';
      if (!byName.has(name)) byName.set(name, { name, type: p.type, order: p.displayOrder ?? 999, items: [] });
      byName.get(name)!.items.push(p);
    }
    const list = [...byName.values()];
    list.forEach((b) => b.items.sort((a, c) => pkgSortKey(a) - pkgSortKey(c)));
    list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'cs'));
    return list;
  }, [products]);

  return (
    <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
      {beers.map((beer) => (
        <Stack
          key={beer.name}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ py: 1.75, alignItems: { sm: 'flex-start' } }}
        >
          <Box sx={{ minWidth: { sm: 200 }, flexShrink: 0, pt: { sm: 0.5 } }}>
            <Typography sx={{ fontWeight: 700 }}>{beer.name}</Typography>
            {ptypeLabel(beer.type) && (
              <Typography variant="caption" color="text.secondary">{ptypeLabel(beer.type)}</Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flex: 1 }}>
            {beer.items.map((p) => (
              <PackageTile key={p.id ?? pkgLabel(p)} p={p} editable={editable} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
