import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import { Combobox } from 'src/components/common/Combobox';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { SegControl } from 'src/components/common/SegControl';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { plural, saleNumber } from 'src/lib/format';
import { salePaymentName, saleStateName } from 'src/lib/labels';
import { apiErrorMessage } from 'src/api/errors';
import {
  CreateSaleDto,
  SaleBillingDto,
  SaleBuyerKind,
  SaleItemDto,
  SalePaymentMethod,
  UpdateSaleDto,
  type SaleDto,
} from 'src/generated/api-client';
import { useClient, useClients } from 'src/hooks/useClients';
import { clientComboOptions } from 'src/features/clients/clientOptions';
import {
  useCompleteSale,
  useCreateSale,
  useSale,
  useSaleClientHistory,
  useUpdateSale,
} from 'src/hooks/useSales';
import { useInventory } from 'src/hooks/useInventory';
import { PATHS } from 'src/routes/paths';
import { SaleCatalog } from './SaleCatalog';
import { SaleCartLine } from './SaleCartLine';
import { sellableRows, type StockRow } from './saleCatalogModel';

/**
 * A line being edited, identified by the stock row it draws from — one line per inventory item, so
 * the catalog's stepper has a single quantity to show and adjust.
 *
 * `stock` is the live quantity available, used to clamp both the stepper and the input.
 */
interface DraftLine {
  inventoryItemId: string;
  name: string;
  packageSize?: number;
  listPrice?: number;
  quantity: number;
  unitPrice: number | null;
  note: string;
  stock: number;
}

interface DraftBilling {
  name: string;
  companyId: string;
  vatId: string;
  streetName: string;
  streetNumber: string;
  city: string;
  zip: string;
  dueDate: string;
}

