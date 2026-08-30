import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Card, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { SegControl } from 'src/components/common/SegControl';
import { SearchField } from 'src/components/common/SearchField';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { EmptyState } from 'src/components/common/EmptyState';
import { StatusPill } from 'src/components/common/StatusPill';
import { useAuth } from 'src/auth/AuthProvider';
import { fmtDate, shipmentNumber } from 'src/lib/format';
import { SHIP_STATUS, shipStateName } from 'src/lib/labels';
import { type OutgoingShipmentListItemDto } from 'src/generated/api-client';
import { useShipments, useShipment } from 'src/hooks/useShipments';
import { useDrivers } from 'src/hooks/useDrivers';
import { PATHS } from 'src/routes/paths';
import { backOrReplace } from 'src/routes/editorNav';
import { detailBackState, type DetailBackState } from 'src/routes/backNav';
import { ShipmentDetail } from './ShipmentDetail';
import { ShipmentEditor } from './ShipmentEditor';

/**
 * The list's state segments, in the order a run passes through them.
 *
 * Labelled from `SHIP_STATUS` rather than a second vocabulary: a segment reading one word and
 * the pill in the row beneath it another would be two names for one state. A cancelled run is
 * soft-deleted but not filtered out of this list, so it earns a segment like the rest.
 */
const SEGMENT_STATES = ['Created', 'Loaded', 'InTransit', 'Delivered', 'Cancelled'] as const;
type StateFilter = 'all' | (typeof SEGMENT_STATES)[number];

/** Vývozy (Outgoing Shipments) — the app's most complex screen: route
 * planning, invoice-split nakládka and delivery-state advancement. List/detail
 * is URL-driven: /shipments (list), /shipments/:id (detail), /shipments/new + /:id/edit. */
