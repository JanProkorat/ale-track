import { useEffect, useState } from 'react';
import { Box, Button, Card, Chip, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNoneOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveOutlined';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOffOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardOutlined';
import { useSnackbar } from 'notistack';
import { StatusPill } from 'src/components/common/StatusPill';
import { DetailHeader } from 'src/components/common/DetailHeader';
import { CollapsibleCard } from 'src/components/common/CollapsibleCard';
import { PriceWithList } from 'src/components/common/PriceWithList';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, orderNumber, shipmentNumber } from 'src/lib/format';
import { ORDER_STATUS, SHIP_STATUS, chargeKindLabel, orderStateName, reminderStateName, reminderStateValue, shipStateName } from 'src/lib/labels';
import { OrderItemReminderState, type OrderDto, type OrderOutgoingShipmentDto } from 'src/generated/api-client';
import { useSetOrderItemReminderState } from 'src/hooks/useReminders';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { formatAddressOrCoords } from 'src/features/clients/deliveryPlaceFormat';
import { useClientLedger } from 'src/hooks/useClientLedger';
import {
  addressEntry, applyLedger, entriesForOrder, entriesForTarget, planRow,
  type DecoratedRow,
} from 'src/features/clients/ledgerModel';
import { LedgerRowTag, QuantityDiff, TextDiff } from 'src/features/clients/LedgerDiff';
import { LedgerMoneyCard } from 'src/features/clients/LedgerMoneyCard';
import { LedgerEntryDrawer } from 'src/features/clients/LedgerEntryDrawer';
import {
  RECORD_CHANGE_LABEL, RECORD_CHANGE_SHORT, recordButtonSx,
} from 'src/features/clients/ledgerStyles';
import { ClientOpenItemsCard } from 'src/features/clients/ClientOpenItemsCard';

const FLOW = ['New', 'Planning', 'Delivering', 'Finished'];

