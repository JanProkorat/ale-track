import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { StatusPill } from 'src/components/common/StatusPill';
import { SegControl } from 'src/components/common/SegControl';
import { SearchField } from 'src/components/common/SearchField';
import { useAuth } from 'src/auth/AuthProvider';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { fmtDate, saleNumber } from 'src/lib/format';
import { L, SALE_STATUS, salePaymentName, saleStateName } from 'src/lib/labels';
import { plural } from 'src/lib/format';
import { type SaleListItemDto } from 'src/generated/api-client';
import { useSales } from 'src/hooks/useSales';
import { PATHS } from 'src/routes/paths';
import {
  filterSales, isCompleted, isUnpaid, overdueDays, searchSalesByBuyer, summariseSales,
  type SaleFilter,
} from './salesModel';
import { SaleDetail } from './SaleDetail';
import { SaleEditor } from './SaleEditor';

// Lifecycle order: a sale goes draft → awaiting payment (invoice only) → done.
const SEGMENTS: [SaleFilter, string][] = [
  ['all', 'Vše'],
  ['draft', 'Rozpracované'],
  ['unpaid', 'Nezaplacené'],
  ['completed', 'Dokončené'],
];

/** Garážový prodej — selling stock over the counter. URL-driven like the other modules:
 * /sales (list), /sales/:id (detail), /sales/new + /sales/:id/edit (editor). */
