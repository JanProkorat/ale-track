// Ceník tab of the client detail: the client's own product-price overrides,
// grouped by brewery — ports the prototype's `clCenikView`/`clPriceForm`/
// `clPriceDelete`/`clBulkPriceForm`.

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, Chip, IconButton, Tooltip, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Card,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { ProductCombobox } from 'src/components/common/ProductCombobox';
import { StatusPill } from 'src/components/common/StatusPill';
import { apiErrorMessage } from 'src/api/errors';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { useBreweryColors } from 'src/hooks/useBreweries';
import { useProducts } from 'src/hooks/useProducts';
import { fmtLiters, plural } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import { SaveClientProductPriceDto, type ClientProductPriceDto } from 'src/generated/api-client';
import {
  useClientProductPrices,
  useSaveClientProductPrice,
  useDeleteClientProductPrice,
} from 'src/hooks/useClientProductPrices';
import { BulkClientPricesDrawer } from './BulkClientPricesDrawer';

/** A struck-through client price says a price is special but not by how much —
 * the pill in the Rozdíl column is the amount someone is actually checking.
 * Exported so the three outcomes (lower/higher/equal) are covered as pure
 * logic rather than only through a rendered row. */
export type PriceDiff = { amount: number; direction: 'lower' | 'higher' | 'equal' };

export function computePriceDiff(clientPrice: number, listPrice: number): PriceDiff {
  const amount = clientPrice - listPrice;
  if (amount === 0) return { amount: 0, direction: 'equal' };
  return { amount: Math.abs(amount), direction: amount < 0 ? 'lower' : 'higher' };
}

function DiffCell({ clientPrice, listPrice }: { clientPrice: number; listPrice: number }) {
  const { formatMoney } = useCurrency();
  const diff = computePriceDiff(clientPrice, listPrice);
  if (diff.direction === 'equal') {
    return <Typography color="text.secondary" sx={{ fontSize: 13 }}>shodná s ceníkem</Typography>;
  }
  return (
    <StatusPill
      tone={diff.direction === 'lower' ? 'ok' : 'amber'}
      label={`o ${formatMoney(diff.amount)} ${diff.direction === 'lower' ? 'nižší' : 'vyšší'}`}
    />
  );
}

