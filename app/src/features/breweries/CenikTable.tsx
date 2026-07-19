import { useMemo } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, IconButton, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { kindLabel } from 'src/lib/labels';
import { KIND_ORDER } from 'src/lib/labels';
import { fmtLiters } from 'src/lib/format';
import { ProductKind, type BreweryProductListItemDto } from 'src/generated/api-client';

type P = BreweryProductListItemDto;

function kindName(k: P['kind']): string {
  return typeof k === 'number' ? (ProductKind[k] ?? '') : String(k ?? '');
}
function pkgKey(p: P): string {
  return `${kindName(p.kind)}|${p.packageSize ?? ''}`;
}
function pkgLabel(p: P): string {
  return [kindLabel(p.kind), fmtLiters(p.packageSize)].filter(Boolean).join(' ');
}

/** Pivot "kontingenční" ceník: one row per beer name, one column per package
 * (kind + size), so same-named products in different packages sit side by side. */
export function CenikTable({
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
  const { formatMoney } = useCurrency();

  const { columns, rows } = useMemo(() => {
    const colMap = new Map<string, { key: string; label: string; order: number; size: number }>();
    for (const p of products) {
      const key = pkgKey(p);
      if (!colMap.has(key)) {
        colMap.set(key, {
          key,
          label: pkgLabel(p),
          order: KIND_ORDER[kindName(p.kind)] ?? 99,
          size: p.packageSize ?? 0,
        });
      }
    }
    const columns = [...colMap.values()].sort((a, b) => a.order - b.order || a.size - b.size);

    const rowMap = new Map<string, { name: string; order: number; cells: Map<string, P> }>();
    for (const p of products) {
      const name = p.name ?? '—';
      if (!rowMap.has(name)) rowMap.set(name, { name, order: p.displayOrder ?? 999, cells: new Map() });
      rowMap.get(name)!.cells.set(pkgKey(p), p);
    }
    const rows = [...rowMap.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'cs'));
    return { columns, rows };
  }, [products]);

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 480 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pivo
            </TableCell>
            {columns.map((c) => (
              <TableCell key={c.key} align="right" sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} hover>
              <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
              {columns.map((c) => {
                const p = row.cells.get(c.key);
                if (!p) return <TableCell key={c.key} align="right" sx={{ color: 'text.disabled' }}>—</TableCell>;
                return (
                  <TableCell
                    key={c.key}
                    align="right"
                    onClick={editable ? () => onEdit(p) : undefined}
                    sx={{
                      cursor: editable ? 'pointer' : 'default',
                      '&:hover .cenik-del': { opacity: editable ? 1 : 0 },
                    }}
                  >
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(p.priceWithVat)}
                        </Typography>
                        {p.priceForUnitWithVat != null && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatMoney(p.priceForUnitWithVat)}/j.
                          </Typography>
                        )}
                      </Box>
                      {editable && (
                        <Tooltip title="Smazat produkt">
                          <IconButton
                            className="cenik-del"
                            size="small"
                            color="error"
                            sx={{ opacity: 0, transition: 'opacity .12s' }}
                            onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
