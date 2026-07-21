import { type CreateReminderDto, type UpdateReminderDto } from 'src/generated/api-client';
import { ReminderForm } from 'src/features/reminders/ReminderForm';
import { useCreateBreweryReminder, useUpdateBreweryReminder } from 'src/hooks/useBreweryReminders';

/** Create/edit a brewery reminder (one-time or recurring) — wires the shared
 * ReminderForm to the brewery reminder endpoints. */
export function ReminderFormDrawer({
  open,
  breweryId,
  reminderId,
  onClose,
}: {
  open: boolean;
  breweryId: string;
  reminderId?: string;
  onClose: () => void;
}) {
  const create = useCreateBreweryReminder(breweryId);
  const update = useUpdateBreweryReminder(breweryId);
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
