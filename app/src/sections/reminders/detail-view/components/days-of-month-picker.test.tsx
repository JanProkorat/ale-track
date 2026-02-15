import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { DaysOfMonthPicker } from './days-of-month-picker';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockOnDaysOfMonthPicked = vi.fn();

describe('DaysOfMonthPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the legend label', () => {
        render(
            <DaysOfMonthPicker
                selectedDays={[]}
                onDaysOfMonthPicked={mockOnDaysOfMonthPicked}
                errors={{}}
            />
        );

        expect(screen.getByText('reminders.daysToDisplay')).toBeInTheDocument();
    });

    it('should render 31 checkboxes for each day of the month', () => {
        const { container } = render(
            <DaysOfMonthPicker
                selectedDays={[]}
                onDaysOfMonthPicked={mockOnDaysOfMonthPicked}
                errors={{}}
            />
        );

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes).toHaveLength(31);
    });

    it('should check boxes for selected days', () => {
        const { container } = render(
            <DaysOfMonthPicker
                selectedDays={[1, 15, 31]}
                onDaysOfMonthPicked={mockOnDaysOfMonthPicked}
                errors={{}}
            />
        );

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[14]).toBeChecked();
        expect(checkboxes[30]).toBeChecked();
        // Day 2 should not be checked
        expect(checkboxes[1]).not.toBeChecked();
    });

    it('should call onDaysOfMonthPicked with added day when checking a box', () => {
        const { container } = render(
            <DaysOfMonthPicker
                selectedDays={[1]}
                onDaysOfMonthPicked={mockOnDaysOfMonthPicked}
                errors={{}}
            />
        );

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[4]); // day 5

        expect(mockOnDaysOfMonthPicked).toHaveBeenCalledWith([1, 5]);
    });

    it('should call onDaysOfMonthPicked with removed day when unchecking a box', () => {
        const { container } = render(
            <DaysOfMonthPicker
                selectedDays={[1, 5, 10]}
                onDaysOfMonthPicked={mockOnDaysOfMonthPicked}
                errors={{}}
            />
        );

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[4]); // uncheck day 5

        expect(mockOnDaysOfMonthPicked).toHaveBeenCalledWith([1, 10]);
    });

    it('should render day labels from 1 to 31', () => {
        render(
            <DaysOfMonthPicker
                selectedDays={[]}
                onDaysOfMonthPicked={mockOnDaysOfMonthPicked}
                errors={{}}
            />
        );

        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('31')).toBeInTheDocument();
    });

    it('should show error styling when errors.daysOfMonth is set', () => {
        render(
            <DaysOfMonthPicker
                selectedDays={[]}
                onDaysOfMonthPicked={mockOnDaysOfMonthPicked}
                errors={{ daysOfMonth: 'Required' }}
            />
        );

        const legend = screen.getByText('reminders.daysToDisplay');
        expect(legend).toHaveClass('Mui-error');
    });

    it('should not show error styling when no errors', () => {
        render(
            <DaysOfMonthPicker
                selectedDays={[]}
                onDaysOfMonthPicked={mockOnDaysOfMonthPicked}
                errors={{}}
            />
        );

        const legend = screen.getByText('reminders.daysToDisplay');
        expect(legend).not.toHaveClass('Mui-error');
    });
});