/** A `<input type="date">` needs `YYYY-MM-DD`; NSwag hands DateOnly back as a Date. */
function isoDate(value: string | Date | undefined): string {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

const emptyBilling: DraftBilling = {
  name: '',
  companyId: '',
  vatId: '',
  streetName: '',
  streetNumber: '',
  city: '',
  zip: '',
  dueDate: '',
};

/** Outer shell: an edit needs its sale loaded before the form can be seeded. */
export function SaleEditor({ mode, saleId }: { mode: 'create' | 'edit'; saleId?: string }) {
  const query = useSale(mode === 'edit' ? saleId : undefined);

  if (mode === 'create') return <SaleForm mode="create" />;

  return <QueryBoundary query={query}>{(sale) => <SaleForm mode="edit" sale={sale} />}</QueryBoundary>;
}

function SaleForm({ mode, sale }: { mode: 'create' | 'edit'; sale?: SaleDto }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();

  const clients = useClients();
  const create = useCreateSale();
  const update = useUpdateSale();
  const complete = useCompleteSale();

  const [saleDate, setSaleDate] = useState(() => sale?.saleDate ?? new Date().toISOString().slice(0, 10));
  const [buyerKind, setBuyerKind] = useState<'Client' | 'Walkin'>(sale?.clientId ? 'Client' : 'Walkin');
  const [clientId, setClientId] = useState<string | null>(sale?.clientId ?? null);
  const [buyerName, setBuyerName] = useState(sale?.buyerName ?? '');
  const [payment, setPayment] = useState<'Cash' | 'Invoice'>(
    sale ? (salePaymentName(sale.payment) as 'Cash' | 'Invoice') : 'Cash'
  );
  const [billing, setBilling] = useState<DraftBilling>(() =>
    sale?.billing
      ? {
          name: sale.billing.name ?? '',
          companyId: sale.billing.companyId ?? '',
          vatId: sale.billing.vatId ?? '',
          streetName: sale.billing.streetName ?? '',
          streetNumber: sale.billing.streetNumber ?? '',
          city: sale.billing.city ?? '',
          zip: sale.billing.zip ?? '',
          dueDate: isoDate(sale.billing.dueDate),
        }
      : emptyBilling
  );
  const [note, setNote] = useState(sale?.note ?? '');
  const [lines, setLines] = useState<DraftLine[]>(() =>
    (sale?.items ?? []).map((item) => ({
      inventoryItemId: item.inventoryItemId ?? '',
      name: item.name ?? '',
      packageSize: item.packageSize,
      listPrice: item.listPriceWithVat,
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPriceWithVat ?? null,
      note: item.note ?? '',
      // Seeded from the line's own quantity; reconciled with live stock below once the catalog
      // loads, so an existing draft can still be raised if more has come in since.
      stock: item.quantity ?? 0,
    }))
  );

  // A completed sale is frozen — reaching its edit URL directly must not present an editable form.
  const frozen = mode === 'edit' && sale != null && saleStateName(sale.state) !== 'Draft';
  useEffect(() => {
    if (frozen && sale?.id) navigate(`${PATHS.sales}/${sale.id}`, { replace: true });
  }, [frozen, sale?.id, navigate]);

  // The client list carries only id/name/region, so the fakturační adresa has to come from the
  // detail endpoint — fetched only once a client is actually selected.
  const selectedClient = useClient(buyerKind === 'Client' && clientId ? clientId : undefined);

  // Grouped by region and sorted by name inside each, the same picker the order editor uses — a flat
  // list of every client in the book is unusable once there are more than a screenful.
  const clientOptions = useMemo(() => clientComboOptions(clients.data ?? []), [clients.data]);

  const inventory = useInventory();
  const showHistory = buyerKind === 'Client' && Boolean(clientId);
  const history = useSaleClientHistory(showHistory ? (clientId ?? undefined) : undefined);

  // Reconcile each line's stock ceiling with what the catalog reports. An edited draft seeds its
  // ceiling from its own quantity, which would otherwise pin the stepper at what was already taken.
  const liveStock = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of sellableRows(inventory.data)) {
      map.set(row.id ?? '', row.quantity ?? 0);
    }
    return map;
  }, [inventory.data]);

  useEffect(() => {
    if (liveStock.size === 0) return;
    setLines((prev) =>
      prev.map((line) => {
        // Live stock is the whole ceiling, not stock-plus-this-line: a draft has not deducted
        // anything, so its own pieces are still sitting on the shelf and counted here already.
        const available = liveStock.get(line.inventoryItemId) ?? 0;
        // The quantity itself is left alone. If someone else sold the shelf out from under an open
        // draft, silently dropping the amount would hide it; the completion dialog and the backend
        // both refuse the oversold line, which is where it should surface.
        return available === line.stock ? line : { ...line, stock: available };
      })
    );
  }, [liveStock]);

  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  const totalPrice = lines.reduce((sum, l) => sum + l.quantity * (l.unitPrice ?? 0), 0);
  const buyerLabel =
    buyerKind === 'Client'
      ? (clientOptions.find((o) => o.value === clientId)?.label ?? 'Nevybraný klient')
      : buyerName.trim() || 'Neuvedený kupující';

  const busy = create.isPending || update.isPending || complete.isPending;

  // Lines the shelf cannot cover. The stepper clamps at stock, so this only ever fills when live
  // stock drops under an already-typed amount — someone else sold the last kegs while this draft was
  // open. The amount is deliberately not clamped down for them (that would hide the change), so the
  // completion has to be barred until the counter fixes it.
  const overStockLines = lines.filter((line) => line.quantity > line.stock);
  const blockedByStock = overStockLines.length > 0;

  const qtyOf = (inventoryItemId: string) =>
    lines.find((line) => line.inventoryItemId === inventoryItemId)?.quantity ?? 0;

  /**
   * Adds a stock row to the sale, or raises an existing line for it.
   *
   * The history tab passes the price and amount from last time, so re-adding a regular's usual crate
   * lands already priced as they last paid rather than at today's ceník.
   */
  const addLine = (row: StockRow, suggestedPrice?: number, suggestedQuantity?: number) => {
    const stock = row.quantity ?? 0;
    setLines((prev) => {
      const existing = prev.find((line) => line.inventoryItemId === row.id);
      if (existing) {
        return prev.map((line) =>
          line.inventoryItemId === row.id
            ? { ...line, quantity: Math.min(line.quantity + 1, stock), stock }
            : line
        );
      }

      return [
        ...prev,
        {
          inventoryItemId: row.id ?? '',
          name: row.name ?? '',
          packageSize: row.packageSize,
          listPrice: row.priceWithVat,
          quantity: Math.min(Math.max(suggestedQuantity ?? 1, 1), stock),
          unitPrice: suggestedPrice ?? row.priceWithVat ?? null,
          note: '',
          stock,
        },
      ];
    });
  };

  /** Steps a line's quantity, dropping the line entirely when it reaches zero. */
  const changeQuantity = (inventoryItemId: string, delta: number) => {
    setLines((prev) =>
      prev.flatMap((line) => {
        if (line.inventoryItemId !== inventoryItemId) return [line];
        const next = line.quantity + delta;
        if (next <= 0) return [];
        return [{ ...line, quantity: Math.min(next, line.stock) }];
      })
    );
  };

  const setQuantity = (inventoryItemId: string, raw: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.inventoryItemId !== inventoryItemId) return line;
        const parsed = Number.parseInt(raw, 10);
        const next = Number.isNaN(parsed) ? 0 : parsed;
        // Clamped at the input rather than only on save: you cannot hand over what is not there.
        if (next > line.stock) {
          enqueueSnackbar(`Na skladě je jen ${line.stock} ks`, { variant: 'warning' });
          return { ...line, quantity: line.stock };
        }
        return { ...line, quantity: next < 0 ? 0 : next };
      })
    );
  };

  const setLineNote = (inventoryItemId: string, value: string) => {
    setLines((prev) =>
      prev.map((line) => (line.inventoryItemId === inventoryItemId ? { ...line, note: value } : line))
    );
  };

  const setPrice = (inventoryItemId: string, raw: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.inventoryItemId !== inventoryItemId) return line;
        const parsed = Number.parseFloat(raw.replace(',', '.'));
        return { ...line, unitPrice: raw === '' || Number.isNaN(parsed) ? null : parsed };
      })
    );
  };

  // Prefill once the picked client's detail arrives. Only empty fields are filled, so a billing
  // block already typed by hand is never overwritten by the switch.
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    const client = selectedClient.data;
    if (!client?.id || prefilledFor.current === client.id) return;
    prefilledFor.current = client.id;
    setBilling((prev) => ({
      ...prev,
      name: prev.name || client.businessName || client.name || '',
      streetName: prev.streetName || (client.officialAddress?.streetName ?? ''),
      streetNumber: prev.streetNumber || (client.officialAddress?.streetNumber ?? ''),
      city: prev.city || (client.officialAddress?.city ?? ''),
      zip: prev.zip || (client.officialAddress?.zip ?? ''),
    }));
  }, [selectedClient.data]);

  const validate = (forCompletion: boolean): string | null => {
    if (lines.length === 0) return 'Přidejte alespoň jednu položku';
    if (buyerKind === 'Client' && !clientId) return 'Vyberte klienta';
    if (lines.some((l) => l.quantity < 1)) return 'Každá položka musí mít počet větší než 0';
    // The invoice block is required on every save, draft included, because the backend's create and
    // update validators demand it — checking it only at completion turned a saved draft into a 400.
    if (payment === 'Invoice') {
      if (!billing.name.trim()) return 'Vyplňte název pro fakturu';
      if (!billing.dueDate) return 'Vyplňte splatnost faktury';
    }
    if (forCompletion) {
      if (lines.some((l) => l.unitPrice == null || l.unitPrice <= 0)) return 'Doplňte cenu u všech položek';
      // Also enforced by disabling the button; kept here so a save triggered any other way (a
      // keyboard submit, a future call site) cannot slip an oversold sale through to the backend.
      const over = lines.find((l) => l.quantity > l.stock);
      if (over) return `Na skladě je jen ${over.stock} ks: ${over.name}`;
    }
    return null;
  };

  // The generated DTOs serialize dates through formatDate(), so these must be real Date instances
  // and real DTO instances — a plain object literal would throw inside toJSON at request time.
  const body = () => ({
    saleDate: new Date(saleDate),
    buyerKind: buyerKind === 'Client' ? SaleBuyerKind.Client : SaleBuyerKind.Walkin,
    clientId: buyerKind === 'Client' ? (clientId ?? undefined) : undefined,
    buyerName: buyerKind === 'Walkin' ? buyerName.trim() || undefined : undefined,
    payment: payment === 'Invoice' ? SalePaymentMethod.Invoice : SalePaymentMethod.Cash,
    billing:
      payment === 'Invoice'
        ? new SaleBillingDto({
            name: billing.name,
            companyId: billing.companyId || undefined,
            vatId: billing.vatId || undefined,
            streetName: billing.streetName || undefined,
            streetNumber: billing.streetNumber || undefined,
            city: billing.city || undefined,
            zip: billing.zip || undefined,
            dueDate: billing.dueDate ? new Date(billing.dueDate) : undefined,
          })
        : undefined,
    note: note.trim() || undefined,
    items: lines.map(
      (l) =>
        new SaleItemDto({
          inventoryItemId: l.inventoryItemId,
          quantity: l.quantity,
          unitPriceWithVat: l.unitPrice ?? undefined,
          note: l.note.trim() || undefined,
        })
    ),
  });

  const save = (thenComplete: boolean) => {
    const problem = validate(thenComplete);
    if (problem) {
      enqueueSnackbar(problem, { variant: 'warning' });
      return;
    }

    const onError = (err: unknown) =>
      enqueueSnackbar(apiErrorMessage(err, 'Prodej se nepodařilo uložit'), { variant: 'error' });

    const finish = (id: string) => {
      // Defence in depth for the /sales/null dead end: the create endpoint's status once disagreed
      // with what it documented, so the generated client returned null instead of the new id and the
      // editor navigated to a detail page that could not exist. The sale itself was saved, so land on
      // the list and say so rather than on a 404 that looks like the sale was lost.
      if (!id) {
        enqueueSnackbar('Prodej byl uložen, ale nepodařilo se ho otevřít.', { variant: 'warning' });
        navigate(PATHS.sales, { replace: true });
        return;
      }

      if (!thenComplete) {
        enqueueSnackbar('Prodej uložen jako rozpracovaný', { variant: 'success' });
        navigate(`${PATHS.sales}/${id}`, { replace: true });
        return;
      }
      complete.mutate(id, {
        onSuccess: () => {
          enqueueSnackbar(`Prodej dokončen · ${totalQuantity} ks odečteno ze skladu`, { variant: 'success' });
          navigate(`${PATHS.sales}/${id}`, { replace: true });
        },
        // The sale is saved either way — land on it so the completion can be retried from there.
        onError: (err) => {
          enqueueSnackbar(apiErrorMessage(err, 'Prodej se nepodařilo dokončit'), { variant: 'error' });
          navigate(`${PATHS.sales}/${id}`, { replace: true });
        },
      });
    };

    if (mode === 'edit' && sale?.id) {
      const id = sale.id;
      update.mutate({ id, data: new UpdateSaleDto(body()) }, { onSuccess: () => finish(id), onError });
      return;
    }
    create.mutate(new CreateSaleDto(body()), { onSuccess: (id) => finish(id), onError });
  };

  const cancel = () => navigate(sale?.id ? `${PATHS.sales}/${sale.id}` : PATHS.sales);

  if (frozen) return null;

  return (
    <>
      {/* Back runs the same cancel path the Zrušit button does, matching the order editor. */}
      <DetailHeader
        onBack={cancel}
        backLabel="Zpět na prodeje"
        title={mode === 'edit' ? 'Úprava prodeje' : 'Nový prodej'}
        // Which sale is being edited, beside the title as on the shipment detail. A new sale has no
        // number yet, so the lead is simply absent there.
        lead={mode === 'edit' ? saleNumber(sale?.id) : undefined}
        leadMono
        meta={['Vyberte zboží ze skladu, kupujícího a způsob platby.']}
        actions={
          <>
            <Button onClick={cancel} color="inherit" disabled={busy}>
              Zrušit
            </Button>
            <Button onClick={() => save(false)} disabled={busy}>
              Uložit rozpracovaný
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckIcon />}
              onClick={() => save(true)}
              disabled={busy || blockedByStock}
              // A disabled button explains nothing on its own; the tooltip names the offending lines.
              title={
                blockedByStock
                  ? `Na skladě není dost kusů: ${overStockLines.map((l) => l.name).join(', ')}`
                  : undefined
              }
            >
              Dokončit prodej
            </Button>
          </>
        }
      />

      <Stack direction={{ xs: 'column', compact: 'row' }} spacing={2} alignItems="flex-start">
        <Stack spacing={2} sx={{ flex: 1.5, minWidth: 0, width: '100%' }}>
          {/* Buyer and payment share one card: they are the same decision at the counter — who is
              this and how are they paying — and splitting them pushed the invoice fields a whole
              card away from the name they belong to. */}
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Kupující a platba</Typography>
              <Stack
                direction={{ xs: 'column', compact: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', compact: 'center' }}
                justifyContent="space-between"
                flexWrap="wrap"
                useFlexGap
              >
                <SegControl
                  value={buyerKind}
                  onChange={setBuyerKind}
                  options={[
                    { value: 'Client', label: 'Klient z evidence' },
                    { value: 'Walkin', label: 'Jednorázový kupující' },
                  ]}
                />
                <SegControl
                  value={payment}
                  onChange={setPayment}
                  options={[
                    { value: 'Cash', label: 'Hotově' },
                    { value: 'Invoice', label: 'Faktura' },
                  ]}
                />
              </Stack>

              <Box sx={{ mt: 2 }}>
                {buyerKind === 'Client' ? (
                  <Combobox
                    label="Klient"
                    value={clientId}
                    onChange={setClientId}
                    options={clientOptions}
                    placeholder="Vyberte klienta"
                    collapsibleGroups
                    required
                    helperText={
                      payment === 'Invoice'
                        ? 'Fakturační údaje se předvyplní z klienta.'
                        : 'Placeno na místě — fakturační údaje nejsou potřeba.'
                    }
                  />
                ) : (
                  <TextField
                    label="Jméno kupujícího"
                    size="small"
                    fullWidth
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Josef Vrána"
                    helperText={
                      payment === 'Invoice'
                        ? 'Fakturu vystavíte na údaje níže.'
                        : 'U hotovostního prodeje nepovinné.'
                    }
                  />
                )}
              </Box>

              {payment === 'Invoice' && (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  <Typography
                    sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: 'text.disabled' }}
                  >
                    FAKTURAČNÍ ÚDAJE
                  </Typography>
                  <TextField
                    label="Název / jméno"
                    size="small"
                    required
                    fullWidth
                    value={billing.name}
                    onChange={(e) => setBilling({ ...billing, name: e.target.value })}
                    placeholder="Na Rohu gastro s.r.o."
                  />
                  <Stack direction={{ xs: 'column', compact: 'row' }} spacing={1.5}>
                    <TextField
                      label="IČO"
                      size="small"
                      fullWidth
                      value={billing.companyId}
                      onChange={(e) => setBilling({ ...billing, companyId: e.target.value })}
                    />
                    <TextField
                      label="DIČ"
                      size="small"
                      fullWidth
                      value={billing.vatId}
                      onChange={(e) => setBilling({ ...billing, vatId: e.target.value })}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', compact: 'row' }} spacing={1.5}>
                    <TextField
                      label="Ulice"
                      size="small"
                      fullWidth
                      value={billing.streetName}
                      onChange={(e) => setBilling({ ...billing, streetName: e.target.value })}
                    />
                    <TextField
                      label="Číslo"
                      size="small"
                      fullWidth
                      value={billing.streetNumber}
                      onChange={(e) => setBilling({ ...billing, streetNumber: e.target.value })}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', compact: 'row' }} spacing={1.5}>
                    <TextField
                      label="Město"
                      size="small"
                      fullWidth
                      value={billing.city}
                      onChange={(e) => setBilling({ ...billing, city: e.target.value })}
                    />
                    <TextField
                      label="PSČ"
                      size="small"
                      fullWidth
                      value={billing.zip}
                      onChange={(e) => setBilling({ ...billing, zip: e.target.value })}
                    />
                  </Stack>
                  {/* Required, not optional: an invoiced sale waits in "Čeká na platbu" until the
                      money lands, and without a due date nothing can ever be called overdue. */}
                  <TextField
                    label="Splatnost"
                    size="small"
                    type="date"
                    required
                    fullWidth
                    value={billing.dueDate}
                    onChange={(e) => setBilling({ ...billing, dueDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography sx={{ fontWeight: 700, flex: 1 }}>Položky</Typography>
                <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>
                  {lines.length} {plural(lines.length, 'položka', 'položky', 'položek')}
                </Typography>
              </Stack>

              {/* The picked lines live in the summary rail, next to the total they add up to; this
                  card is the catalog you pick them from. */}
              <SaleCatalog
                sections={inventory.data}
                history={history.data}
                showHistory={showHistory}
                qtyOf={qtyOf}
                onAdd={addLine}
                onChange={changeQuantity}
              />
            </CardContent>
          </Card>
        </Stack>

        <Box sx={{ flex: 1, minWidth: 0, width: '100%', position: { compact: 'sticky' }, top: 16 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Souhrn</Typography>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: 'text.disabled' }}>
                CELKEM K ÚHRADĚ
              </Typography>
              <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(totalPrice)}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>
                {totalQuantity} {plural(totalQuantity, 'kus', 'kusy', 'kusů')}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>Kupující</Typography>
                  <Typography sx={{ fontSize: 13.5, textAlign: 'right' }}>{buyerLabel}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>Platba</Typography>
                  <Typography sx={{ fontSize: 13.5 }}>{payment === 'Cash' ? 'Hotově' : 'Faktura'}</Typography>
                </Stack>
              </Stack>

              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <TextField
                  label="Datum prodeje"
                  size="small"
                  type="date"
                  fullWidth
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Poznámka"
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Např. soused, bere pravidelně…"
                />
              </Stack>

              {lines.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: 'text.disabled', mb: 1 }}
                  >
                    POLOŽKY ({lines.length})
                  </Typography>
                  <Stack spacing={1.5}>
                    {lines.map((line) => (
                      <SaleCartLine
                        key={line.inventoryItemId}
                        line={line}
                        formatMoney={formatMoney}
                        onQuantity={(raw) => setQuantity(line.inventoryItemId, raw)}
                        onStep={(delta) => changeQuantity(line.inventoryItemId, delta)}
                        onPrice={(raw) => setPrice(line.inventoryItemId, raw)}
                        onNote={(value) => setLineNote(line.inventoryItemId, value)}
                        onRemove={() =>
                          setLines((prev) => prev.filter((l) => l.inventoryItemId !== line.inventoryItemId))
                        }
                      />
                    ))}
                  </Stack>
                </>
              )}

              {/* The save actions live in the header now; the warning stays here, next to the
                  total it is about. */}
              <Typography sx={{ mt: 2, fontSize: 12, color: 'text.disabled' }}>
                Dokončením se zboží odečte ze skladu a záznam se uzamkne.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Stack>
    </>
  );
}
