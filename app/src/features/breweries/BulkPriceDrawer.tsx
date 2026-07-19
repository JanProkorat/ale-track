import { useEffect, useMemo, useState } from 'react';
import {
  Stack, Button, TextField, InputAdornment, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHighOutlined';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { apiErrorMessage } from 'src/api/errors';
import {
  UpdateProductDto, ProductKind, ProductType, type BreweryProductListItemDto,
} from 'src/generated/api-client';
import { useUpdateProduct } from 'src/hooks/useBreweryProducts';

type P = BreweryProductListItemDto;

/** Bulk price editor: apply a % change across all products (or edit each new
 * price by hand), preview, then save. Prices without VAT and per-unit prices
 * scale by the same ratio so the ceník stays consistent. */
export function BulkPriceDrawer({
  open,
  breweryId,
  products,
  onClose,
}: {
  open: boolean;
  breweryId: string;
  products: P[];
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();
  const update = useUpdateProduct(breweryId);

  const [pct, setPct] = useState('');
  const [next, setNext] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(products.map((p) => [p.id!, p])), [products]);

  useEffect(() => {
    if (!open) return;
    const seed: Record<string, string> = {};
    products.forEach((p) => { if (p.id) seed[p.id] = String(p.priceWithVat ?? ''); });
    setNext(seed);
    setPct('');
  }, [open, products]);

  const applyPct = () => {
    const f = 1 + (parseFloat(pct) || 0) / 100;
    const out: Record<string, string> = {};
    products.forEach((p) => { if (p.id) out[p.id] = String(Math.round((p.priceWithVat ?? 0) * f)); });
    setNext(out);
    enqueueSnackbar('Náhled přepočítán.', { variant: 'info' });
  };

  const save = async () => {
    setBusy(true);
    let changed = 0;
    try {
      for (const p of products) {
        if (!p.id) continue;
        const nv = Number(next[p.id]);
        if (!Number.isFinite(nv) || nv === p.priceWithVat) continue;
        const ratio = p.priceWithVat ? nv / p.priceWithVat : 1;
        const scale = (v: number | undefined, fallback: number) =>
          v != null ? Math.round(v * ratio * 100) / 100 : fallback;
        await update.mutateAsync({
          id: p.id,
          data: new UpdateProductDto({
            name: p.name ?? '',
            description: p.description,
            kind: p.kind ?? ProductKind.Other,
            type: p.type ?? ProductType.Other,
            alcoholPercentage: p.alcoholPercentage,
            platoDegree: p.platoDegree,
            packageSize: p.packageSize,
            priceWithVat: nv,
            priceForUnitWithVat: scale(p.priceForUnitWithVat, nv),
            priceForUnitWithoutVat: scale(p.priceForUnitWithoutVat, Math.round((nv / 1.21) * 100) / 100),
          }),
        });
        changed += 1;
      }
      enqueueSnackbar(changed ? `Upraveno ${changed} cen.` : 'Žádné změny.', { variant: 'success' });
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDrawer
      open={open}
      title="Hromadná úprava cen"
      subtitle="Změna se projeví u všech produktů pivovaru."
      onClose={onClose}
      onSubmit={save}
      busy={busy}
      submitLabel="Uložit ceny"
      width={560}
    >
      <Alert severity="info" icon={<AutoFixHighIcon />}>
        Zadejte změnu v procentech a přepočítejte náhled, nebo upravte jednotlivé ceny ručně.
        Ceny bez DPH i za jednotku se přepočítají ve stejném poměru.
      </Alert>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <TextField
          label="Změna ceny"
          type="number"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          placeholder="např. 5 nebo -3"
          slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" startIcon={<AutoFixHighIcon />} onClick={applyPct} sx={{ height: 40, mt: 0.25, flexShrink: 0 }}>
          Přepočítat náhled
        </Button>
      </Stack>

      <TableContainer sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Produkt</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Nyní</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 130 }}>Nově</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                  {formatMoney(byId.get(p.id!)?.priceWithVat)}
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    size="small"
                    value={p.id ? next[p.id] ?? '' : ''}
                    onChange={(e) => p.id && setNext((n) => ({ ...n, [p.id!]: e.target.value }))}
                    slotProps={{ htmlInput: { style: { textAlign: 'right' } } }}
                    sx={{ width: 110 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </FormDrawer>
  );
}
