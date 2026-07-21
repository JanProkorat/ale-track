import { type CreateReminderDto, type UpdateReminderDto } from 'src/generated/api-client';
import { ReminderForm } from 'src/features/reminders/ReminderForm';
import { useCreateClientReminder, useUpdateClientReminder } from 'src/hooks/useClientReminders';

/** Create/edit a client reminder (one-time or recurring) — wires the shared
 * ReminderForm to the client reminder endpoints. */
export function ReminderFormDrawer({
  open,
  clientId,
  reminderId,
  onClose,
}: {
  open: boolean;
  clientId: string;
  reminderId?: string;
  onClose: () => void;
}) {
  const create = useCreateClientReminder(clientId);
  const update = useUpdateClientReminder(clientId);
  return (
    <ReminderForm
      open={open}
      reminderId={reminderId}
      onClose={onClose}
      onCreate={(data: CreateReminderDto) => create.mutateAsync(data)}
      onUpdate={(id: string, data: UpdateReminderDto) => update.mutateAsync({ id, data })}
      busy={create.isPending || update.isPending}
    />
  );
}
