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
function ShipmentCard({ shipment, onOpen }: { shipment: OrderOutgoingShipmentDto; onOpen: () => void }) {
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
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
          <Typography sx={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 14 }}>
            {shipmentNumber(shipment.id)}
          </Typography>
          <StatusPill tone={status.tone} label={status.label} />
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
  const hasSidebar = returns.length > 0 || extras.length > 0 || notes.length > 0 || shipment !== undefined;

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
              {formatAddressOrCoords(order.deliveryAddress?.address)}
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
                  return (
                    <Box key={it.id}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{it.productName}</Typography>
                        {rs === 'Added' && <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 700 }}>hlídáno</Typography>}
                        {rs === 'Resolved' && <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>vyřešeno</Typography>}
                        {it.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{it.note}</Typography>}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.quantity} ks</Typography>
                      <Box sx={{ ml: 1.5, minWidth: 84, textAlign: 'right' }}>
                        <PriceWithList price={it.unitPriceWithVat} listPrice={it.listPriceWithVat} size={13} />
                      </Box>
                      <Typography sx={{ ml: 1.5, minWidth: 84, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney((it.unitPriceWithVat ?? 0) * (it.quantity ?? 0))}
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
                {goodItems.map((g) => (
                  <Box key={g.id}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{g.goodName}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {[g.supplierName, g.goodSize, chargeKindLabel(g.chargeKind)].filter(Boolean).join(' · ')}
                      </Typography>
                      {g.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{g.note}</Typography>}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.quantity} ks</Typography>
                    <Box sx={{ ml: 1.5, minWidth: 84, textAlign: 'right' }}>
                      <PriceWithList price={g.unitPriceWithVat} />
                    </Box>
                    <Typography sx={{ ml: 1.5, minWidth: 84, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney((g.unitPriceWithVat ?? 0) * (g.quantity ?? 0))}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </CollapsibleCard>

        {hasSidebar && (
        <Stack spacing={2}>
          {shipment && <ShipmentCard shipment={shipment} onOpen={openShipment} />}

          {returns.length > 0 && (
            <CollapsibleCard
              title="Vratky"
              count={returns.length}
              icon={<UndoIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            >
              <Box sx={{ px: 2.5, py: 1, '& > div': { display: 'flex', alignItems: 'flex-start', py: 1.25, borderBottom: 1, borderColor: 'divider' }, '& > div:last-of-type': { borderBottom: 0 } }}>
                {returns.map((r) => (
                  <Box key={r.id}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{r.name}</Typography>
                      {r.note && <Typography variant="caption" color="text.secondary">{r.note}</Typography>}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.quantity}×</Typography>
                  </Box>
                ))}
              </Box>
            </CollapsibleCard>
          )}

          {extras.length > 0 && (
            <CollapsibleCard
              title="Položky navíc"
              count={extras.length}
              icon={<Inventory2OutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            >
              <Box sx={{ px: 2.5, py: 1, '& > div': { display: 'flex', alignItems: 'flex-start', py: 1.25, borderBottom: 1, borderColor: 'divider' }, '& > div:last-of-type': { borderBottom: 0 } }}>
                {extras.map((e) => (
                  <Box key={e.id}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{e.description}</Typography>
                      {e.note && <Typography variant="caption" color="text.secondary">{e.note}</Typography>}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.quantity} ks</Typography>
                  </Box>
                ))}
              </Box>
            </CollapsibleCard>
          )}

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