export function ShipmentsPage({ view }: { view?: 'create' | 'edit' }) {
  const { canEdit, canSee, can, isDriverScoped } = useAuth();
  const editable = canEdit('shipments');
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Set when the detail was opened from another screen (an order's vývoz card)
  // — that screen, not the vývozy list, is where Back belongs.
  const backTarget = detailBackState(location.state);

  const list = useShipments();
  const detail = useShipment(view ? undefined : id);

  const shipments = useMemo(() => list.data ?? [], [list.data]);
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: shipments.length };
    for (const state of SEGMENT_STATES) {
      c[state] = shipments.filter((s) => shipStateName(s.state) === state).length;
    }
    return c;
  }, [shipments]);

  // Filtered here rather than through the endpoint's parameters: the whole list is already
  // loaded, and a round trip per keystroke would be slower than the filter it replaces.
  // Order is preserved, so the newest-created-first the endpoint returns still holds.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // The number as well as the name: it is the column people read first, and a run named
    // "Rozvoz Žitava" is easier to find by the number printed on its paperwork.
    const matches = (s: OutgoingShipmentListItemDto) => !q
      || (s.name ?? '').toLowerCase().includes(q)
      || shipmentNumber(s.id).toLowerCase().includes(q);
    return shipments.filter((s) =>
      (stateFilter === 'all' || shipStateName(s.state) === stateFilter) && matches(s));
  }, [shipments, stateFilter, search]);
  // A linked driver seeing no shipments is normal (their last run finished); only an
  // unlinked account is actually broken. useDrivers() tells the two apart the same way
  // DriversPage does — its own row shows up (or does not) for a driver-scoped caller.
  const drivers = useDrivers();
  const driversLoaded = drivers.data !== undefined;
  const driverNotLinked = driversLoaded && drivers.data!.length === 0;

  const openCreate = () => navigate(`${PATHS.shipments}/new`);

  const columns: Column<OutgoingShipmentListItemDto>[] = [
    {
      key: 'number',
      header: 'Číslo',
      width: 110,
      sortValue: (s) => shipmentNumber(s.id),
      render: (s) => <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{shipmentNumber(s.id)}</Typography>,
    },
    {
      key: 'name',
      header: 'Název',
      sortValue: (s) => s.name,
      render: (s) => <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>,
    },
    {
      key: 'state',
      header: 'Stav',
      sortValue: (s) => (SHIP_STATUS[shipStateName(s.state) ?? 'Created'] ?? SHIP_STATUS.Created).label,
      render: (s) => {
        const status = SHIP_STATUS[shipStateName(s.state) ?? 'Created'] ?? SHIP_STATUS.Created;
        return <StatusPill tone={status.tone} label={status.label} />;
      },
    },
    {
      key: 'date',
      header: 'Datum',
      sortValue: (s) => s.deliveryDate,
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

  // A driver may never create a shipment — the API refuses it regardless, and the
  // control follows so the screen matches what is possible, same as DriversPage's
  // canManageRoster.
  const newShipmentButton = editable && !isDriverScoped && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Naplánovat vývoz
    </Button>
  );

  // Phone layout: the name identifies the shipment, state and date sit below it.
  const shipmentCard = (s: OutgoingShipmentListItemDto) => {
    const status = SHIP_STATUS[shipStateName(s.state) ?? 'Created'] ?? SHIP_STATUS.Created;
    return (
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{s.name}</Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>
              {shipmentNumber(s.id)}
            </Typography>
          </Box>
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusPill tone={status.tone} label={status.label} />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 12.5, color: s.deliveryDate ? 'text.secondary' : 'text.disabled' }}>
            {s.deliveryDate ? fmtDate(s.deliveryDate) : 'termín neurčen'}
          </Typography>
        </Stack>
      </Stack>
    );
  };

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
              // Resolved here rather than inside the detail, same as `editable`:
              // the screen stays renderable without an auth provider.
              canSeeInvoicing={can('Invoicing')}
              canSeeLoadingBreakdown={can('LoadingBreakdown')}
              // The ledger is a client record, so recording a deviation needs Clients : Edit —
              // a driver phones the dispatcher, who writes it down.
              canRecordLedger={canEdit('clients')}
              onBack={() => navigate(backTarget?.backTo ?? PATHS.shipments)}
              backLabel={backTarget?.backLabel}
              onEdit={() => navigate(`${PATHS.shipments}/${id}/edit`)}
              // The order is opened as a detour from this vývoz, so it carries
              // the way back with it — its own back arrow returns here rather
              // than dropping the user on the orders list.
              onOpenOrder={canSee('orders')
                ? (orderId) => navigate(`${PATHS.orders}/${orderId}`, {
                  state: {
                    backTo: `${PATHS.shipments}/${id}`,
                    backLabel: 'Zpět na vývoz',
                  } satisfies DetailBackState,
                })
                : undefined}
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
                title={isDriverScoped ? 'Žádné vývozy' : 'Zatím žádné vývozy'}
                description={
                  !isDriverScoped
                    ? 'Naplánujte první rozvoz objednávek ke klientům.'
                    // Defaults to the driver-appropriate copy while the drivers query is
                    // still loading, so an actually-linked driver never sees the "not
                    // linked" message flash before it — only a confirmed empty drivers
                    // list earns that message.
                    : driverNotLinked
                      ? 'Účet zatím není propojen s řidičem — kontaktujte správce.'
                      : 'Zatím vám nebyl přiřazen žádný vývoz.'
                }
                action={newShipmentButton}
              />
            }
          >
            {() => (
              <>
                <Stack
                  direction={{ xs: 'column', compact: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', compact: 'center' }}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ mb: 2 }}
                >
                  <SegControl
                    value={stateFilter}
                    onChange={setStateFilter}
                    options={[
                      { value: 'all' as StateFilter, label: 'Vše' },
                      ...SEGMENT_STATES.map((state) => ({
                        value: state as StateFilter,
                        label: SHIP_STATUS[state].label,
                      })),
                    ].map(({ value, label }) => ({
                      value,
                      label: (
                        <Box component="span">
                          {label}
                          {counts[value] ? <Box component="span" sx={{ ml: 0.5, opacity: 0.55 }}>{counts[value]}</Box> : null}
                        </Box>
                      ),
                    }))}
                  />
                  <SearchField
                    value={search}
                    onChange={setSearch}
                    placeholder="Hledat vývoz…"
                    width={{ xs: '100%', compact: 240 }}
                  />
                  <Box sx={{ flex: 1, display: { xs: 'none', compact: 'block' } }} />
                  {/* Redundant on a phone — the active "Vše 460" segment already says it. */}
                  <Typography
                    sx={{
                      display: { xs: 'none', compact: 'block' },
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'text.disabled',
                    }}
                  >
                    {filtered.length} z {shipments.length}
                  </Typography>
                </Stack>

                {filtered.length === 0 ? (
                  <EmptyState icon={<LocalShippingOutlinedIcon />} title="Žádné vývozy v tomto filtru" dense />
                ) : (
                  <Card variant="outlined">
                    {/* No defaultSort: the endpoint already returns the list newest-created
                        first (createdDate has no column of its own), and DataTable keeps
                        that order until a header is clicked. The delivery date is a
                        planning field that moves, so it never decided the list's order. */}
                    <DataTable
                      columns={columns}
                      rows={filtered}
                      getRowKey={(s) => s.id ?? ''}
                      onRowClick={(s) => navigate(`${PATHS.shipments}/${s.id}`)}
                      mobileCard={shipmentCard}
                      paginated
                      pageSizeKey="shipments"
                      pageResetKey={`${stateFilter}|${search}`}
                    />
                  </Card>
                )}
              </>
            )}
          </QueryBoundary>
        </>
      )}
    </PageContainer>
  );
}
