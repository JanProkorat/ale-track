import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { StatusPill } from 'src/components/common/StatusPill';
import { useAuth } from 'src/auth/AuthProvider';
import { fmtDate, deliveryNumber } from 'src/lib/format';
import { DELIVERY_STATUS, deliveryStateName } from 'src/lib/labels';
import { type ProductDeliveryListItemDto } from 'src/generated/api-client';
import { useDeliveries, useDelivery } from 'src/hooks/useDeliveries';
import { PATHS } from 'src/routes/paths';
import { backOrReplace } from 'src/routes/editorNav';
import { DeliveryDetail } from './DeliveryDetail';
import { DeliveryEditor } from './DeliveryEditor';

/** Dovozy zboží (incoming product deliveries) — drivers drive to breweries,
 * pick up products and stock them into inventory. List/detail is URL-driven:
 * /deliveries (list), /deliveries/:id (detail), /deliveries/new + /:id/edit. */
export function DeliveriesPage({ view }: { view?: 'create' | 'edit' }) {
  const { canEdit } = useAuth();
  const editable = canEdit('deliveries');
  const navigate = useNavigate();
  const { id } = useParams();

  const list = useDeliveries();
  const detail = useDelivery(view ? undefined : id);

  // Newest delivery date first — expressed as the table's defaultSort rather than a manual
  // pre-sort, so the ordering has one source and the Datum header shows that it is applied.
  // Undated rows stay last either way (dataTableModel sorts blanks last in both directions).
  const rows = useMemo(() => list.data ?? [], [list.data]);

  const openCreate = () => navigate(`${PATHS.deliveries}/new`);

  const columns: Column<ProductDeliveryListItemDto>[] = [
    {
      key: 'number',
      header: 'Číslo',
      width: 110,
      sortValue: (d) => deliveryNumber(d.id),
      render: (d) => <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{deliveryNumber(d.id)}</Typography>,
    },
    {
      key: 'date',
      header: 'Datum',
      sortValue: (d) => d.deliveryDate,
      render: (d) => (d.deliveryDate
        ? <Typography>{fmtDate(d.deliveryDate)}</Typography>
        : <Typography color="text.disabled">neurčeno</Typography>),
    },
    {
      key: 'breweries',
      header: 'Pivovary',
      // A row can carry several breweries; sort on the first name shown so the ordering
      // matches the leading chip rather than an invisible join of all of them.
      sortValue: (d) => (d.stopNames ?? [])[0],
      render: (d) => (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {(d.stopNames ?? []).length === 0
            ? <Typography color="text.disabled">—</Typography>
            : (d.stopNames ?? []).map((name, i) => (
              <Box key={i} component="span" sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: 'action.hover', fontSize: 12.5, fontWeight: 600 }}>
                {name}
              </Box>
            ))}
        </Stack>
      ),
    },
    {
      key: 'state',
      header: 'Stav',
      sortValue: (d) =>
        (DELIVERY_STATUS[deliveryStateName(d.state) ?? 'InPlanning'] ?? DELIVERY_STATUS.InPlanning).label,
      render: (d) => {
        const status = DELIVERY_STATUS[deliveryStateName(d.state) ?? 'InPlanning'] ?? DELIVERY_STATUS.InPlanning;
        return <StatusPill tone={status.tone} label={status.label} />;
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

  const newDeliveryButton = editable && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Nový dovoz
    </Button>
  );

  // Phone layout: number and date lead, the brewery chips wrap freely below.
  const deliveryCard = (d: ProductDeliveryListItemDto) => {
    const status = DELIVERY_STATUS[deliveryStateName(d.state) ?? 'InPlanning'] ?? DELIVERY_STATUS.InPlanning;
    const stops = d.stopNames ?? [];
    return (
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13, flex: 1, minWidth: 0 }}>
            {deliveryNumber(d.id)}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: d.deliveryDate ? 'text.secondary' : 'text.disabled' }}>
            {d.deliveryDate ? fmtDate(d.deliveryDate) : 'neurčeno'}
          </Typography>
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
        </Stack>
        {stops.length > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {stops.map((name, i) => (
              <Box key={i} component="span" sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: 'action.hover', fontSize: 12.5, fontWeight: 600 }}>
                {name}
              </Box>
            ))}
          </Stack>
        )}
        <StatusPill tone={status.tone} label={status.label} />
      </Stack>
    );
  };

  if (view === 'create' || view === 'edit') {
    return (
      <PageContainer>
        <DeliveryEditor
          mode={view}
          deliveryId={view === 'edit' ? id : undefined}
          onDone={(savedId) => (view === 'edit'
            ? backOrReplace(navigate, `${PATHS.deliveries}/${id}`)
            : navigate(`${PATHS.deliveries}/${savedId}`, { replace: true }))}
          onCancel={() => backOrReplace(navigate, view === 'edit' && id ? `${PATHS.deliveries}/${id}` : PATHS.deliveries)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {id ? (
        <QueryBoundary query={detail}>
          {(delivery) => (
            <DeliveryDetail
              delivery={delivery}
              editable={editable}
              onBack={() => navigate(PATHS.deliveries)}
              onEdit={() => navigate(`${PATHS.deliveries}/${id}/edit`)}
            />
          )}
        </QueryBoundary>
      ) : (
        <>
          <PageHeader
            eyebrow="Sklad"
            title="Dovozy zboží"
            subtitle="Navážení zboží z pivovarů na firemní sklad."
            actions={newDeliveryButton}
          />

          <QueryBoundary
            query={list}
            isEmpty={(data) => data.length === 0}
            emptyState={
              <EmptyState
                icon={<WarehouseOutlinedIcon />}
                title="Zatím žádné dovozy"
                description="Naplánujte první navezení zboží z pivovarů na sklad."
                action={newDeliveryButton}
              />
            }
          >
            {() => (
              <>
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.25 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
                    {rows.length} {rows.length === 1 ? 'dovoz' : rows.length >= 2 && rows.length <= 4 ? 'dovozy' : 'dovozů'}
                  </Typography>
                </Stack>
                <Card variant="outlined">
                  <DataTable
                    columns={columns}
                    rows={rows}
                    getRowKey={(d) => d.id ?? ''}
                    onRowClick={(d) => navigate(`${PATHS.deliveries}/${d.id}`)}
                    mobileCard={deliveryCard}
                    paginated
                    pageSizeKey="deliveries"
                    defaultSort={{ key: 'date', direction: 'desc' }}
                  />
                </Card>
              </>
            )}
          </QueryBoundary>
        </>
      )}
    </PageContainer>
  );
}