export function SalesPage({ view }: { view?: 'create' | 'edit' }) {
  const { canEdit } = useAuth();
  const editable = canEdit('sales');
  const navigate = useNavigate();
  const { id } = useParams();
  const { formatMoney } = useCurrency();
  const [filter, setFilter] = useState<SaleFilter>('all');
  const [search, setSearch] = useState('');

  const list = useSales();
  const all = useMemo(() => list.data ?? [], [list.data]);

  // "Today" is read once per render rather than per row, so every overdue badge in the table
  // is measured against the same day.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const summary = useMemo(() => summariseSales(all, today.slice(0, 7)), [all, today]);
  // Segment first, then buyer: the segment counts describe the whole list, so a search must not
  // change the numbers on the tabs — only which rows survive into the table.
  const rows = useMemo(
    () => searchSalesByBuyer(filterSales(all, filter), search),
    [all, filter, search]
  );

  // Counted, not derived by subtraction: with a third state in play, "everything that is not a
  // draft" is no longer the same set as "completed".
  const counts = useMemo(
    () => ({
      all: all.length,
      draft: summary.drafts,
      unpaid: summary.unpaid,
      completed: all.filter(isCompleted).length,
    }),
    [all, summary.drafts, summary.unpaid]
  );

  const buyerName = (s: SaleListItemDto) =>
    s.clientName ?? (s.buyerName?.trim() ? s.buyerName : 'Neuvedený kupující');

  const paymentChip = (s: SaleListItemDto) => {
    const payment = salePaymentName(s.payment);
    if (payment === 'Cash') return L.salePayment.Cash;
    if (saleStateName(s.state) === 'Draft') return L.salePayment.Invoice;
    return `${L.salePayment.Invoice} · ${isUnpaid(s) ? 'nezaplaceno' : 'zaplaceno'}`;
  };

  const columns: Column<SaleListItemDto>[] = [
    {
      key: 'number',
      header: 'Číslo',
      width: 110,
      sortValue: (s) => saleNumber(s.id),
      render: (s) => (
        <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{saleNumber(s.id)}</Typography>
      ),
    },
    {
      key: 'date',
      header: 'Datum',
      sortValue: (s) => s.saleDate,
      render: (s) => <Typography>{fmtDate(s.saleDate)}</Typography>,
    },
    {
      key: 'buyer',
      header: 'Kupující',
      sortValue: (s) => buyerName(s),
      render: (s) => (
        <Typography sx={{ fontWeight: 600, color: s.clientName || s.buyerName ? 'text.primary' : 'text.disabled' }}>
          {buyerName(s)}
        </Typography>
      ),
    },
    {
      key: 'payment',
      header: 'Platba',
      sortValue: (s) => salePaymentName(s.payment),
      render: (s) => (
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: isUnpaid(s) ? 'error.main' : 'text.secondary' }}>
          {paymentChip(s)}
        </Typography>
      ),
    },
    {
      key: 'quantity',
      header: 'Kusů',
      align: 'right',
      sortValue: (s) => s.totalQuantity,
      render: (s) => <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>{s.totalQuantity ?? 0}</Typography>,
    },
    {
      key: 'total',
      header: 'Celkem',
      align: 'right',
      sortValue: (s) => s.totalPrice,
      render: (s) => (
        <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatMoney(s.totalPrice ?? 0)}
        </Typography>
      ),
    },
    {
      key: 'state',
      header: 'Stav',
      sortValue: (s) => (SALE_STATUS[saleStateName(s.state)] ?? SALE_STATUS.Draft).label,
      render: (s) => {
        const status = SALE_STATUS[saleStateName(s.state)] ?? SALE_STATUS.Draft;
        const overdue = overdueDays(s, today);
        return (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <StatusPill tone={status.tone} label={status.label} />
            {overdue > 0 && (
              <StatusPill
                tone="crit"
                label={`po splatnosti ${overdue} ${plural(overdue, 'den', 'dny', 'dní')}`}
              />
            )}
          </Stack>
        );
      },
    },
    {
      key: 'chevron',
      header: '',
      align: 'right',
      width: 40,
      render: () => <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />,
    },
  ];

  const newSaleButton = editable && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate(`${PATHS.sales}/new`)}>
      Nový prodej
    </Button>
  );

  const saleCard = (s: SaleListItemDto) => {
    const status = SALE_STATUS[saleStateName(s.state)] ?? SALE_STATUS.Draft;
    const overdue = overdueDays(s, today);
    return (
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13, flex: 1, minWidth: 0 }}>
            {saleNumber(s.id)}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{fmtDate(s.saleDate)}</Typography>
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
        </Stack>
        <Typography sx={{ fontWeight: 600 }}>{buyerName(s)}</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{paymentChip(s)}</Typography>
          <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', ml: 'auto' }}>
            {formatMoney(s.totalPrice ?? 0)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <StatusPill tone={status.tone} label={status.label} />
          {overdue > 0 && (
            <StatusPill tone="crit" label={`po splatnosti ${overdue} ${plural(overdue, 'den', 'dny', 'dní')}`} />
          )}
        </Stack>
      </Stack>
    );
  };

  const stat = (label: string, value: string, icon: React.ReactNode, critical = false) => (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1.75, py: 1.25, minWidth: 140 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.25,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          bgcolor: critical ? 'brand.critTint' : 'brand.surface2',
          color: critical ? 'error.main' : 'text.secondary',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.disabled', whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: 19,
            fontWeight: 800,
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
            color: critical ? 'error.main' : 'text.primary',
          }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );

  if (view === 'create' || view === 'edit') {
    return (
      <PageContainer>
        <SaleEditor mode={view} saleId={view === 'edit' ? id : undefined} />
      </PageContainer>
    );
  }

  if (id) {
    return (
      <PageContainer>
        <SaleDetail id={id} editable={editable} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Garážový prodej"
        title="Prodeje"
        subtitle="Prodej zboží ze skladu zákazníkovi na místě — hotově nebo na fakturu."
        actions={newSaleButton}
      />

      <QueryBoundary
        query={list}
        isEmpty={(data) => data.length === 0}
        emptyState={
          <EmptyState
            icon={<ShoppingCartOutlinedIcon />}
            title="Zatím žádné prodeje"
            description="Ze skladu se zatím nic neprodalo přímo na místě."
            action={newSaleButton}
          />
        }
      >
        {() => (
          <>
            {/* Stats, segments and search share one row on a wide screen and stack on a narrow
                one. `useFlexGap` rather than `spacing`, so a wrapped row keeps its gaps. */}
            <Card variant="outlined" sx={{ mb: 2, px: 0.5, py: 0.75 }}>
              <Stack
                direction="row"
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ gap: 1.5 }}
              >
                {stat('Prodejů tento měsíc', String(summary.completedThisMonth), <ShoppingCartOutlinedIcon fontSize="small" />)}
                {stat('Obrat tento měsíc', formatMoney(summary.revenueThisMonth), <PaymentsOutlinedIcon fontSize="small" />)}
                {stat('Rozpracované', String(summary.drafts), <EditOutlinedIcon fontSize="small" />)}
                {stat(
                  'Nezaplaceno',
                  summary.unpaid > 0 ? formatMoney(summary.unpaidTotal) : '—',
                  <ReceiptOutlinedIcon fontSize="small" />,
                  summary.unpaid > 0
                )}

                <Stack
                  direction="row"
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  // Pushed to the trailing edge on a wide screen; on a wrapped row the auto
                  // margin collapses and the controls sit under the stats instead.
                  sx={{ gap: 1.5, ml: { compact: 'auto' }, px: 1.25 }}
                >
                  <SegControl
                    value={filter}
                    onChange={setFilter}
                    options={SEGMENTS.map(([value, label]) => ({
                      value,
                      label: (
                        <Box component="span">
                          {label}
                          {counts[value] ? (
                            <Box component="span" sx={{ ml: 0.5, opacity: 0.55 }}>
                              {counts[value]}
                            </Box>
                          ) : null}
                        </Box>
                      ),
                    }))}
                  />
                  <SearchField
                    value={search}
                    onChange={setSearch}
                    placeholder="Hledat kupujícího…"
                    width={{ xs: '100%', compact: 220 }}
                  />
                </Stack>
              </Stack>
            </Card>

            <Typography
              sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled', mb: 1, textAlign: 'right' }}
            >
              {rows.length} z {all.length}
            </Typography>

            <Card variant="outlined">
              <DataTable
                columns={columns}
                rows={rows}
                getRowKey={(s) => s.id ?? ''}
                onRowClick={(s) => navigate(`${PATHS.sales}/${s.id}`)}
                mobileCard={saleCard}
                // An overdue invoice is a whole-record problem, so the row carries the flag rather
                // than leaving it to the pill in the last column, which is easy to scroll past.
                rowSx={(s) => (overdueDays(s, today) > 0 ? { bgcolor: 'brand.critTint' } : undefined)}
                // An overdue invoice is a whole-record problem, so the row carries the flag rather
                // than leaving it to the pill in the last column, which is easy to scroll past.
                paginated
                pageSizeKey="sales"
                defaultSort={{ key: 'date', direction: 'desc' }}
              />
            </Card>
          </>
        )}
      </QueryBoundary>
    </PageContainer>
  );
}
