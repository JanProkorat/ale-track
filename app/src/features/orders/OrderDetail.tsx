import { useEffect, useState } from 'react';
import { Box, Breadcrumbs, Button, Card, IconButton, Link, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNextOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNoneOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveOutlined';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOffOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import { useSnackbar } from 'notistack';
import { StatusPill } from 'src/components/common/StatusPill';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ORDER_STATUS, orderStateName, reminderStateName, reminderStateValue } from 'src/lib/labels';
import { OrderItemReminderState, type OrderDto } from 'src/generated/api-client';
import { useSetOrderItemReminderState } from 'src/hooks/useReminders';

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

export function OrderDetail({
  order,
  editable,
  onBack,
  onEdit,
  onDelete,
}: {
  order: OrderDto;
  editable: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const setReminderState = useSetOrderItemReminderState();
  const items = order.orderItems ?? [];
  const returns = order.returns ?? [];
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

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 16 }} />} sx={{ mb: 1.5, fontSize: 13 }}>
        <Link component="button" type="button" underline="hover" color="text.secondary" onClick={onBack} sx={{ fontSize: 13 }}>
          Objednávky
        </Link>
        <Typography color="text.primary" sx={{ fontSize: 13 }}>{orderNumber(order.id)}</Typography>
      </Breadcrumbs>

      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'primary.dark', mb: 0.6 }}>
            Objednávka
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap" sx={{ rowGap: 0 }}>
            <Typography variant="h1" sx={{ fontSize: 26, fontFamily: 'monospace' }}>{orderNumber(order.id)}</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'primary.dark', minWidth: 0 }} noWrap>
              {order.client?.name ?? '—'}
            </Typography>
          </Stack>
          {/* The date that matters day to day is when it has to be there; the
              creation date is only worth showing when no term is set yet. */}
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 14 }}>
            {order.requiredDeliveryDate ? (
              <>
                {'požadovaný termín '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>{fmtDate(order.requiredDeliveryDate)}</Box>
              </>
            ) : (
              <>{'vytvořeno '}{fmtDate(order.createdDate)}</>
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
          <StatusPill tone={status.tone} label={status.label} />
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
        </Stack>
      </Stack>

      {stateName !== 'Cancelled' && <StatusFlow stateName={stateName} />}

      {/* Two columns on md+ (items | sidebar). Stacked below that, where the
          sidebar's `display: contents` dissolves it so its cards become direct
          children of this flex column and `order` can interleave them: Doručení
          reads first, then the item list, then vratky. */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'grid' },
          flexDirection: 'column',
          alignItems: { xs: 'stretch', md: 'start' },
          gap: 2.5,
          gridTemplateColumns: { md: '1.5fr 1fr' },
        }}
      >
        <Card sx={{ overflow: 'hidden', order: { xs: 2, md: 0 } }}>
          <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Položky</Typography>
            <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: 'action.selected', fontSize: 12, fontWeight: 700 }}>
              {items.length}
            </Box>
          </Stack>
          <Box sx={{ px: 2.5, py: 1 }}>
            {items.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Objednávka nemá žádné položky.</Typography>
            ) : (
              <Box sx={{ '& > div': { display: 'flex', alignItems: 'center', py: 1.25, borderBottom: 1, borderColor: 'divider' }, '& > div:last-of-type': { borderBottom: 0 } }}>
                {items.map((it) => {
                  const rs = reminderStateName(effState(it.id ?? '', it.reminderState));
                  return (
                    <Box key={it.id}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{it.productName}</Typography>
                        {rs === 'Added' && <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 700 }}>hlídáno</Typography>}
                        {rs === 'Resolved' && <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>vyřešeno</Typography>}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.quantity} ks</Typography>
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
              </Box>
            )}
          </Box>
        </Card>

        <Box sx={{ display: { xs: 'contents', md: 'flex' }, flexDirection: 'column', gap: 2 }}>
          {returns.length > 0 && (
            <Card sx={{ overflow: 'hidden', order: { xs: 3, md: 0 } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
                <UndoIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Vratky</Typography>
                <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: 'action.selected', fontSize: 12, fontWeight: 700 }}>
                  {returns.length}
                </Box>
              </Stack>
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
            </Card>
          )}

          <Card sx={{ overflow: 'hidden', order: { xs: 1, md: 0 } }}>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Doručení</Typography>
            </Stack>
            <Stack spacing={1.5} sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Požadovaný termín</Typography>
                <Typography sx={{ fontWeight: 600 }}>{order.requiredDeliveryDate ? fmtDate(order.requiredDeliveryDate) : '—'}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Skutečné doručení</Typography>
                <Typography sx={{ fontWeight: 600 }}>{order.actualDeliveryDate ? fmtDate(order.actualDeliveryDate) : '—'}</Typography>
              </Stack>
            </Stack>
          </Card>
        </Box>
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
