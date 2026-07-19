import { Box, Breadcrumbs, Button, Card, IconButton, Link, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNextOutlined';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import { StatusPill } from 'src/components/common/StatusPill';
import { fmtDate, orderNumber } from 'src/lib/format';
import { ORDER_STATUS, orderStateName, isReminderAdded } from 'src/lib/labels';
import { type OrderDto } from 'src/generated/api-client';

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
  const items = order.orderItems ?? [];
  const stateName = orderStateName(order.state) ?? 'New';
  const canEditOrder = stateName !== 'Finished' && stateName !== 'Cancelled';
  const status = ORDER_STATUS[stateName] ?? ORDER_STATUS.New;

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
          <Typography variant="h1" sx={{ fontSize: 26, fontFamily: 'monospace' }}>{orderNumber(order.id)}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 14 }}>
            <Box component="span" sx={{ color: 'primary.dark', fontWeight: 700 }}>{order.client?.name ?? '—'}</Box>
            {' · vytvořeno '}{fmtDate(order.createdDate)}
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

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, alignItems: 'start' }}>
        <Card sx={{ overflow: 'hidden' }}>
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
                {items.map((it) => (
                  <Box key={it.id}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{it.productName}</Typography>
                      {isReminderAdded(it.reminderState) && (
                        <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 700 }}>hlídáno</Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.quantity} ks</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Card>

        <Stack spacing={2}>
          <Card sx={{ overflow: 'hidden' }}>
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

          <Card sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Klient</Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2.5 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: (t) => t.palette.brand.infoTint, color: 'info.main' }}>
                <LocalMallOutlinedIcon fontSize="small" />
              </Box>
              <Typography sx={{ fontWeight: 700 }}>{order.client?.name ?? '—'}</Typography>
            </Stack>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}
