// Bulk catalog editor for a client's prices — the Ceník tab's second action
// (Task 10, prototype `clBulkPriceForm`). Setting prices one product at a
// time does not survive a real catalog (~230 products in production), so
// this drawer opens the whole catalog at once, grouped by brewery, with a
// percentage shortcut and per-row overrides.

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, Chip, TextField, InputAdornment, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Card,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHighOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { apiErrorMessage } from 'src/api/errors';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { useBreweryColors } from 'src/hooks/useBreweries';
import { useProducts } from 'src/hooks/useProducts';
import { useClientProductPrices, useReplaceClientProductPrices } from 'src/hooks/useClientProductPrices';
import { fmtLiters, plural } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import { type ProductListItemDto } from 'src/generated/api-client';
import { fillFromPercent, rowState, toReplacePayload, type BulkPriceProduct } from './bulkClientPricesModel';

/** A catalog product with the fields the editor actually needs guaranteed
 * present — the generated DTO marks both optional. */
type CatalogEntry = ProductListItemDto & { id: string; priceWithVat: number };

function isCatalogEntry(product: ProductListItemDto): product is CatalogEntry {
  return product.id != null && product.priceWithVat != null;
}

/** Aggregate outcome for the post-save snackbar, mirroring the prototype's
 * `clBulkSave` message ("12 upraveno, 4 nové, 2 vráceny na ceník"). */
function buildSaveSummary(
  products: BulkPriceProduct[],
  draft: Record<string, string>,
  currentByProduct: Map<string, number>,
): string {
  let updated = 0;
  let created = 0;
  let removed = 0;
  let skipped = 0;

  for (const product of products) {
    const raw = draft[product.id];
    const current = currentByProduct.get(product.id);
    if (raw == null || raw.trim() === '') {
      if (current != null) {
        removed += 1;
      }
      continue;
    }
    const price = parseFloat(raw);
    if (!Number.isFinite(price) || price <= 0) {
      skipped += 1;
      continue;
    }
    if (current != null) {
      if (price !== current) {
        updated += 1;
      }
    } else {
      created += 1;
    }
  }

  const parts: string[] = [];
  if (updated) parts.push(`${updated} upraveno`);
  if (created) parts.push(`${created} ${plural(created, 'nová', 'nové', 'nových')}`);
  if (removed) parts.push(`${removed} ${plural(removed, 'vrácena', 'vráceny', 'vráceno')} na ceník`);
  if (skipped) parts.push(`${skipped} přeskočeno`);
  return parts.length ? parts.join(', ') : 'Beze změn.';
}

