import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { ReminderDaysInput } from './reminder-days-input';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockOnSelectedValueChange = vi.fn();

describe('ReminderDaysInput', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <ReminderDaysInput
                selectedValue={5}
                onSelectedValueChange={mockOnSelectedValueChange}
                errors={{}}
            />
        );

        expect(screen.getAllByText('reminders.numberOfDaysToRemindBefore')[0]).toBeInTheDocument();
    });

    it('should display the current value', () => {
        render(
            <ReminderDaysInput
                selectedValue={7}
                onSelectedValueChange={mockOnSelectedValueChange}
                errors={{}}
            />
        );

        expect(screen.getByDisplayValue('7')).toBeInTheDocument();
    });

    it('should call onSelectedValueChange when value changes', () => {
        render(
            <ReminderDaysInput
                selectedValue={5}
                onSelectedValueChange={mockOnSelectedValueChange}
                errors={{}}
            />
        );

        const input = screen.getByDisplayValue('5');
        fireEvent.change(input, { target: { value: '10' } });

        expect(mockOnSelectedValueChange).toHaveBeenCalledWith(10);
    });

    it('should show error state when errors.numberOfDaysToRemindBefore is set', () => {
        const { container } = render(
            <ReminderDaysInput
                selectedValue={0}
                onSelectedValueChange={mockOnSelectedValueChange}
                errors={{ numberOfDaysToRemindBefore: 'Required' }}
            />
        );

        const input = container.querySelector('.MuiInputBase-root');
        expect(input).toHaveClass('Mui-error');
    });
});
