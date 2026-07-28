import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { SegControl } from 'src/components/common/SegControl';
import AddIcon from '@mui/icons-material/AddOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { SearchField } from 'src/components/common/SearchField';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { StatusPill } from 'src/components/common/StatusPill';
import { useAuth } from 'src/auth/AuthProvider';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ORDER_STATUS, orderStateName } from 'src/lib/labels';
import { type OrderListItemDto } from 'src/generated/api-client';
import { useOrders, useOrder, useDeleteOrder } from 'src/hooks/useOrders';
import { PATHS } from 'src/routes/paths';
import { backOrReplace } from 'src/routes/editorNav';
import { OrderDetail } from './OrderDetail';
import { sortOrdersNewestFirst } from './orderSort';
import { OrderEditor } from './OrderEditor';

// Hash-based avatar tint per client name (OrderListItemDto has no client id,
// only a denormalized name) — same deterministic-hash approach ClientsPage
// uses so a client's color stays stable across renders.
const AVATAR_COLORS = ['#F08C00', '#0E7C9B', '#7C3AED', '#15873F', '#C22A2A', '#B4620A', '#0891B2', '#DB2777'];
function colorFor(str: string): string {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function clientInitials(name: string): string {
  const [a, b] = name.trim().split(/\s+/);
  return `${(a || '?')[0]}${b ? b[0] : ''}`.toUpperCase();
}

type StatusFilter = 'all' | 'New' | 'Planning' | 'Delivering' | 'Finished' | 'Cancelled';
const SEGMENTS: [StatusFilter, string][] = [
  ['all', 'Vše'],
  ['New', 'Nové'],
  ['Planning', 'Plánované'],
  ['Delivering', 'Rozváží se'],
  ['Finished', 'Dokončené'],
  ['Cancelled', 'Zrušené'],
];

export function OrdersPage({ view }: { view?: 'create' | 'edit' }) {
  const { canEdit } = useAuth();
  const editable = canEdit('orders');
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { id } = useParams();

  const list = useOrders();
  const orders = useMemo(() => list.data ?? [], [list.data]);

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [clientSearch, setClientSearch] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const detail = useOrder(view ? undefined : id);
  const del = useDeleteOrder();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const s of ['New', 'Planning', 'Delivering', 'Finished', 'Cancelled']) {
      c[s] = orders.filter((o) => orderStateName(o.state) === s).length;
    }
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const rows = orders.filter((o) => (filter === 'all' || orderStateName(o.state) === filter)
      && (!q || (o.clientName ?? '').toLowerCase().includes(q)));
    return sortOrdersNewestFirst(rows);
  }, [orders, filter, clientSearch]);

  const openCreate = () => navigate(`${PATHS.orders}/new`);

  const doCancel = async () => {
    if (!confirmCancelId) return;
    try {
      await del.mutateAsync(confirmCancelId);
      enqueueSnackbar('Objednávka zrušena.', { variant: 'success' });
      setConfirmCancelId(null);
      navigate(PATHS.orders);
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const columns: Column<OrderListItemDto>[] = [
    {
      key: 'number',
      header: 'Číslo',
      width: 110,
      render: (o) => <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{orderNumber(o.id)}</Typography>,
    },
    {
      key: 'client',
      header: 'Klient',
      render: (o) => {
        const name = o.clientName ?? '—';
        const color = colorFor(name);
        return (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800, fontSize: 12, bgcolor: `${color}22`, color }}>
              {clientInitials(name)}
            </Box>
            <Typography sx={{ fontWeight: 700 }} noWrap>{name}</Typography>
          </Stack>
        );
      },
    },
    {
      key: 'state',
      header: 'Stav',
      render: (o) => {
        const status = ORDER_STATUS[orderStateName(o.state) ?? 'New'] ?? ORDER_STATUS.New;
        return <StatusPill tone={status.tone} label={status.label} />;
      },
    },
    {
      key: 'term',
      header: 'Termín',
      render: (o) => (o.requiredDeliveryDate
        ? <Typography>{fmtDate(o.requiredDeliveryDate)}</Typography>
        : <Typography color="text.disabled">neurčeno</Typography>),
    },
    {
      key: 'delivered',
      header: 'Doručeno',
      render: (o) => (o.actualDeliveryDate
        ? <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{fmtDate(o.actualDeliveryDate)}</Typography>
        : <Typography color="text.disabled">—</Typography>),
    },
    {
      key: 'chevron',
      header: '',
      align: 'right',
      width: 40,
      render: () => <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />,
    },
  ];

  const newOrderButton = editable && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Nová objednávka
    </Button>
  );

  if (view === 'create' || view === 'edit') {
    return (
      <PageContainer>
        <OrderEditor
          mode={view}
          orderId={view === 'edit' ? id : undefined}
          onDone={(savedId) => (view === 'edit'
            ? backOrReplace(navigate, `${PATHS.orders}/${id}`)
            : navigate(`${PATHS.orders}/${savedId}`, { replace: true }))}
          onCancel={() => backOrReplace(navigate, view === 'edit' && id ? `${PATHS.orders}/${id}` : PATHS.orders)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {id ? (
        <QueryBoundary query={detail}>
          {(order) => (
            <OrderDetail
              order={order}
              editable={editable}
              onBack={() => navigate(PATHS.orders)}
              onEdit={() => navigate(`${PATHS.orders}/${id}/edit`)}
              onDelete={() => setConfirmCancelId(id)}
            />
          )}
        </QueryBoundary>
      ) : (
        <>
          <PageHeader
            eyebrow="Prodej"
            title="Objednávky"
            subtitle="Požadavky klientů — co, kolik a do kdy."
            actions={newOrderButton}
          />

          <QueryBoundary
            query={list}
            isEmpty={(rows) => rows.length === 0}
            emptyState={
              <EmptyState
                icon={<ReceiptLongOutlinedIcon />}
                title="Zatím žádné objednávky"
                description="Vytvořte první objednávku pro klienta."
                action={newOrderButton}
              />
            }
          >
            {() => (
              <>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
                  <SegControl
                    value={filter}
                    onChange={setFilter}
                    options={SEGMENTS.map(([value, label]) => ({
                      value,
                      label: (
                        <Box component="span">
                          {label}
                          {counts[value] ? <Box component="span" sx={{ ml: 0.5, opacity: 0.55 }}>{counts[value]}</Box> : null}
                        </Box>
                      ),
                    }))}
                  />
                  <SearchField value={clientSearch} onChange={setClientSearch} placeholder="Hledat klienta…" width={240} />
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
                    {filtered.length} z {orders.length}
                  </Typography>
                </Stack>

                {filtered.length === 0 ? (
                  <EmptyState icon={<ReceiptLongOutlinedIcon />} title="Žádné objednávky v tomto filtru" dense />
                ) : (
                  <Card variant="outlined">
                    <DataTable columns={columns} rows={filtered} getRowKey={(o) => o.id ?? ''} onRowClick={(o) => navigate(`${PATHS.orders}/${o.id}`)} />
                  </Card>
                )}
              </>
            )}
          </QueryBoundary>
        </>
      )}

      <ConfirmDialog
        open={confirmCancelId !== null}
        title="Zrušit objednávku?"
        message="Objednávka bude nastavena jako zrušená a zůstane v historii."
        confirmLabel="Zrušit objednávku"
        busy={del.isPending}
        onConfirm={doCancel}
        onClose={() => setConfirmCancelId(null)}
      />
    </PageContainer>
  );
}
