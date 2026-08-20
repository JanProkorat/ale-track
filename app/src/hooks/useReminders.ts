// Generic reminder detail lookup (the endpoint isn't entity-scoped) — used by
// the reminder form to prefill on edit.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { SetOrderItemReminderStateDto, ClientOrderReminderDto, type OrderItemReminderState } from 'src/generated/api-client';

export function useReminderDetail(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: [...qk.reminders, 'detail', id ?? ''] as const,
    queryFn: ({ signal }) => ds.getReminderDetailEndpoint(id!, signal),
    enabled: Boolean(id),
  });
}

/** Watched order items ("hlídané položky objednávek"), grouped by client/order
 * — the second section of the header reminders drawer. */
export function useOrderItemReminders(enabled = true) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.orderItemReminders,
    queryFn: ({ signal }) => ds.getOrderItemsRemindersListEndpoint(signal),
    enabled,
    // Fetched when the drawer opens (enable flips true); never refetched while
    // open — state changes prune the cache locally instead (see below).
    refetchOnWindowFocus: false,
  });
}

/** Set (or clear) a single order item's reminder state via the dedicated
 * endpoint — keyed by the order-item's own public id. Unlike a full order
 * update it doesn't re-validate the order (e.g. past delivery dates), so it
 * works on any order. `orderId` is only used to refresh that order's detail. */
export function useSetOrderItemReminderState() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, state }: { itemId: string; orderId?: string; state: OrderItemReminderState | undefined }) =>
      ds.setOrderItemReminderStateEndpoint(itemId, new SetOrderItemReminderStateDto({ reminderState: state })),
    onSuccess: (_r, { itemId, orderId }) => {
      // Prune just the changed item from the cached watched-items list — no
      // refetch, so the drawer removes one row without reloading/flickering.
      // Must be immutable (new objects), or React Query's structural sharing
      // treats the in-place edit as "unchanged" and skips the re-render.
      qc.setQueryData<ClientOrderReminderDto[]>(qk.orderItemReminders, (old) => (old
        ? old
            .map((co) => Object.assign(new ClientOrderReminderDto(), co, {
              orderItems: (co.orderItems ?? []).filter((i) => i.id !== itemId),
            }))
            .filter((co) => co.orderItems.length > 0)
        : old));
      // The orders views still need to reflect the change.
      qc.invalidateQueries({ queryKey: qk.orders.all });
      if (orderId) qc.invalidateQueries({ queryKey: qk.orders.detail(orderId) });
    },
  });
}
