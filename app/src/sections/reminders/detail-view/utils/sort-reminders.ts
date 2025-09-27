import type {BreweryReminderDto} from "../../../../api/Client";

export function sortReminders(remindersToSort: BreweryReminderDto[]): BreweryReminderDto[] {
    return [...remindersToSort].sort((a, b) => {
        const aResolved = a.isResolved;
        const bResolved = b.isResolved;

        if (aResolved !== bResolved) {
            return aResolved ? 1 : -1;
        }

        const aTime = new Date(a.occurrenceDate!).getTime();
        const bTime = new Date(b.occurrenceDate!).getTime();

        return aTime - bTime;
    });
};
