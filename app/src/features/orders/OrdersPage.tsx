import { useMemo, useState } from 'react';
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useSnackbar } from 'notistack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { DataTable, type Column } from 'src/components/common/DataTable';
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
import { OrderDetail } from './OrderDetail';
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

type StatusFilter = 'all' | 'New' | 'Planning' | 'Delivering' | 'Finished';
const SEGMENTS: [StatusFilter, string][] = [
  ['all', 'Vše'],
  ['New', 'Nové'],
  ['Planning', 'Plánované'],
  ['Delivering', 'Rozváží se'],
  ['Finished', 'Dokončené'],
];

type EditorState = { mode: 'create' } | { mode: 'edit'; id: string } | null;

export function OrdersPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('orders');
  const { enqueueSnackbar } = useSnackbar();

  const list = useOrders();
  const orders = useMemo(() => list.data ?? [], [list.data]);

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const detail = useOrder(selectedId ?? undefined);
  const del = useDeleteOrder();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const s of ['New', 'Planning', 'Delivering', 'Finished']) {
      c[s] = orders.filter((o) => orderStateName(o.state) === s).length;
    }
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) => orderStateName(o.state) === filter);
  }, [orders, filter]);

  const openCreate = () => setEditorState({ mode: 'create' });
  const openEdit = () => { if (selectedId) setEditorState({ mode: 'edit', id: selectedId }); };

  const doCancel = async () => {
    if (!confirmCancelId) return;
    try {
      await del.mutateAsync(confirmCancelId);
      enqueueSnackbar('Objednávka zrušena.', { variant: 'success' });
      setConfirmCancelId(null);
      setSelectedId(null);
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

  if (editorState) {
    return (
      <PageContainer>
        <OrderEditor
          mode={editorState.mode}
          orderId={editorState.mode === 'edit' ? editorState.id : undefined}
          onDone={(id) => { setEditorState(null); setSelectedId(id); }}
          onCancel={() => setEditorState(null)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {selectedId ? (
        <QueryBoundary query={detail}>
          {(order) => (
            <OrderDetail
              order={order}
              editable={editable}
              onBack={() => setSelectedId(null)}
              onEdit={openEdit}
              onDelete={() => setConfirmCancelId(selectedId)}
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
                  <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_e, v: StatusFilter | null) => v && setFilter(v)} sx={{ flexWrap: 'wrap' }}>
                    {SEGMENTS.map(([value, label]) => (
                      <ToggleButton key={value} value={value} sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {label}
                        {counts[value] ? <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>{counts[value]}</Box> : null}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
                    {filtered.length} z {orders.length}
                  </Typography>
                </Stack>

                {filtered.length === 0 ? (
                  <EmptyState icon={<ReceiptLongOutlinedIcon />} title="Žádné objednávky v tomto filtru" dense />
                ) : (
                  <DataTable columns={columns} rows={filtered} getRowKey={(o) => o.id ?? ''} onRowClick={(o) => setSelectedId(o.id ?? null)} />
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
