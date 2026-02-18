import { it, vi, expect, describe, beforeEach } from 'vitest';

import { DayOfWeek } from 'src/api/Client';
import { screen, render, fireEvent } from 'src/test/test-utils';

import { DaysOfWeekPicker } from './days-of-week-picker';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../../../utils/format-enum-value', () => ({
     mapEnumValue: <T,>(_enumType: Record<string, unknown>, value: T | string | undefined): T | undefined => {
          if (value === undefined) return undefined;
          if (typeof value === 'number') return value as T;
          const numericValue = (_enumType as Record<string, number>)[value as string];
          return numericValue !== undefined ? (numericValue as T) : undefined;
     },
}));

const mockOnDaysOfWeekPicked = vi.fn();

describe('DaysOfWeekPicker', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render the legend label', () => {
          render(<DaysOfWeekPicker selectedDays={[]} onDaysOfWeekPicked={mockOnDaysOfWeekPicked} errors={{}} />);

          expect(screen.getByText('reminders.daysToDisplay')).toBeInTheDocument();
     });

     it('should render 7 checkboxes for each day of the week', () => {
          const { container } = render(
               <DaysOfWeekPicker selectedDays={[]} onDaysOfWeekPicked={mockOnDaysOfWeekPicked} errors={{}} />
          );

          const checkboxes = container.querySelectorAll('input[type="checkbox"]');
          expect(checkboxes).toHaveLength(7);
     });

     it('should render day labels using translation keys', () => {
          render(<DaysOfWeekPicker selectedDays={[]} onDaysOfWeekPicked={mockOnDaysOfWeekPicked} errors={{}} />);

          expect(screen.getByText('dayOfWeek.Monday')).toBeInTheDocument();
          expect(screen.getByText('dayOfWeek.Friday')).toBeInTheDocument();
          expect(screen.getByText('dayOfWeek.Sunday')).toBeInTheDocument();
     });

     it('should check boxes for selected days', () => {
          const { container } = render(
               <DaysOfWeekPicker
                    selectedDays={[DayOfWeek.Monday, DayOfWeek.Friday]}
                    onDaysOfWeekPicked={mockOnDaysOfWeekPicked}
                    errors={{}}
               />
          );

          const checkboxes = container.querySelectorAll('input[type="checkbox"]');
          // orderedDays: Monday, Friday, Tuesday, Saturday, Wednesday, Sunday, Thursday
          // Monday is index 0, Friday is index 1
          expect(checkboxes[0]).toBeChecked(); // Monday
          expect(checkboxes[1]).toBeChecked(); // Friday
          expect(checkboxes[2]).not.toBeChecked(); // Tuesday
     });

     it('should call onDaysOfWeekPicked when checking a day', () => {
          const { container } = render(
               <DaysOfWeekPicker
                    selectedDays={[DayOfWeek.Monday]}
                    onDaysOfWeekPicked={mockOnDaysOfWeekPicked}
                    errors={{}}
               />
          );

          const checkboxes = container.querySelectorAll('input[type="checkbox"]');
          fireEvent.click(checkboxes[1]); // Click Friday (index 1 in orderedDays)

          expect(mockOnDaysOfWeekPicked).toHaveBeenCalledWith([DayOfWeek.Monday, DayOfWeek.Friday]);
     });

     it('should call onDaysOfWeekPicked with removed day when unchecking', () => {
          const { container } = render(
               <DaysOfWeekPicker
                    selectedDays={[DayOfWeek.Monday, DayOfWeek.Friday]}
                    onDaysOfWeekPicked={mockOnDaysOfWeekPicked}
                    errors={{}}
               />
          );

          const checkboxes = container.querySelectorAll('input[type="checkbox"]');
          fireEvent.click(checkboxes[0]); // Uncheck Monday (index 0)

          expect(mockOnDaysOfWeekPicked).toHaveBeenCalledWith([DayOfWeek.Friday]);
     });

     it('should show error styling when errors.daysOfWeek is set', () => {
          render(
               <DaysOfWeekPicker
                    selectedDays={[]}
                    onDaysOfWeekPicked={mockOnDaysOfWeekPicked}
                    errors={{ daysOfWeek: 'Required' }}
               />
          );

          const legend = screen.getByText('reminders.daysToDisplay');
          expect(legend).toHaveClass('Mui-error');
     });

     it('should not show error styling when no errors', () => {
          render(<DaysOfWeekPicker selectedDays={[]} onDaysOfWeekPicked={mockOnDaysOfWeekPicked} errors={{}} />);

          const legend = screen.getByText('reminders.daysToDisplay');
          expect(legend).not.toHaveClass('Mui-error');
     });
});
