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

  const rows = useMemo(() => {
    const data = list.data ?? [];
    // Newest delivery date first.
    return [...data].sort((a, b) => {
      const ta = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
      const tb = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
      return tb - ta;
    });
  }, [list.data]);

  const openCreate = () => navigate(`${PATHS.deliveries}/new`);

  const columns: Column<ProductDeliveryListItemDto>[] = [
    {
      key: 'number',
      header: 'Číslo',
      width: 110,
      render: (d) => <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{deliveryNumber(d.id)}</Typography>,
    },
    {
      key: 'date',
      header: 'Datum',
      render: (d) => (d.deliveryDate
        ? <Typography>{fmtDate(d.deliveryDate)}</Typography>
        : <Typography color="text.disabled">neurčeno</Typography>),
    },
    {
      key: 'breweries',
      header: 'Pivovary',
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

  if (view === 'create' || view === 'edit') {
    return (
      <PageContainer>
        <DeliveryEditor
          mode={view}
          deliveryId={view === 'edit' ? id : undefined}
          onDone={(savedId) => navigate(`${PATHS.deliveries}/${savedId}`)}
          onCancel={() => navigate(view === 'edit' && id ? `${PATHS.deliveries}/${id}` : PATHS.deliveries)}
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
                  <DataTable columns={columns} rows={rows} getRowKey={(d) => d.id ?? ''} onRowClick={(d) => navigate(`${PATHS.deliveries}/${d.id}`)} />
                </Card>
              </>
            )}
          </QueryBoundary>
        </>
      )}
    </PageContainer>
  );
}
