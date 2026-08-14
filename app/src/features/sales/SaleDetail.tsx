import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { StatusPill } from 'src/components/common/StatusPill';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { fmtDate, fmtLiters, plural, saleNumber } from 'src/lib/format';
import { L, SALE_STATUS, kindLabel, salePaymentName, saleStateName } from 'src/lib/labels';
import { apiErrorMessage } from 'src/api/errors';
import { type SaleDto } from 'src/generated/api-client';
import { useCompleteSale, useConfirmSalePayment, useDeleteSale, useSale } from 'src/hooks/useSales';
import { useInventory } from 'src/hooks/useInventory';
import { PATHS } from 'src/routes/paths';
import { type DetailBackState } from 'src/routes/backNav';
import { completionRows, overdueDays, shortRows, stockLevels } from './salesModel';
import { CompleteSaleDialog } from './CompleteSaleDialog';

/** Outer shell: handles the query states so the inner view never renders on missing data. */
export function SaleDetail({ id, editable }: { id: string; editable: boolean }) {
  const query = useSale(id);
  return <QueryBoundary query={query}>{(sale) => <SaleDetailView sale={sale} editable={editable} />}</QueryBoundary>;
}

function SaleDetailView({ sale, editable }: { sale: SaleDto; editable: boolean }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const complete = useCompleteSale();
  const remove = useDeleteSale();
  const confirmPayment = useConfirmSalePayment();

  const id = sale.id ?? '';
  const isDraft = saleStateName(sale.state) === 'Draft';
  const isInvoice = salePaymentName(sale.payment) === 'Invoice';
  // Money outstanding is now a lifecycle state, not a flag on the billing block: an invoiced sale
  // that has been handed over sits in AwaitingPayment until someone confirms the money arrived.
  const awaitsPayment = saleStateName(sale.state) === 'AwaitingPayment';
  const overdue = overdueDays({ state: sale.state, dueDate: sale.billing?.dueDate }, new Date());

  const status = SALE_STATUS[saleStateName(sale.state)] ?? SALE_STATUS.Draft;
  // Memoised because the `?? []` fallback is a fresh array on every render, which would make the
  // stock memo below recompute each time and defeat its own purpose.
  const items = useMemo(() => sale.items ?? [], [sale.items]);

  // Stock can move between a draft being written and being finished — someone else sells the last
  // keg. Checked on entering the detail rather than only inside the confirm dialog, so the shortfall
  // is visible before committing to the action.
  //
  // Fetched unconditionally because the query cache is shared with Sklad and the catalog, so this is
  // usually a cache read; the result is only *acted on* for a draft, since a completed sale already
  // moved its stock and measuring it against today's shelf would mean nothing.
  const inventory = useInventory();
  const stockRows = useMemo(
    () => completionRows(items, stockLevels(inventory.data)),
    [items, inventory.data]
  );
  const short = shortRows(stockRows);
  // Trusted only once the fetch has actually succeeded: mid-flight every row looks absent, and
  // disabling the action on that would block a perfectly completable sale.
  const stockChecked = inventory.isSuccess;
  const blockedByStock = isDraft && stockChecked && short.length > 0;
  const shortByKey = useMemo(
    () => new Map(stockRows.map((row) => [row.key, row])),
    [stockRows]
  );
  const totalQuantity = items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
  const totalPrice = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitPriceWithVat ?? 0), 0);
  const buyer = sale.clientName ?? (sale.buyerName?.trim() ? sale.buyerName : 'Neuvedený kupující');

  const onComplete = () =>
    complete.mutate(id, {
      onSuccess: () => {
        setCompleteOpen(false);
        enqueueSnackbar(`Prodej dokončen · ${totalQuantity} ks odečteno ze skladu`, { variant: 'success' });
      },
      onError: (err) => enqueueSnackbar(apiErrorMessage(err, 'Prodej se nepodařilo dokončit'), { variant: 'error' }),
    });

  const onDelete = () =>
    remove.mutate(id, {
      onSuccess: () => {
        enqueueSnackbar('Prodej smazán', { variant: 'success' });
        navigate(PATHS.sales);
      },
      onError: (err) => enqueueSnackbar(apiErrorMessage(err, 'Prodej se nepodařilo smazat'), { variant: 'error' }),
    });

  const onConfirmPayment = () =>
    confirmPayment.mutate(id, {
      onSuccess: () => enqueueSnackbar('Platba potvrzena · prodej dokončen', { variant: 'success' }),
      onError: (err) => enqueueSnackbar(apiErrorMessage(err, 'Platbu se nepodařilo potvrdit'), { variant: 'error' }),
    });

  const kv = (label: string, value: React.ReactNode) => (
    <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="baseline">
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled', flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, textAlign: 'right' }}>{value}</Typography>
    </Stack>
  );

  const banner = (tone: 'amber' | 'ok' | 'crit', title: string, body: string, action?: React.ReactNode) => (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: 'transparent',
        bgcolor: tone === 'ok' ? 'brand.okTint' : tone === 'crit' ? 'brand.critTint' : 'brand.amberTint',
      }}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{body}</Typography>
        </Box>
        {action}
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* DetailHeader, like the shipment and order details: the back arrow sits left of the number
          and the state pill rides beside it, rather than a "Zpět" button competing with the
          lifecycle actions on the right. */}
      <DetailHeader
        onBack={() => navigate(PATHS.sales)}
        backLabel="Zpět na prodeje"
        title={saleNumber(sale.id)}
        titleMono
        status={<StatusPill tone={status.tone} label={status.label} />}
        meta={[fmtDate(sale.saleDate), buyer, `${totalQuantity} ${plural(totalQuantity, 'kus', 'kusy', 'kusů')}`]}
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            {editable && isDraft && (
              <Button
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={() => setCompleteOpen(true)}
                disabled={blockedByStock}
                // The button gives no reason on its own when disabled, so the tooltip carries it.
                title={blockedByStock ? 'Na skladě není dost kusů — doskladněte nebo upravte prodej' : undefined}
              >
                Dokončit prodej
              </Button>
            )}
            {editable && isDraft && (
              <Button startIcon={<EditOutlinedIcon />} onClick={() => navigate(`${PATHS.sales}/${id}/edit`)}>
                Upravit
              </Button>
            )}
            {editable && isDraft && (
              <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteOpen(true)}>
                Smazat
              </Button>
            )}
            {editable && awaitsPayment && (
              <Button
                variant="contained"
                startIcon={<PaymentsOutlinedIcon />}
                onClick={onConfirmPayment}
                disabled={confirmPayment.isPending}
              >
                Platba dorazila
              </Button>
            )}
          </Stack>
        }
      />

      {isDraft
        ? blockedByStock
          ? banner(
              'crit',
              'Na skladě už není dost kusů',
              `Od vytvoření prodeje se sklad změnil: ${short
                .map((row) => `${row.name} — potřeba ${row.quantity}, skladem ${row.before ?? 0}`)
                .join('; ')}. Doskladněte zboží, nebo prodej upravte.`,
              editable ? (
                <Button size="small" onClick={() => navigate(`${PATHS.sales}/${id}/edit`)}>
                  Upravit prodej
                </Button>
              ) : undefined
            )
          : banner(
              'amber',
              'Rozpracovaný prodej',
              'Zboží zatím nebylo odečteno ze skladu. Odečte se až dokončením prodeje.'
            )
        : awaitsPayment && overdue === 0
          ? banner(
              'amber',
              'Vyskladněno, čeká na platbu',
              `${totalQuantity} ${plural(totalQuantity, 'kus byl', 'kusy byly', 'kusů bylo')} odečteno ze skladu. Faktura se splatností ${fmtDate(sale.billing?.dueDate)} zatím není uhrazena.`,
              editable ? (
                <Button size="small" onClick={onConfirmPayment} disabled={confirmPayment.isPending}>
                  Platba dorazila
                </Button>
              ) : undefined
            )
          : banner(
              'ok',
              'Vyskladněno',
              `${totalQuantity} ${plural(totalQuantity, 'kus byl', 'kusy byly', 'kusů bylo')} odečteno ze skladu.`,
              <Button size="small" onClick={() => navigate(PATHS.inventory)}>
                Zobrazit sklad
              </Button>
            )}

      {overdue > 0 &&
        banner(
          'crit',
          'Faktura po splatnosti',
          `Splatnost byla ${fmtDate(sale.billing?.dueDate)} — ${overdue} ${plural(overdue, 'den', 'dny', 'dní')} po termínu, ${formatMoney(totalPrice)} neuhrazeno.`,
          editable ? (
            <Button size="small" onClick={onConfirmPayment} disabled={confirmPayment.isPending}>
              Platba dorazila
            </Button>
          ) : undefined
        )}

      <Stack direction={{ xs: 'column', compact: 'row' }} spacing={2} alignItems="flex-start">
        <Stack spacing={2} sx={{ flex: 1.5, minWidth: 0, width: '100%' }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Prodané zboží</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Položka</TableCell>
                    <TableCell align="right">Počet</TableCell>
                    <TableCell align="right">Cena/ks</TableCell>
                    <TableCell align="right">Celkem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => {
                    const discounted =
                      item.listPriceWithVat != null && item.unitPriceWithVat !== item.listPriceWithVat;
                    // Only a draft's lines are measured against the shelf; see the check above.
                    const stock = isDraft && stockChecked
                      ? shortByKey.get(item.id ?? item.inventoryItemId ?? '')
                      : undefined;
                    const lineShort = stock?.short === true;
                    return (
                      <TableRow
                        key={item.id}
                        sx={lineShort ? { bgcolor: 'brand.critTint' } : undefined}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography sx={{ fontWeight: 600 }}>
                              {item.name}
                              {item.packageSize != null ? ` (${fmtLiters(item.packageSize)})` : ''}
                            </Typography>
                            {/* Snapshotted packaging. Absent for a free-form stock item, which has no
                                product behind it — no chip rather than an "Ostatní" placeholder. */}
                            {item.kind != null && (
                              <Chip size="small" label={kindLabel(item.kind)} sx={{ height: 20, fontSize: 11 }} />
                            )}
                          </Stack>
                          {lineShort && (
                            <Typography sx={{ fontSize: 11.5, color: 'error.main', fontWeight: 700 }}>
                              skladem jen {stock?.before ?? 0} — nelze vyskladnit
                            </Typography>
                          )}
                          {discounted && (
                            <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
                              ceník {formatMoney(item.listPriceWithVat ?? 0)} ·{' '}
                              {(item.unitPriceWithVat ?? 0) < (item.listPriceWithVat ?? 0) ? 'sleva' : 'příplatek'}{' '}
                              {formatMoney(Math.abs((item.listPriceWithVat ?? 0) - (item.unitPriceWithVat ?? 0)))}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontVariantNumeric: 'tabular-nums',
                            ...(lineShort && { color: 'error.main', fontWeight: 700 }),
                          }}
                        >
                          {item.quantity} ks
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(item.unitPriceWithVat ?? 0)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney((item.quantity ?? 0) * (item.unitPriceWithVat ?? 0))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, borderTop: 2, borderColor: 'divider' }}>Celkem</TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, borderTop: 2, borderColor: 'divider', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {totalQuantity} ks
                    </TableCell>
                    <TableCell sx={{ borderTop: 2, borderColor: 'divider' }} />
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        fontSize: 16,
                        borderTop: 2,
                        borderColor: 'divider',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatMoney(totalPrice)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {sale.note && (
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Poznámka</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{sale.note}</Typography>
              </CardContent>
            </Card>
          )}
        </Stack>

        <Stack spacing={2} sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Kupující</Typography>
              <Stack spacing={1.25}>
                {kv('Typ', sale.clientId ? 'Klient z evidence' : 'Jednorázový kupující')}
                {kv(
                  'Jméno',
                  sale.clientId ? (
                    <Box
                      component="button"
                      type="button"
                      // The client is a detour from this sale, so it carries the way back with it —
                      // its arrow returns here rather than dropping the user on the clients list.
                      onClick={() =>
                        navigate(`${PATHS.clients}/${sale.clientId}`, {
                          state: {
                            backTo: `${PATHS.sales}/${id}`,
                            backLabel: 'Zpět na prodej',
                          } satisfies DetailBackState,
                        })
                      }
                      sx={{
                        border: 0,
                        background: 'none',
                        p: 0,
                        cursor: 'pointer',
                        color: 'primary.main',
                        font: 'inherit',
                        textAlign: 'right',
                      }}
                    >
                      {buyer}
                    </Box>
                  ) : (
                    buyer
                  )
                )}
                {kv('Platba', L.salePayment[salePaymentName(sale.payment)])}
                {kv('Prodal', sale.soldByUserName ?? '—')}
              </Stack>
            </CardContent>
          </Card>

          {isInvoice && sale.billing && (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, flex: 1 }}>Fakturační údaje</Typography>
                  {/* Derived from the state, not from a separate flag — a draft has not been handed
                      over, so it is neither paid nor owed and carries no pill at all. */}
                  {!isDraft && (
                    <StatusPill
                      tone={awaitsPayment ? 'crit' : 'ok'}
                      label={awaitsPayment ? 'nezaplaceno' : 'zaplaceno'}
                    />
                  )}
                </Stack>
                <Stack spacing={1.25}>
                  {kv('Název', sale.billing.name ?? '—')}
                  {kv('IČO', sale.billing.companyId ?? '—')}
                  {kv('DIČ', sale.billing.vatId ?? '—')}
                  {kv(
                    'Adresa',
                    [
                      [sale.billing.streetName, sale.billing.streetNumber].filter(Boolean).join(' '),
                      [sale.billing.zip, sale.billing.city].filter(Boolean).join(' '),
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'
                  )}
                  {kv('Splatnost', fmtDate(sale.billing.dueDate))}
                  {sale.billing.paidDate != null && kv('Zaplaceno', fmtDate(sale.billing.paidDate))}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Souhrn</Typography>
              <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.disabled' }}>Kusů</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {totalQuantity}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.disabled' }}>Celkem</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(totalPrice)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Stack>

      <CompleteSaleDialog
        sale={sale}
        open={completeOpen}
        busy={complete.isPending}
        onConfirm={onComplete}
        onClose={() => setCompleteOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Smazat prodej?"
        message={`Opravdu smazat rozpracovaný prodej ${saleNumber(sale.id)}? Skladu se to nedotkne.`}
        busy={remove.isPending}
        onConfirm={onDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
