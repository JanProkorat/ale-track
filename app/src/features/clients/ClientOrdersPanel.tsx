import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { StatusPill } from 'src/components/common/StatusPill';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ORDER_STATUS, orderStateName } from 'src/lib/labels';
import { type OrderListItemDto } from 'src/generated/api-client';
import { useClientOrders } from 'src/hooks/useOrders';
import { sortOrdersNewestFirst } from 'src/features/orders/orderSort';
import { PATHS } from 'src/routes/paths';
import { type DetailBackState } from 'src/routes/backNav';

/** The rows themselves — takes loaded data as a plain prop so the memo above it
 * never runs on a missing query result. */
function ClientOrdersTable({ rows, onOpen }: { rows: OrderListItemDto[]; onOpen: (id: string) => void }) {
  const ordered = useMemo(() => sortOrdersNewestFirst(rows), [rows]);

  // No Klient column — every row here belongs to the client being viewed. The
  // prototype's Položky/Hodnota columns stay out for the same reason they are
  // absent from the orders list: the list DTO carries neither.
  const columns: Column<OrderListItemDto>[] = [
    {
      key: 'number',
      header: 'Číslo',
      width: 110,
      sortValue: (o) => orderNumber(o.id),
      render: (o) => (
        <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{orderNumber(o.id)}</Typography>
      ),
    },
    {
      key: 'state',
      header: 'Stav',
      sortValue: (o) => (ORDER_STATUS[orderStateName(o.state) ?? 'New'] ?? ORDER_STATUS.New).label,
      render: (o) => {
        const status = ORDER_STATUS[orderStateName(o.state) ?? 'New'] ?? ORDER_STATUS.New;
        return <StatusPill tone={status.tone} label={status.label} />;
      },
    },
    {
      key: 'created',
      header: 'Vytvořeno',
      // The tab's default ordering key, so it gets a column of its own — otherwise
      // "newest first" is an order the user can see but not name.
      sortValue: (o) => o.createdDate,
      render: (o) => (o.createdDate
        ? <Typography>{fmtDate(o.createdDate)}</Typography>
        : <Typography color="text.disabled">—</Typography>),
    },
    {
      key: 'term',
      header: 'Termín',
      sortValue: (o) => o.requiredDeliveryDate,
      render: (o) => (o.requiredDeliveryDate
        ? <Typography>{fmtDate(o.requiredDeliveryDate)}</Typography>
        : <Typography color="text.disabled">neurčeno</Typography>),
    },
    {
      key: 'delivered',
      header: 'Doručeno',
      sortValue: (o) => o.actualDeliveryDate,
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

  return (
    <Card variant="outlined">
      {/* No defaultSort: the rows arrive newest-created first and DataTable keeps
          that until a header is clicked. */}
      <DataTable
        columns={columns}
        rows={ordered}
        getRowKey={(o) => o.id ?? ''}
        onRowClick={(o) => o.id && onOpen(o.id)}
        paginated
        pageSizeKey="client-orders"
      />
    </Card>
  );
}

/** Objednávky tab of the client detail: that client's orders, newest first and
 * paged. Scoped server-side by the client's id, so the tab does not depend on
 * the whole orders list being loaded. */
export function ClientOrdersPanel({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const query = useClientOrders(clientId);

  // Opened as a detour from the client, so the order detail's back arrow
  // returns here instead of dropping the user on the orders list — and carries
  // `?tab=orders`, so it lands on this tab rather than the client's Info.
  const openOrder = (orderId: string) => navigate(`${PATHS.orders}/${orderId}`, {
    state: {
      backTo: `${PATHS.clients}/${clientId}?tab=orders`,
      backLabel: 'Zpět na klienta',
    } satisfies DetailBackState,
  });

  return (
    <QueryBoundary
      query={query}
      minHeight={140}
      isEmpty={(rows) => rows.length === 0}
      emptyState={
        <EmptyState
          icon={<ReceiptLongOutlinedIcon />}
          title="Žádné objednávky"
          description="Tento klient zatím nemá žádnou objednávku."
        />
      }
    >
      {(rows) => <ClientOrdersTable rows={rows} onOpen={openOrder} />}
    </QueryBoundary>
  );
}
