import { it, vi, expect, describe, beforeEach } from 'vitest';

import { ReminderRecurrenceType } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { ReminderRecurrenceTypeSelect } from './reminder-recurrence-type-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockOnSelect = vi.fn();

describe('ReminderRecurrenceTypeSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <ReminderRecurrenceTypeSelect
                selectedType={undefined as any}
                errors={{}}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('reminders.reminderRecurrenceType')).toBeInTheDocument();
    });

    it('should render a chip with the selected recurrence type', () => {
        render(
            <ReminderRecurrenceTypeSelect
                selectedType={ReminderRecurrenceType.Weekly}
                errors={{}}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('reminderRecurrenceType.Weekly')).toBeInTheDocument();
    });

    it('should render all recurrence type options when opened', async () => {
        render(
            <ReminderRecurrenceTypeSelect
                selectedType={undefined as any}
                errors={{}}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        // ReminderRecurrenceType has several values
        expect(options.length).toBeGreaterThan(0);
    });

    it('should call onSelect when an option is clicked', async () => {
        render(
            <ReminderRecurrenceTypeSelect
                selectedType={undefined as any}
                errors={{}}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[0].click();

        expect(mockOnSelect).toHaveBeenCalled();
    });

    it('should show error state when errors.recurrenceType is set', () => {
        render(
            <ReminderRecurrenceTypeSelect
                selectedType={undefined as any}
                errors={{ recurrenceType: 'Required' }}
                onSelect={mockOnSelect}
            />
        );

        const label = screen.getByText('reminders.reminderRecurrenceType');
        expect(label).toHaveClass('Mui-error');
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <ReminderRecurrenceTypeSelect
                selectedType={undefined as any}
                errors={{}}
                onSelect={mockOnSelect}
                disabled
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-disabled', 'true');
    });
});