function PriceRow({
  price, editable, onEdit, onDelete,
}: {
  price: ClientProductPriceDto;
  editable: boolean;
  onEdit: (price: ClientProductPriceDto) => void;
  onDelete: (price: ClientProductPriceDto) => void;
}) {
  const { formatMoney } = useCurrency();
  const clientPrice = price.priceWithVat ?? 0;
  const listPrice = price.listPriceWithVat ?? 0;
  return (
    <TableRow hover>
      <TableCell>
        <Typography sx={{ fontWeight: 700 }}>{price.productName}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 0.25 }}>
          <Chip size="small" label={kindLabel(price.kind)} sx={{ height: 20, fontSize: 11 }} />
          {price.packageSize != null && (
            <Chip size="small" label={fmtLiters(price.packageSize)} sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
          )}
        </Stack>
      </TableCell>
      <TableCell align="right">
        <Typography sx={{ fontWeight: 800, color: (t) => t.vars!.palette.brand.amberStrong }}>
          {formatMoney(clientPrice)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography color="text.secondary">{formatMoney(listPrice)}</Typography>
      </TableCell>
      <TableCell align="right">
        <DiffCell clientPrice={clientPrice} listPrice={listPrice} />
      </TableCell>
      {editable && (
        <TableCell align="right">
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Tooltip title="Upravit cenu">
              <IconButton size="small" onClick={() => onEdit(price)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Vrátit na ceník">
              <IconButton size="small" onClick={() => onDelete(price)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, color: 'error.main' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      )}
    </TableRow>
  );
}

function BrewerySection({
  breweryName, color, rows, editable, onEdit, onDelete,
}: {
  breweryName: string;
  color: string | undefined;
  rows: ClientProductPriceDto[];
  editable: boolean;
  onEdit: (price: ClientProductPriceDto) => void;
  onDelete: (price: ClientProductPriceDto) => void;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color ?? 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700 }}>{breweryName}</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>
          {rows.length} {plural(rows.length, 'cena', 'ceny', 'cen')}
        </Typography>
      </Stack>
      <Card variant="outlined">
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Produkt</TableCell>
                <TableCell align="right">Cena klienta</TableCell>
                <TableCell align="right">Ceník</TableCell>
                <TableCell align="right">Rozdíl</TableCell>
                {editable && <TableCell align="right" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((p) => (
                <PriceRow key={p.productId} price={p} editable={editable} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

/** Takes the loaded rows as a plain prop, per the "hooks must not run on data
 * that may be missing" rule — the grouping `useMemo` below never runs before
 * the query has resolved, since QueryBoundary only calls this once it has. */
function ProductPricesTable({
  rows, editable, onEdit, onDelete,
}: {
  rows: ClientProductPriceDto[];
  editable: boolean;
  onEdit: (price: ClientProductPriceDto) => void;
  onDelete: (price: ClientProductPriceDto) => void;
}) {
  const colorForBrewery = useBreweryColors();
  const groups = useMemo(() => {
    const byBrewery = new Map<string, ClientProductPriceDto[]>();
    for (const row of rows) {
      const key = row.breweryId ?? '';
      if (!byBrewery.has(key)) byBrewery.set(key, []);
      byBrewery.get(key)!.push(row);
    }
    return [...byBrewery.entries()].sort(
      (a, b) => (a[1][0]?.breweryName ?? '').localeCompare(b[1][0]?.breweryName ?? ''),
    );
  }, [rows]);

  return (
    <>
      {groups.map(([breweryId, groupRows]) => (
        <BrewerySection
          key={breweryId}
          breweryName={groupRows[0]?.breweryName ?? ''}
          color={colorForBrewery(breweryId)}
          rows={groupRows}
          editable={editable}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

/** Add-or-edit drawer for one client/product price — a single price per
 * (client, product), so create and update are one form (prototype
 * `clPriceForm`). Editing locks the product: changing it would mean deleting
 * one price and writing another, which the trash action already does more
 * clearly. */
function PriceFormDrawer({
  open, clientId, clientName, editingPrice, takenProductIds, onClose,
}: {
  open: boolean;
  clientId: string;
  clientName?: string;
  editingPrice: ClientProductPriceDto | undefined;
  takenProductIds: string[];
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();
  const colorForBrewery = useBreweryColors();
  const productsQuery = useProducts();
  const save = useSaveClientProductPrice();

  const [productId, setProductId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setProductId(editingPrice?.productId ?? null);
    setPriceInput(editingPrice?.priceWithVat != null ? String(editingPrice.priceWithVat) : '');
  }, [open, editingPrice]);

  const availableProducts = useMemo(
    () => (productsQuery.data ?? []).filter((p) => p.id && !takenProductIds.includes(p.id)),
    [productsQuery.data, takenProductIds],
  );

  const price = parseFloat(priceInput);
  const canSubmit = Boolean(productId) && Number.isFinite(price) && price > 0;

  const submit = async () => {
    if (!productId) {
      enqueueSnackbar('Vyberte produkt', { variant: 'warning' });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      enqueueSnackbar('Zadejte cenu větší než nula', { variant: 'warning' });
      return;
    }
    try {
      await save.mutateAsync({ clientId, productId, data: new SaveClientProductPriceDto({ priceWithVat: price }) });
      enqueueSnackbar('Cena uložena.', { variant: 'success' });
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <FormDrawer
      open={open}
      title={editingPrice ? 'Upravit cenu' : 'Vlastní cena'}
      subtitle={clientName}
      onClose={onClose}
      onSubmit={submit}
      busy={save.isPending}
      submitDisabled={!canSubmit}
    >
      {editingPrice ? (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, p: 1.25,
            border: 1, borderColor: 'divider', borderRadius: 1.5,
            bgcolor: (t) => t.vars!.palette.brand.surface2,
          }}
        >
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: colorForBrewery(editingPrice.breweryId) ?? 'text.disabled', flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, flex: 1, minWidth: 0 }} noWrap>
            {editingPrice.productName}
          </Typography>
          <Chip size="small" label={`${formatMoney(editingPrice.listPriceWithVat)} ceník`} />
        </Box>
      ) : (
        <ProductCombobox
          label="Produkt"
          value={productId}
          onChange={setProductId}
          products={availableProducts}
          loading={productsQuery.isLoading}
          required
          helperText="Ceníková cena pivovaru je uvedená u každé volby."
          trailing={(p) => (p.priceWithVat != null ? formatMoney(p.priceWithVat) : undefined)}
        />
      )}
      <TextField
        label="Cena s DPH"
        type="number"
        value={priceInput}
        onChange={(e) => setPriceInput(e.target.value)}
        required
        helperText="Ostatní ceny (bez DPH, za jednotku) se přepočítají poměrem z ceníkové ceny produktu."
      />
    </FormDrawer>
  );
}

/** Ceník tab of the client detail: the client's own product-price overrides.
 * Applies to every order and counter sale for this client; an already-loaded
 * invoice keeps whatever price it froze at loading time. */
export function ProductPricesPanel({
  clientId, clientName, editable,
}: {
  clientId: string;
  clientName?: string;
  editable: boolean;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();
  const query = useClientProductPrices(clientId);
  const del = useDeleteClientProductPrice();

  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<ClientProductPriceDto | undefined>(undefined);
  const [confirmPrice, setConfirmPrice] = useState<ClientProductPriceDto | null>(null);

  const openCreate = () => { setEditingPrice(undefined); setFormOpen(true); };
  const openEdit = (p: ClientProductPriceDto) => { setEditingPrice(p); setFormOpen(true); };

  const takenProductIds = (query.data ?? [])
    .map((p) => p.productId)
    .filter((id): id is string => id != null && id !== editingPrice?.productId);

  const doDelete = async () => {
    if (!confirmPrice?.productId) return;
    try {
      await del.mutateAsync({ clientId, productId: confirmPrice.productId });
      enqueueSnackbar('Vlastní cena odebrána.', { variant: 'success' });
      setConfirmPrice(null);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <Box>
      {editable && (
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Button
            startIcon={<WalletIcon />}
            onClick={() => setBulkOpen(true)}
            sx={{ bgcolor: (t) => t.vars!.palette.brand.amberSoft, color: 'primary.dark', '&:hover': { bgcolor: (t) => t.vars!.palette.brand.amberTint } }}
          >
            Hromadná úprava cen
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={openCreate}
            sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}
          >
            Přidat cenu
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            Platí pro všechny objednávky i prodej u pultu tohoto klienta. Faktura si cenu zamrazí při naložení.
          </Typography>
        </Stack>
      )}

      <QueryBoundary
        query={query}
        minHeight={140}
        isEmpty={(rows) => rows.length === 0}
        emptyState={
          <EmptyState
            icon={<WalletIcon />}
            title="Žádné vlastní ceny"
            description={`Klient platí ceníkové ceny pivovarů.${editable ? ' Vlastní cenu přidáte tlačítkem výše.' : ''}`}
          />
        }
      >
        {(rows) => <ProductPricesTable rows={rows} editable={editable} onEdit={openEdit} onDelete={setConfirmPrice} />}
      </QueryBoundary>

      <PriceFormDrawer
        open={formOpen}
        clientId={clientId}
        clientName={clientName}
        editingPrice={editingPrice}
        takenProductIds={takenProductIds}
        onClose={() => setFormOpen(false)}
      />

      <BulkClientPricesDrawer
        open={bulkOpen}
        clientId={clientId}
        clientName={clientName}
        onClose={() => setBulkOpen(false)}
      />

      <ConfirmDialog
        open={confirmPrice !== null}
        title="Vrátit na ceníkovou cenu?"
        message={(
          <>
            {confirmPrice?.productName ?? 'Produkt'} se bude klientovi účtovat ceníkovou cenou{' '}
            {formatMoney(confirmPrice?.listPriceWithVat)}. Už vyfakturované objednávky to nezmění.
          </>
        )}
        confirmLabel="Vrátit na ceník"
        busy={del.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirmPrice(null)}
      />
    </Box>
  );
}