function CatalogRow({
  product, draftValue, currentPrice, onChange,
}: {
  product: CatalogEntry;
  draftValue: string;
  currentPrice: number | undefined;
  onChange: (value: string) => void;
}) {
  const { formatMoney } = useCurrency();
  const marks = rowState(product, draftValue, currentPrice);

  return (
    <TableRow hover>
      <TableCell>
        <Typography sx={{ fontWeight: 700 }}>{product.name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
          <Chip size="small" label={kindLabel(product.kind)} sx={{ height: 20, fontSize: 11 }} />
          {product.packageSize != null && (
            <Chip size="small" label={fmtLiters(product.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
          )}
          {marks.isNew && (
            <Chip
              size="small"
              label="nová"
              sx={{ height: 20, fontSize: 11, fontWeight: 700, color: (t) => t.vars!.palette.brand.amberStrong }}
            />
          )}
          {marks.raisesPrice && (
            <Chip
              size="small"
              icon={<WarningAmberIcon sx={{ fontSize: 13 }} />}
              label="vyšší než dnes"
              sx={{ height: 20, fontSize: 11, fontWeight: 700, color: (t) => t.vars!.palette.brand.amberStrong }}
            />
          )}
          {marks.revertsToList && (
            <Chip size="small" label="vrátí se na ceník" sx={{ height: 20, fontSize: 11, fontWeight: 700, color: 'error.main' }} />
          )}
        </Stack>
      </TableCell>
      <TableCell align="right">
        <Typography color="text.secondary">{formatMoney(product.priceWithVat)}</Typography>
      </TableCell>
      <TableCell align="right">
        {currentPrice != null ? formatMoney(currentPrice) : <Typography color="text.secondary">—</Typography>}
      </TableCell>
      <TableCell align="right">
        <TextField
          type="number"
          size="small"
          value={draftValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ceník"
          slotProps={{ htmlInput: { style: { textAlign: 'right' } } }}
          sx={{ width: 110 }}
        />
      </TableCell>
    </TableRow>
  );
}

function CatalogSection({
  breweryName, color, products, draft, currentByProduct, onChange,
}: {
  breweryName: string;
  color: string | undefined;
  products: CatalogEntry[];
  draft: Record<string, string>;
  currentByProduct: Map<string, number>;
  onChange: (productId: string, value: string) => void;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700 }}>{breweryName}</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>
          {products.length} {plural(products.length, 'produkt', 'produkty', 'produktů')}
        </Typography>
      </Stack>
      <Card variant="outlined">
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Produkt</TableCell>
                <TableCell align="right">Ceník</TableCell>
                <TableCell align="right">Klient teď</TableCell>
                <TableCell align="right">Nově</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <CatalogRow
                  key={product.id}
                  product={product}
                  draftValue={draft[product.id] ?? ''}
                  currentPrice={currentByProduct.get(product.id)}
                  onChange={(value) => onChange(product.id, value)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

/** Bulk price editor over the whole product catalog for one client. Draft
 * values live in React state keyed by product id — never read from the DOM —
 * so filtering by search re-renders the visible rows without discarding
 * anything typed into a row that search then hides. */
export function BulkClientPricesDrawer({
  open, clientId, clientName, onClose,
}: {
  open: boolean;
  clientId: string;
  clientName?: string;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const colorForBrewery = useBreweryColors();
  const productsQuery = useProducts();
  const pricesQuery = useClientProductPrices(clientId);
  const replace = useReplaceClientProductPrices();

  const [pct, setPct] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Re-seeds whenever the drawer opens or the client's saved prices refresh —
  // not on every keystroke, since `pricesQuery.data` only changes on an
  // actual (re)fetch.
  useEffect(() => {
    if (!open) return;
    const seed: Record<string, string> = {};
    for (const price of pricesQuery.data ?? []) {
      if (price.productId && price.priceWithVat != null) {
        seed[price.productId] = String(price.priceWithVat);
      }
    }
    setDraft(seed);
    setPct('');
    setSearch('');
  }, [open, pricesQuery.data]);

  const catalogProducts = useMemo(
    () => (productsQuery.data ?? []).filter(isCatalogEntry),
    [productsQuery.data],
  );

  const currentByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const price of pricesQuery.data ?? []) {
      if (price.productId && price.priceWithVat != null) {
        map.set(price.productId, price.priceWithVat);
      }
    }
    return map;
  }, [pricesQuery.data]);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const byBrewery = new Map<string, CatalogEntry[]>();
    for (const product of catalogProducts) {
      if (query && !(product.name ?? '').toLowerCase().includes(query)) {
        continue;
      }
      const key = product.breweryId ?? '';
      if (!byBrewery.has(key)) byBrewery.set(key, []);
      byBrewery.get(key)!.push(product);
    }
    return [...byBrewery.entries()].sort(
      (a, b) => (a[1][0]?.breweryName ?? '').localeCompare(b[1][0]?.breweryName ?? ''),
    );
  }, [catalogProducts, search]);

  const setDraftValue = (productId: string, value: string) => {
    setDraft((prev) => {
      if (value.trim() === '') {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: value };
    });
  };

  const applyPercent = () => {
    const parsed = parseFloat(pct);
    if (!Number.isFinite(parsed)) {
      enqueueSnackbar('Zadejte procenta', { variant: 'warning' });
      return;
    }
    setDraft(fillFromPercent(catalogProducts, parsed));
    enqueueSnackbar('Náhled přepočítán.', { variant: 'info' });
  };

  const clearAll = () => {
    setDraft({});
    enqueueSnackbar('Všechny ceny vyprázdněny.', { variant: 'info' });
  };

  const savedCount = useMemo(() => toReplacePayload(draft).length, [draft]);

  const save = async () => {
    try {
      await replace.mutateAsync({ clientId, data: toReplacePayload(draft) });
      enqueueSnackbar(buildSaveSummary(catalogProducts, draft, currentByProduct), { variant: 'success' });
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const isPending = productsQuery.isLoading || pricesQuery.isLoading;
  const isError = productsQuery.isError || pricesQuery.isError;

  return (
    <FormDrawer
      open={open}
      title="Hromadná úprava cen"
      subtitle={clientName}
      onClose={onClose}
      onSubmit={save}
      busy={replace.isPending}
      submitDisabled={isPending || isError}
      submitLabel="Uložit ceny"
      width={900}
    >
      {isError ? (
        <Alert severity="error">
          {apiErrorMessage(productsQuery.error ?? pricesQuery.error, 'Katalog produktů se nepodařilo načíst.')}
        </Alert>
      ) : isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Alert severity="warning" icon={<InfoOutlinedIcon />}>
            Procenta se počítají z ceníkové ceny, takže dvojí přepočet dá stejný výsledek. Ceny můžete i přepsat
            po jednom. Prázdné pole znamená, že klient platí ceník — vymazáním existující ceny ji při uložení
            odeberete.
          </Alert>

          <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap" useFlexGap>
            <TextField
              label="Změna proti ceníku (%)"
              type="number"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="např. −5 pro slevu, 3 pro zdražení"
              helperText="Vyplní sloupec Nově u všech produktů v katalogu."
              sx={{ flex: 1, minWidth: 240 }}
            />
            <TextField
              label="Hledat produkt"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat v katalogu…"
              helperText="Filtruje jen zobrazení, zadané ceny zůstávají."
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="disabled" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1, minWidth: 240 }}
            />
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" startIcon={<AutoFixHighIcon />} onClick={applyPercent}>
              Přepočítat náhled
            </Button>
            <Button variant="text" size="small" startIcon={<DeleteOutlineIcon />} onClick={clearAll}>
              Vyprázdnit vše
            </Button>
            <Typography variant="body2" color="text.secondary">
              {savedCount
                ? `${savedCount} ${plural(savedCount, 'vlastní cena', 'vlastní ceny', 'vlastních cen')} k uložení`
                : 'Žádné vlastní ceny — klient platí ceník'}
            </Typography>
          </Stack>

          {groups.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Nic neodpovídá hledanému výrazu.
            </Typography>
          ) : (
            groups.map(([breweryId, products]) => (
              <CatalogSection
                key={breweryId}
                breweryName={products[0]?.breweryName ?? ''}
                color={colorForBrewery(breweryId)}
                products={products}
                draft={draft}
                currentByProduct={currentByProduct}
                onChange={setDraftValue}
              />
            ))
          )}
        </>
      )}
    </FormDrawer>
  );
}