function StatusFlow({ stateName }: { stateName: string }) {
  const current = FLOW.indexOf(stateName);
  return (
    <Card sx={{ mb: 2, p: 2 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {FLOW.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <Box key={s} sx={{ flex: '1 1 120px', minWidth: 120, textAlign: 'center' }}>
              <Box sx={{ height: 5, borderRadius: 999, mb: 1, bgcolor: i <= current ? 'warning.main' : 'divider' }} />
              <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{
                color: active ? 'warning.dark' : done ? 'text.primary' : 'text.disabled',
                fontWeight: active ? 800 : 600, fontSize: 12.5,
              }}>
                {done && <CheckIcon sx={{ fontSize: 14 }} />}
                <span>{ORDER_STATUS[s]?.label ?? s}</span>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}

/** The vývoz carrying this order: which run, when it goes, who drives it, and
 *  where in the route this stop sits. Mirrors the shipment detail's order list,
 *  which links the other way. */
function ShipmentCard({ shipment, onOpen, isInvoiceReady = false }: {
  shipment: OrderOutgoingShipmentDto;
  onOpen: () => void;
  /**
   * Whether this order's Fakturace row is finished, which is what opens recording a deviation
   * against it — see the chip below.
   */
  isInvoiceReady?: boolean;
}) {
  const status = SHIP_STATUS[shipStateName(shipment.state) ?? 'Created'] ?? SHIP_STATUS.Created;
  const drivers = shipment.driverNames ?? [];
  // Crew and vehicle are both assigned late, so either can still be missing.
  const crew = [drivers.join(', '), shipment.vehicleName].filter(Boolean).join(' · ');

  return (
    <CollapsibleCard
      title="Vývoz"
      icon={<LocalShippingOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
    >
      <Box sx={{ px: 2.5, py: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
          <Typography sx={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 14 }}>
            {shipmentNumber(shipment.id)}
          </Typography>
          <StatusPill tone={status.tone} label={status.label} />
          {/* Why the Zaznamenat změnu button is there — or, read the other way, why it is not.
              Without it the button simply appeared and the office had no way to tell what had
              changed about the order. It sits beside the run's own state because that is the
              other half of the same sentence: where the goods are, and whether the paper is
              closed. Shown whether or not this user may record, because the state of the
              paperwork is worth knowing either way. */}
          {isInvoiceReady && (
            <Tooltip title="Fakturační řádek je označený jako hotový, takže k objednávce lze zaznamenat změnu.">
              <Chip
                size="small"
                icon={<CheckCircleIcon sx={{ fontSize: 15 }} />}
                label="Faktura hotová"
                sx={{
                  fontWeight: 700,
                  height: 20,
                  color: 'success.main',
                  bgcolor: (t) => t.vars!.palette.brand.okTint,
                  '& .MuiChip-icon': { color: 'success.main' },
                }}
              />
            </Tooltip>
          )}
        </Stack>

        <Typography sx={{ fontWeight: 700 }}>{shipment.name}</Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {shipment.deliveryDate ? fmtDate(shipment.deliveryDate) : 'termín neurčen'}
          {crew && ` · ${crew}`}
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          Zastávka {shipment.stopOrder} z {shipment.stopCount}
        </Typography>

        <Button
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={onOpen}
          sx={{ mt: 1.5, color: 'text.primary', borderColor: 'divider', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}
        >
          Otevřít vývoz
        </Button>
      </Box>
    </CollapsibleCard>
  );
}

export function OrderDetail({
  order,
  editable,
  onBack,
  backLabel = 'Zpět na objednávky',
  onEdit,
  onDelete,
  onOpenShipment,
  canRecordDeviation = false,
}: {
  order: OrderDto;
  editable: boolean;
  onBack: () => void;
  /** Overridden when the order was opened from another screen and Back returns
   *  there — see `DetailBackState`. */
  backLabel?: string;
  onEdit: () => void;
  onDelete: () => void;
  /** Opens the vývoz carrying this order. Left undefined when the user cannot
   *  see the Vývozy module, which hides the shipment chip and card outright —
   *  resolved by the page, like `editable`, so the detail stays renderable
   *  without an auth provider. */
  onOpenShipment?: (shipmentId: string) => void;
  /** Whether the user may record a deviation — the ledger rides on Clients : Edit, not Orders. */
  canRecordDeviation?: boolean;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();
  const setReminderState = useSetOrderItemReminderState();
  const items = order.orderItems ?? [];
  const returns = order.returns ?? [];
  const notes = order.notes ?? [];
  const extras = order.customExtraItems ?? [];
  const goodItems = order.supplierGoodItems ?? [];
  const stateName = orderStateName(order.state) ?? 'New';
  const canEditOrder = stateName !== 'Finished' && stateName !== 'Cancelled';
  const status = ORDER_STATUS[stateName] ?? ORDER_STATUS.New;

  // 'all', not 'open': what came off the van is a permanent fact about that handover, so
  // settling the debt afterwards must not put the plan back on this screen.
  const ledger = useClientLedger(order.client?.id, 'all');
  const orderEntries = entriesForOrder(ledger.data ?? [], order.id);

  // Each collection is diffed against its own target — applyLedger appends what it cannot
  // match, so feeding it the whole ledger would drop a returned crate into the items list.
  const itemRows = applyLedger(
    items.map((it) => planRow(it.id, it.productName, it.quantity)),
    entriesForTarget(orderEntries, 'ProductQuantity'),
  );
  const goodRows = applyLedger(
    goodItems.map((g) => planRow(g.id, g.goodName, g.quantity)),
    entriesForTarget(orderEntries, 'SupplierGoodQuantity'),
  );
  const returnRows = applyLedger(
    returns.map((r) => planRow(r.id, r.name, r.quantity)),
    entriesForTarget(orderEntries, 'ReturnQuantity'),
  );
  const extraRows = applyLedger(
    extras.map((e) => planRow(e.id, e.description, e.quantity)),
    entriesForTarget(orderEntries, 'CustomExtraQuantity'),
  );
  const movedTo = addressEntry(orderEntries);

  const [recording, setRecording] = useState(false);

  // Offered once this order's Fakturace row is marked finished — not on the order's state.
  //
  // State said "the van has left", which is a different question: the papers need not be done at
  // Naloženo, and this screen would then be offering Upravit — editing the plan — under finished
  // paperwork while the run's own Vykládka already offered recording. One flag, both screens.
  const canRecordNow = canRecordDeviation && (order.isInvoiceReady ?? false);

  // The plan the drawer diffs against is the order's own quantity, which is also what was
  // loaded: content freezes when the truck is packed, so the two cannot diverge. (The prototype
  // shows an "objednáno 4, naloženo 6" case; the real model has no way to load more than the
  // order says, so that line has nothing to render.)
  const drawerContext = {
    clientId: order.client?.id ?? '',
    clientName: order.client?.name ?? '—',
    orderId: order.id,
    orderLabel: [orderNumber(order.id), status.label].filter(Boolean).join(' · '),
    // No kind or package size on the order's item DTO — the order screen never showed them, so
    // the drawer's rows carry the name alone rather than the chip the prototype draws.
    items: items.map((it) => planRow(it.id, it.productName, it.quantity)),
    goods: goodItems.map((g) => planRow(g.id, g.goodName, g.quantity, g.goodSize)),
    returns: returns.map((r) => planRow(r.id, r.name, r.quantity)),
    extras: extras.map((e) => planRow(e.id, e.description, e.quantity)),
    entries: orderEntries,
  };

  // Row lookups by line id, so the existing item and good tables keep their own markup and
  // only borrow the diff. A row appended by the ledger has no planned line to attach to and is
  // rendered separately below the table.
  const rowFor = (rows: DecoratedRow[], id: string | undefined) => rows.find((r) => r.key === id);
  const appended = (rows: DecoratedRow[], planned: Array<string | undefined>) =>
    rows.filter((r) => !planned.includes(r.key));

  // What the order is worth as delivered. Only the priced lines count: a product taken at the
  // door carries no price on the order at all — it is priced on the invoice — so including it
  // would make the sum disagree with the money column beside it.
  const deliveredTotal = itemRows.reduce((sum, row) => {
    const item = items.find((i) => i.id === row.key);
    return sum + (item?.unitPriceWithVat ?? 0) * row.actualQuantity;
  }, 0) + goodRows.reduce((sum, row) => {
    const good = goodItems.find((g) => g.id === row.key);
    return sum + (good?.unitPriceWithVat ?? 0) * row.actualQuantity;
  }, 0);

  const plannedTotal =
    items.reduce((sum, it) => sum + (it.unitPriceWithVat ?? 0) * (it.quantity ?? 0), 0)
    + goodItems.reduce((sum, g) => sum + (g.unitPriceWithVat ?? 0) * (g.quantity ?? 0), 0);

  // Optimistic per-item reminder-state overrides, cleared when fresh order data
  // arrives (the refetch after a successful update carries the persisted value).
  const [override, setOverride] = useState<Map<string, OrderItemReminderState | undefined>>(new Map());
  const [menu, setMenu] = useState<{ anchor: HTMLElement; itemId: string } | null>(null);
  useEffect(() => { setOverride(new Map()); }, [order]);

  const effState = (id: string, wire?: OrderItemReminderState | string | number): OrderItemReminderState | undefined =>
    override.has(id) ? override.get(id) : reminderStateValue(wire);

  const setReminder = async (itemId: string, value: OrderItemReminderState | undefined) => {
    setMenu(null);
    const prev = override;
    setOverride((m) => new Map(m).set(itemId, value));
    try {
      await setReminderState.mutateAsync({ itemId, orderId: order.id ?? undefined, state: value });
      enqueueSnackbar('Hlídání položky aktualizováno.', { variant: 'success' });
    } catch (e) {
      setOverride(prev);
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  const menuState = menu ? reminderStateName(effState(menu.itemId, items.find((x) => x.id === menu.itemId)?.reminderState)) : 'None';

  // Shown only when the order is actually on a run and the user may open it;
  // an unplanned order (or a cancelled run, which the API projects as none)
  // says nothing about vývozy at all.
  const shipment = order.outgoingShipment && onOpenShipment ? order.outgoingShipment : undefined;
  const openShipment = () => shipment?.id && onOpenShipment?.(shipment.id);

  // Every sidebar card hides when empty, so the whole column can be absent.
  // Counts the diffed rows rather than the stored ones: a return handed over against an order
  // that planned none exists only as a deviation, and hiding the column would leave the
  // commonest surprise of the feature nowhere to show.
  const hasSidebar = returnRows.length > 0 || extraRows.length > 0 || notes.length > 0
    || shipment !== undefined || orderEntries.length > 0
    || (ledger.data ?? []).some((e) => !e.resolvedAt);

  // Once it has arrived the deadline is history — show when it actually landed.
  // Before that the deadline is the number people work to; the creation date is
  // only a last resort for an order with no term yet.
  // No colon: the label reads as prose inside the header's dot-separated meta line.
  const headerDate = order.actualDeliveryDate
    ? { label: 'Doručeno', value: fmtDate(order.actualDeliveryDate) }
    : order.requiredDeliveryDate
      ? { label: 'Doručit nejpozději', value: fmtDate(order.requiredDeliveryDate) }
      : { label: 'Vytvořeno', value: fmtDate(order.createdDate) };

  return (
    <Box>
      <DetailHeader
        onBack={onBack}
        backLabel={backLabel}
        title={orderNumber(order.id)}
        titleMono
        lead={order.client?.name ?? '—'}
        status={<StatusPill tone={status.tone} label={status.label} />}
        meta={[
          <>
            {headerDate.label}{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>{headerDate.value}</Box>
          </>,
          <>
            <PlaceOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
            <Box component="span" sx={{ minWidth: 0 }}>
              {/* Where it was meant to go, struck through, beside where it went. The diff
                  belongs here rather than in a second banner: AddressChangedBanner already
                  holds the top of the shipment, and two strips compete for one glance. */}
              {movedTo
                ? <TextDiff before={movedTo.plannedText} after={movedTo.actualText} />
                : formatAddressOrCoords(order.deliveryAddress?.address)}
            </Box>
          </>,
          order.deliveryAddress?.placeName && (
            <Chip size="small" label={order.deliveryAddress.placeName} sx={{ fontWeight: 700, height: 20 }} />
          ),
          order.deliveryAddress?.placeNote,
          shipment && (
            <Chip
              size="small"
              clickable
              onClick={openShipment}
              icon={<LocalShippingOutlinedIcon sx={{ fontSize: 15 }} />}
              label={`Vývoz ${shipmentNumber(shipment.id)}`}
              sx={{ fontWeight: 700, height: 20 }}
            />
          ),
        ]}
        actions={(
          <>
            {editable && canEditOrder && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={onEdit}
                sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', fontWeight: 700, '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' } }}
              >
                Upravit
              </Button>
            )}
            {canRecordNow && (
              <Tooltip title={RECORD_CHANGE_LABEL}>
                {/* Short on the face, full phrase as the accessible name — "Změna" beside
                    "Upravit" is terse enough that a screen reader should still hear the verb. */}
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setRecording(true)}
                  aria-label={RECORD_CHANGE_LABEL}
                  sx={recordButtonSx}
                >
                  {RECORD_CHANGE_SHORT}
                </Button>
              </Tooltip>
            )}
            {editable && (
              <IconButton color="error" onClick={onDelete} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }} aria-label="Zrušit objednávku">
                <DeleteIcon />
              </IconButton>
            )}
          </>
        )}
      />

      {stateName !== 'Cancelled' && <StatusFlow stateName={stateName} />}

      {/* Two columns on md+ (items | sidebar), stacked in DOM order below that.
          With nothing to put in the sidebar the second column is dropped
          entirely rather than left as dead space beside the items. */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: hasSidebar ? '1.5fr 1fr' : '1fr' }, alignItems: 'start' }}>
        <CollapsibleCard title="Položky" count={items.length + goodItems.length}>
          <Box sx={{ px: 2.5, py: 1 }}>
            {items.length === 0 && goodItems.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Objednávka nemá žádné položky.</Typography>
            ) : (
              <Box sx={{ '& > div': { display: 'flex', alignItems: 'flex-start', py: 1.25, borderBottom: 1, borderColor: 'divider' }, '& > div:last-of-type': { borderBottom: 0 } }}>
                {items.map((it) => {
                  const rs = reminderStateName(effState(it.id ?? '', it.reminderState));
                  const row = rowFor(itemRows, it.id);
                  return (
                    <Box key={it.id}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography sx={{ fontWeight: 700, ...(row?.status === 'removed' ? { textDecoration: 'line-through', color: 'text.disabled' } : {}) }}>
                            {it.productName}
                          </Typography>
                          {row && <LedgerRowTag row={row} />}
                        </Stack>
                        {rs === 'Added' && <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 700 }}>hlídáno</Typography>}
                        {rs === 'Resolved' && <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>vyřešeno</Typography>}
                        {it.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{it.note}</Typography>}
                      </Box>
                      {row
                        ? <QuantityDiff row={row} />
                        : <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.quantity} ks</Typography>}
                      <Box sx={{ ml: 1.5, minWidth: 84, textAlign: 'right' }}>
                        <PriceWithList price={it.unitPriceWithVat} listPrice={it.listPriceWithVat} size={13} />
                      </Box>
                      <Typography sx={{ ml: 1.5, minWidth: 84, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney((it.unitPriceWithVat ?? 0) * (row?.actualQuantity ?? it.quantity ?? 0))}
                      </Typography>
                      {editable && canEditOrder && (
                        <Tooltip title="Hlídání položky">
                          <IconButton
                            size="small"
                            onClick={(e) => setMenu({ anchor: e.currentTarget, itemId: it.id ?? '' })}
                            sx={{ ml: 1.5, color: rs === 'Added' ? 'info.main' : rs === 'Resolved' ? 'success.main' : 'text.disabled' }}
                            aria-label="Hlídání položky"
                          >
                            {rs === 'Added' ? <NotificationsActiveIcon fontSize="small" /> : <NotificationsNoneIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  );
                })}
                {/* Supplier goods — same table, below the beer. No reminder control:
                    hlídání watches a brewery's stock, which these do not come from. */}
                {goodItems.map((g) => {
                  const row = rowFor(goodRows, g.id);
                  return (
                  <Box key={g.id}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ fontWeight: 700, ...(row?.status === 'removed' ? { textDecoration: 'line-through', color: 'text.disabled' } : {}) }}>
                          {g.goodName}
                        </Typography>
                        {row && <LedgerRowTag row={row} />}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {[g.supplierName, g.goodSize, chargeKindLabel(g.chargeKind)].filter(Boolean).join(' · ')}
                      </Typography>
                      {g.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{g.note}</Typography>}
                    </Box>
                    {row
                      ? <QuantityDiff row={row} />
                      : <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.quantity} ks</Typography>}
                    <Box sx={{ ml: 1.5, minWidth: 84, textAlign: 'right' }}>
                      <PriceWithList price={g.unitPriceWithVat} />
                    </Box>
                    <Typography sx={{ ml: 1.5, minWidth: 84, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney((g.unitPriceWithVat ?? 0) * (row?.actualQuantity ?? g.quantity ?? 0))}
                    </Typography>
                  </Box>
                  );
                })}

                {/* Products the client took at the door. They have no order line, so they
                    cannot be decorated onto one — and no price on the order either: they are
                    priced on the invoice, which is why the money column reads a dash. */}
                {appended(itemRows, items.map((i) => i.id)).map((row) => (
                  <Box key={row.key}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ fontWeight: 700 }}>{row.name}</Typography>
                        <LedgerRowTag row={row} />
                      </Stack>
                    </Box>
                    <QuantityDiff row={row} />
                    <Box sx={{ ml: 1.5, minWidth: 84, textAlign: 'right' }} />
                    <Typography sx={{ ml: 1.5, minWidth: 84, textAlign: 'right', color: 'text.disabled' }}>—</Typography>
                  </Box>
                ))}

                {/* What the order came to as delivered. The plan is struck through beside it
                    only when the two differ, so an untouched order shows one number. */}
                <Box sx={{ pt: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>Celkem</Typography>
                  </Box>
                  {deliveredTotal !== plannedTotal ? (
                    <Stack alignItems="flex-end" spacing={0.25}>
                      <Typography variant="caption" sx={{ textDecoration: 'line-through', color: 'text.disabled', fontWeight: 700 }}>
                        {formatMoney(plannedTotal)}
                      </Typography>
                      <Typography sx={{ fontWeight: 800, color: 'warning.dark', fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(deliveredTotal)}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(deliveredTotal)}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </CollapsibleCard>

        {hasSidebar && (
        <Stack spacing={2}>
          {shipment && (
            <ShipmentCard
              shipment={shipment}
              onOpen={openShipment}
              isInvoiceReady={order.isInvoiceReady ?? false}
            />
          )}

          {returnRows.length > 0 && (
            <CollapsibleCard
              title="Vratky"
              count={returnRows.length}
              icon={<UndoIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            >
              <Box sx={{ px: 2.5, py: 1, '& > div': { display: 'flex', alignItems: 'flex-start', py: 1.25, borderBottom: 1, borderColor: 'divider' }, '& > div:last-of-type': { borderBottom: 0 } }}>
                {returnRows.map((row) => {
                  const stored = returns.find((r) => r.id === row.key);
                  return (
                    <Box key={row.key}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography sx={{ fontWeight: 700, ...(row.status === 'removed' ? { textDecoration: 'line-through', color: 'text.disabled' } : {}) }}>
                            {row.name}
                          </Typography>
                          <LedgerRowTag row={row} />
                        </Stack>
                        {stored?.note && <Typography variant="caption" color="text.secondary">{stored.note}</Typography>}
                      </Box>
                      <QuantityDiff row={row} unit="×" />
                    </Box>
                  );
                })}
              </Box>
            </CollapsibleCard>
          )}

          {extraRows.length > 0 && (
            <CollapsibleCard
              title="Položky navíc"
              count={extraRows.length}
              icon={<Inventory2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            >
              <Box sx={{ px: 2.5, py: 1, '& > div': { display: 'flex', alignItems: 'flex-start', py: 1.25, borderBottom: 1, borderColor: 'divider' }, '& > div:last-of-type': { borderBottom: 0 } }}>
                {extraRows.map((row) => {
                  const stored = extras.find((e) => e.id === row.key);
                  return (
                    <Box key={row.key}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography sx={{ fontWeight: 700, ...(row.status === 'removed' ? { textDecoration: 'line-through', color: 'text.disabled' } : {}) }}>
                            {row.name}
                          </Typography>
                          <LedgerRowTag row={row} />
                        </Stack>
                        {stored?.note && <Typography variant="caption" color="text.secondary">{stored.note}</Typography>}
                      </Box>
                      <QuantityDiff row={row} />
                    </Box>
                  );
                })}
              </Box>
            </CollapsibleCard>
          )}

          <LedgerMoneyCard entries={orderEntries} />

          {/* The client's whole open list, not just this order's: what makes it worth reading is
              the part that happened elsewhere. Sending somebody to another screen for their
              to-do list means they never look. */}
          <ClientOpenItemsCard
            entries={ledger.data ?? []}
            clientId={order.client?.id ?? ''}
            currentOrderId={order.id}
            editable={canRecordDeviation}
          />

          {notes.length > 0 && (
            <CollapsibleCard
              title="Poznámky"
              count={notes.length}
              icon={<StickyNote2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            >
              <Box sx={{ px: 2.5, py: 1, '& > div': { py: 1.25, borderBottom: 1, borderColor: 'divider' }, '& > div:last-of-type': { borderBottom: 0 } }}>
                {notes.map((n) => (
                  <Box key={n.id}>
                    {/* Notes are free text and often multi-line — keep the breaks. */}
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{n.text}</Typography>
                    {n.dateCreated && (
                      <Typography variant="caption" color="text.secondary">{fmtDate(n.dateCreated)}</Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </CollapsibleCard>
          )}
        </Stack>
        )}
      </Box>

      <LedgerEntryDrawer
        open={recording}
        context={drawerContext}
        onClose={() => setRecording(false)}
      />

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => menu && setReminder(menu.itemId, OrderItemReminderState.Added)}>
          <ListItemIcon><NotificationsActiveIcon fontSize="small" sx={{ color: 'info.main' }} /></ListItemIcon>
          <ListItemText>Hlídat</ListItemText>
          {menuState === 'Added' && <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} />}
        </MenuItem>
        <MenuItem onClick={() => menu && setReminder(menu.itemId, OrderItemReminderState.Resolved)}>
          <ListItemIcon><CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} /></ListItemIcon>
          <ListItemText>Vyřešeno</ListItemText>
          {menuState === 'Resolved' && <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} />}
        </MenuItem>
        <MenuItem onClick={() => menu && setReminder(menu.itemId, undefined)}>
          <ListItemIcon><NotificationsOffIcon fontSize="small" sx={{ color: 'text.disabled' }} /></ListItemIcon>
          <ListItemText>Nehlídat</ListItemText>
          {menuState === 'None' && <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} />}
        </MenuItem>
      </Menu>
    </Box>
  );
}
