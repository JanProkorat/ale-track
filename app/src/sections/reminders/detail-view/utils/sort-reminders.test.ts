import { it, expect, describe } from 'vitest';

import { sortReminders } from './sort-reminders';
import { ReminderListItemDto } from '../../../../api/Client';

describe('sortReminders', () => {
    it('should return an empty array when given an empty array', () => {
        expect(sortReminders([])).toEqual([]);
    });

    it('should sort unresolved reminders before resolved ones', () => {
        const reminders = [
            new ReminderListItemDto({ id: '1', isResolved: true, occurrenceDate: new Date(2025, 0, 1) }),
            new ReminderListItemDto({ id: '2', isResolved: false, occurrenceDate: new Date(2025, 0, 2) }),
        ];

        const sorted = sortReminders(reminders);
        expect(sorted[0].id).toBe('2');
        expect(sorted[1].id).toBe('1');
    });

    it('should sort by occurrenceDate ascending within same resolved status', () => {
        const reminders = [
            new ReminderListItemDto({ id: '1', isResolved: false, occurrenceDate: new Date(2025, 5, 15) }),
            new ReminderListItemDto({ id: '2', isResolved: false, occurrenceDate: new Date(2025, 0, 1) }),
            new ReminderListItemDto({ id: '3', isResolved: false, occurrenceDate: new Date(2025, 3, 10) }),
        ];

        const sorted = sortReminders(reminders);
        expect(sorted[0].id).toBe('2');
        expect(sorted[1].id).toBe('3');
        expect(sorted[2].id).toBe('1');
    });

    it('should sort resolved reminders by occurrenceDate ascending', () => {
        const reminders = [
            new ReminderListItemDto({ id: '1', isResolved: true, occurrenceDate: new Date(2025, 5, 15) }),
            new ReminderListItemDto({ id: '2', isResolved: true, occurrenceDate: new Date(2025, 0, 1) }),
        ];

        const sorted = sortReminders(reminders);
        expect(sorted[0].id).toBe('2');
        expect(sorted[1].id).toBe('1');
    });

    it('should handle mixed resolved and unresolved reminders', () => {
        const reminders = [
            new ReminderListItemDto({ id: '1', isResolved: true, occurrenceDate: new Date(2025, 0, 1) }),
            new ReminderListItemDto({ id: '2', isResolved: false, occurrenceDate: new Date(2025, 6, 1) }),
            new ReminderListItemDto({ id: '3', isResolved: false, occurrenceDate: new Date(2025, 1, 1) }),
            new ReminderListItemDto({ id: '4', isResolved: true, occurrenceDate: new Date(2025, 3, 1) }),
        ];

        const sorted = sortReminders(reminders);
        // Unresolved first, sorted by date
        expect(sorted[0].id).toBe('3');
        expect(sorted[1].id).toBe('2');
        // Resolved last, sorted by date
        expect(sorted[2].id).toBe('1');
        expect(sorted[3].id).toBe('4');
    });

    it('should not mutate the original array', () => {
        const reminders = [
            new ReminderListItemDto({ id: '2', isResolved: false, occurrenceDate: new Date(2025, 5, 15) }),
            new ReminderListItemDto({ id: '1', isResolved: false, occurrenceDate: new Date(2025, 0, 1) }),
        ];

        const sorted = sortReminders(reminders);
        expect(reminders[0].id).toBe('2');
        expect(sorted[0].id).toBe('1');
    });
});
