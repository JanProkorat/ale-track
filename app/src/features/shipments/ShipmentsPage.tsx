import { useState } from 'react';
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
import { fmtDate } from 'src/lib/format';
import { SHIP_STATUS, shipStateName } from 'src/lib/labels';
import { type OutgoingShipmentListItemDto } from 'src/generated/api-client';
import { useShipments, useShipment } from 'src/hooks/useShipments';
import { ShipmentDetail } from './ShipmentDetail';
import { ShipmentEditor } from './ShipmentEditor';

type EditorState = { mode: 'create' } | { mode: 'edit'; id: string } | null;

/** Vývozy (Outgoing Shipments) — the app's most complex screen: route
 * planning, invoice-split nakládka and delivery-state advancement. List/detail
 * master-detail pattern matches OrdersPage exactly. */
export function ShipmentsPage() {
  const { canEdit } = useAuth();
  const editable = canEdit('shipments');

  const list = useShipments();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(null);

  const detail = useShipment(selectedId ?? undefined);

  const openCreate = () => setEditorState({ mode: 'create' });
  const openEdit = () => { if (selectedId) setEditorState({ mode: 'edit', id: selectedId }); };

  const columns: Column<OutgoingShipmentListItemDto>[] = [
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

  if (editorState) {
    return (
      <PageContainer>
        <ShipmentEditor
          mode={editorState.mode}
          shipmentId={editorState.mode === 'edit' ? editorState.id : undefined}
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
          {(shipment) => (
            <ShipmentDetail
              shipment={shipment}
              editable={editable}
              onBack={() => setSelectedId(null)}
              onEdit={openEdit}
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
                  <DataTable columns={columns} rows={rows} getRowKey={(s) => s.id ?? ''} onRowClick={(s) => setSelectedId(s.id ?? null)} />
                </Card>
              </>
            )}
          </QueryBoundary>
        </>
      )}
    </PageContainer>
  );
}
