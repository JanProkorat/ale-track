import { useNavigate, useParams } from 'react-router-dom';
import { Card, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { StatusPill } from 'src/components/common/StatusPill';
import { useAuth } from 'src/auth/AuthProvider';
import { fmtDate, shipmentNumber } from 'src/lib/format';
import { SHIP_STATUS, shipStateName } from 'src/lib/labels';
import { type OutgoingShipmentListItemDto } from 'src/generated/api-client';
import { useShipments, useShipment } from 'src/hooks/useShipments';
import { PATHS } from 'src/routes/paths';
import { backOrReplace } from 'src/routes/editorNav';
import { ShipmentDetail } from './ShipmentDetail';
import { ShipmentEditor } from './ShipmentEditor';

/** Vývozy (Outgoing Shipments) — the app's most complex screen: route
 * planning, invoice-split nakládka and delivery-state advancement. List/detail
 * is URL-driven: /shipments (list), /shipments/:id (detail), /shipments/new + /:id/edit. */
export function ShipmentsPage({ view }: { view?: 'create' | 'edit' }) {
  const { canEdit } = useAuth();
  const editable = canEdit('shipments');
  const navigate = useNavigate();
  const { id } = useParams();

  const list = useShipments();
  const detail = useShipment(view ? undefined : id);

  const openCreate = () => navigate(`${PATHS.shipments}/new`);

  const columns: Column<OutgoingShipmentListItemDto>[] = [
    {
      key: 'number',
      header: 'Číslo',
      width: 110,
      render: (s) => <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{shipmentNumber(s.id)}</Typography>,
    },
    {
      key: 'name',
      header: 'Název',
      render: (s) => <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>,
    },
    {
      key: 'state',
      header: 'Stav',
      render: (s) => {
        const status = SHIP_STATUS[shipStateName(s.state) ?? 'Created'] ?? SHIP_STATUS.Created;
        return <StatusPill tone={status.tone} label={status.label} />;
      },
    },
    {
      key: 'date',
      header: 'Datum',
      render: (s) => (s.deliveryDate
        ? <Typography>{fmtDate(s.deliveryDate)}</Typography>
        : <Typography color="text.disabled">termín neurčen</Typography>),
    },
    {
      key: 'chevron',
      header: '',
      align: 'right',
      width: 40,
      render: () => <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />,
    },
  ];

  const newShipmentButton = editable && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Naplánovat vývoz
    </Button>
  );

  if (view === 'create' || view === 'edit') {
    return (
      <PageContainer>
        <ShipmentEditor
          mode={view}
          shipmentId={view === 'edit' ? id : undefined}
          onDone={(savedId) => (view === 'edit'
            ? backOrReplace(navigate, `${PATHS.shipments}/${id}`)
            : navigate(`${PATHS.shipments}/${savedId}`, { replace: true }))}
          onCancel={() => backOrReplace(navigate, view === 'edit' && id ? `${PATHS.shipments}/${id}` : PATHS.shipments)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {id ? (
        <QueryBoundary query={detail}>
          {(shipment) => (
            <ShipmentDetail
              shipment={shipment}
              editable={editable}
              onBack={() => navigate(PATHS.shipments)}
              onEdit={() => navigate(`${PATHS.shipments}/${id}/edit`)}
            />
          )}
        </QueryBoundary>
      ) : (
        <>
          <PageHeader
            eyebrow="Prodej"
            title="Vývozy"
            subtitle="Plánování rozvozů ke klientům s optimalizací trasy."
            actions={newShipmentButton}
          />

          <QueryBoundary
            query={list}
            isEmpty={(rows) => rows.length === 0}
            emptyState={
              <EmptyState
                icon={<LocalShippingOutlinedIcon />}
                title="Zatím žádné vývozy"
                description="Naplánujte první rozvoz objednávek ke klientům."
                action={newShipmentButton}
              />
            }
          >
            {(rows) => (
              <>
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.25 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.disabled' }}>
                    {rows.length} vývozů
                  </Typography>
                </Stack>
                <Card variant="outlined">
                  <DataTable columns={columns} rows={rows} getRowKey={(s) => s.id ?? ''} onRowClick={(s) => navigate(`${PATHS.shipments}/${s.id}`)} />
                </Card>
              </>
            )}
          </QueryBoundary>
        </>
      )}
    </PageContainer>
  );
}
