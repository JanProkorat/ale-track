import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Drawer, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNoneOutlined';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOffOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import { StatusPill } from 'src/components/common/StatusPill';
import { type StatusTone } from 'src/lib/labels';
import { apiErrorMessage } from 'src/api/errors';
import { fmtDateShort, fmtLiters, orderNumber } from 'src/lib/format';
import { SectionType, OrderItemReminderState } from 'src/generated/api-client';
import { useUpcomingReminders } from 'src/hooks/useReports';
import { useOrderItemReminders, useSetOrderItemReminderState } from 'src/hooks/useReminders';
import { PATHS } from 'src/routes/paths';

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'text.disabled', px: 0.5, pt: 2.5, pb: 1 }}>
      {children}
    </Typography>
  );
}

/** A single clickable row inside a section card. */
function Row({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, borderRadius: 1.5,
        cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {children}
    </Box>
  );
}

/** Header reminders drawer (opened by the bell): upcoming brewery/client
 * reminders + watched order items. Mirrors the prototype's openReminders().
 *
 * The body lives in a child that MUI only mounts while the drawer is open
 * (keepMounted defaults to false), so both lists fetch exactly once per open —
 * never on page load, and deterministically on every reopen. */
export function RemindersDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 'min(440px, 96vw)', bgcolor: 'background.default', backgroundImage: 'none' } } }}
    >
      <DrawerBody onClose={onClose} />
    </Drawer>
  );
}

function DrawerBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const remindersQ = useUpcomingReminders();
  const watchedQ = useOrderItemReminders();
  const setReminder = useSetOrderItemReminderState();

  const today = useMemo(() => dayjs().startOf('day'), []);

  const reminders = useMemo(() => {
    const out: { key: string; name: string; sectionName: string; href: string; date?: Date }[] = [];
    for (const sec of remindersQ.data ?? []) {
      const href = sec.sectionType === SectionType.Client ? `${PATHS.clients}/${sec.sectionId}` : `${PATHS.breweries}/${sec.sectionId}`;
      for (const r of sec.reminders ?? []) {
        out.push({ key: r.id ?? `${sec.sectionId}-${r.name}`, name: r.name ?? '—', sectionName: sec.sectionName ?? '', href, date: r.occurrenceDate });
      }
    }
    return out.sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));
  }, [remindersQ.data]);

  const watched = useMemo(() => {
    const out: { key: string; product: string; meta: string; href: string; itemId: string; orderId: string }[] = [];
    (watchedQ.data ?? []).forEach((co) => {
      (co.orderItems ?? []).forEach((it, i) => {
        const size = it.packageSize != null ? ` ${fmtLiters(it.packageSize)}` : '';
        out.push({
          key: it.id ?? `${it.orderId}-${it.productId}-${i}`,
          product: `${it.productName ?? '—'}${size} × ${it.quantity ?? 0}`,
          meta: `${co.clientName ?? it.clientName ?? ''} · ${orderNumber(it.orderId)}`,
          href: `${PATHS.orders}/${it.orderId}`,
          itemId: it.id ?? '',
          orderId: it.orderId ?? '',
        });
      });
    });
    return out;
  }, [watchedQ.data]);

  const go = (href: string) => { onClose(); navigate(href); };

  const changeState = async (itemId: string, orderId: string, state: OrderItemReminderState | undefined) => {
    try {
      await setReminder.mutateAsync({ itemId, orderId, state });
      enqueueSnackbar(state === OrderItemReminderState.Resolved ? 'Položka označena jako vyřešená.' : 'Hlídání položky zrušeno.', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' });
    }
  };

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider', flex: '0 0 auto' }}>
        <NotificationsNoneIcon sx={{ color: 'text.primary' }} />
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 800 }}>Připomínky</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Zavřít" sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box sx={{ overflowY: 'auto', px: 2.5, pb: 3 }}>
        <SectionLabel>Pivovary &amp; klienti</SectionLabel>
        <Card sx={{ p: 0.75 }}>
          {reminders.length > 0 ? (
            reminders.map((r) => {
              const d = r.date ? dayjs(r.date).startOf('day') : null;
              const overdue = d ? d.isBefore(today) : false;
              const isToday = d ? d.isSame(today, 'day') : false;
              const dotColor = overdue ? 'error.main' : isToday ? 'warning.main' : 'info.main';
              const tone: StatusTone = overdue ? 'crit' : isToday ? 'amber' : 'grey';
              return (
                <Row key={r.key} onClick={() => go(r.href)}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, bgcolor: dotColor }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>{r.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{r.sectionName}</Typography>
                  </Box>
                  <StatusPill tone={tone} label={isToday ? 'dnes' : r.date ? fmtDateShort(r.date) : '—'} />
                </Row>
              );
            })
          ) : (
            <Typography color="text.secondary" sx={{ fontSize: 13, px: 1.5, py: 1.5 }}>Žádné aktivní připomínky.</Typography>
          )}
        </Card>

        <SectionLabel>Položky objednávek (hlídané)</SectionLabel>
        <Card sx={{ p: 0.75 }}>
          {watched.length > 0 ? (
            watched.map((w) => (
              <Row key={w.key} onClick={() => go(w.href)}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{w.product}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{w.meta}</Typography>
                </Box>
                <Tooltip title="Označit jako vyřešené">
                  <IconButton
                    size="small"
                    disabled={setReminder.isPending}
                    onClick={(e) => { e.stopPropagation(); void changeState(w.itemId, w.orderId, OrderItemReminderState.Resolved); }}
                    sx={{ color: 'success.main' }}
                    aria-label="Označit jako vyřešené"
                  >
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Přestat hlídat">
                  <IconButton
                    size="small"
                    disabled={setReminder.isPending}
                    onClick={(e) => { e.stopPropagation(); void changeState(w.itemId, w.orderId, undefined); }}
                    sx={{ color: 'text.disabled' }}
                    aria-label="Přestat hlídat"
                  >
                    <NotificationsOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Row>
            ))
          ) : (
            <Typography color="text.secondary" sx={{ fontSize: 13, px: 1.5, py: 1.5 }}>Žádné hlídané položky.</Typography>
          )}
        </Card>
      </Box>
    </>
  );
}
