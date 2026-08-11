import { useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Card,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { kindLabel, packSizeLabel, ptypeLabel, KIND_ORDER } from 'src/lib/labels';
import { plural } from 'src/lib/format';
import { ProductKind, type BreweryProductListItemDto } from 'src/generated/api-client';
import { BulkPriceDrawer } from './BulkPriceDrawer';
import { PriceListImportDrawer } from './PriceListImportDrawer';

type P = BreweryProductListItemDto;

function kindName(k: P['kind']): string {
  return typeof k === 'number' ? (ProductKind[k] ?? '') : String(k ?? '');
}
/** Package price without VAT, derived from the with/without-VAT unit ratio
 * (our DTO has no package-level net price); falls back to a 21% VAT estimate. */
function pkgWithoutVat(p: P): number | undefined {
  if (p.priceWithVat == null) return undefined;
  if (p.priceForUnitWithVat && p.priceForUnitWithoutVat) {
    return p.priceWithVat * (p.priceForUnitWithoutVat / p.priceForUnitWithVat);
  }
  return p.priceWithVat / 1.21;
}

function PriceCell({ p, editable, onEdit }: { p: P | undefined; editable: boolean; onEdit: (p: P) => void }) {
  const { formatMoney } = useCurrency();
  if (!p) return <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>;
  return (
    <TableCell
      align="right"
      onClick={editable ? () => onEdit(p) : undefined}
      sx={{
        cursor: editable ? 'pointer' : 'default',
        '&:hover': editable ? { bgcolor: (t) => t.vars!.palette.brand.amberSoft, boxShadow: (t) => `inset 0 0 0 1px ${t.vars!.palette.brand.amberTint}` } : undefined,
      }}
    >
      <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {formatMoney(p.priceWithVat)}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
        {formatMoney(pkgWithoutVat(p))} bez DPH
      </Typography>
    </TableCell>
  );
}

/** One column of a kind section: a container volume together with how many of them a unit holds. */
type PackColumn = { volume: number | undefined; units: number };

function packUnits(p: P): number {
  return p.unitsPerPackage != null && p.unitsPerPackage > 0 ? p.unitsPerPackage : 1;
}

function packKey(volume: number | undefined, units: number): string {
  return `${volume ?? ''}|${units}`;
}

function KindSection({ kind, items, editable, onEdit }: { kind: string; items: P[]; editable: boolean; onEdit: (p: P) => void }) {
  // Columns = the sellable units present in THIS kind (bounded, never the global set).
  //
  // Keyed on the pack, not on the container volume alone: Svijany sells 0,5 l cans as a tray of 24
  // and, for the nealko range, as a tray of 12. Under one "0,5 l" column their package prices would
  // sit side by side as if they were the same quantity of beer.
  const columns: PackColumn[] = [...new Map(
    items.map((p) => [packKey(p.packageSize, packUnits(p)), { volume: p.packageSize, units: packUnits(p) }]),
  ).values()].sort((a, b) => {
    if (a.volume == null) return 1;
    if (b.volume == null) return -1;
    return a.volume - b.volume || a.units - b.units;
  });
  // Rows = product families (by name); a family may span several sizes.
  const families = new Map<string, P[]>();
  const order: string[] = [];
  for (const p of items) {
    const name = p.name ?? '—';
    if (!families.has(name)) { families.set(name, []); order.push(name); }
    families.get(name)!.push(p);
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Chip
          size="small"
          icon={<Inventory2Icon />}
          label={kindLabel(kind) ?? kind}
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}
        />
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {order.length} {plural(order.length, 'produkt', 'produkty', 'produktů')}
          {items.length > order.length ? ` · ${items.length} variant` : ''}
        </Typography>
      </Stack>
      <Card variant="outlined">
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Produkt</TableCell>
                {columns.map((c) => (
                  <TableCell key={packKey(c.volume, c.units)} align="right" sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {packSizeLabel(c.volume, c.units) ?? 'Cena'}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {order.map((name) => {
                const variants = families.get(name)!;
                const f = variants[0];
                return (
                  <TableRow key={name} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 0.25 }}>
                        {ptypeLabel(f.type) && (
                          <Chip size="small" label={ptypeLabel(f.type)} sx={{ height: 20, fontSize: 11 }} />
                        )}
                        {f.platoDegree != null && (
                          <Typography variant="caption" color="text.secondary">{f.platoDegree}°</Typography>
                        )}
                        {f.alcoholPercentage != null && (
                          <Typography variant="caption" color="text.secondary">· {f.alcoholPercentage}%</Typography>
                        )}
                        {variants.length > 1 && (
                          <Chip
                            size="small"
                            label={`${variants.length} ${plural(variants.length, 'velikost', 'velikosti', 'velikostí')}`}
                            sx={{ height: 20, fontSize: 11, fontWeight: 700, color: 'primary.dark', bgcolor: (t) => t.vars!.palette.brand.amberTint }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    {columns.map((c) => (
                      <PriceCell
                        key={packKey(c.volume, c.units)}
                        p={variants.find((v) => v.packageSize === c.volume && packUnits(v) === c.units)}
                        editable={editable}
                        onEdit={onEdit}
                      />
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

/** Ceník: products grouped by kind, pivoted by the sizes within each kind. */
export function Cenik({
  products,
  editable,
  breweryId,
  onAdd,
  onEdit,
}: {
  products: P[];
  editable: boolean;
  breweryId: string;
  onAdd: () => void;
  onEdit: (p: P) => void;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const sections = useMemo(() => {
    const groups = new Map<string, P[]>();
    for (const p of products) {
      const k = kindName(p.kind) || 'Other';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    return [...groups.entries()].sort(
      (a, b) => (KIND_ORDER[a[0]] ?? 99) - (KIND_ORDER[b[0]] ?? 99)
    );
  }, [products]);

  return (
    <Box>
      {editable && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Button
            startIcon={<WalletIcon />}
            onClick={() => setBulkOpen(true)}
            sx={{ bgcolor: (t) => t.vars!.palette.brand.amberSoft, color: 'primary.dark', '&:hover': { bgcolor: (t) => t.vars!.palette.brand.amberTint } }}
          >
            Hromadná úprava cen
          </Button>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)} sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}>
            Import ceníku
          </Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={onAdd} sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}>
            Přidat produkt
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            Sloupce = velikosti balení · klikni na cenu pro úpravu
          </Typography>
        </Stack>
      )}

      {sections.map(([kind, items]) => (
        <KindSection key={kind} kind={kind} items={items} editable={editable} onEdit={onEdit} />
      ))}

      <BulkPriceDrawer open={bulkOpen} breweryId={breweryId} products={products} onClose={() => setBulkOpen(false)} />
      <PriceListImportDrawer open={importOpen} breweryId={breweryId} onClose={() => setImportOpen(false)} />
    </Box>
  );
}
