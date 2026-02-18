import { it, vi, expect, describe, beforeEach } from 'vitest';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import { screen, render } from 'src/test/test-utils';

import { ReminderDatePicker } from './reminder-date-picker';

const mockOnDatePicked = vi.fn();

function renderWithLocalization(ui: React.ReactElement) {
     return render(<LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>);
}

describe('ReminderDatePicker', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render the label', () => {
          renderWithLocalization(
               <ReminderDatePicker
                    selectedDate={new Date(2025, 5, 15)}
                    onDatePicked={mockOnDatePicked}
                    label="Test Label"
               />
          );

          expect(screen.getAllByText('Test Label').length).toBeGreaterThan(0);
     });

     it('should display the selected date value', () => {
          renderWithLocalization(
               <ReminderDatePicker selectedDate={new Date(2025, 5, 15)} onDatePicked={mockOnDatePicked} label="Date" />
          );

          const input = screen.getByRole('textbox');
          expect(input).toHaveValue('06/15/2025');
     });

     it('should render with undefined date without crashing', () => {
          renderWithLocalization(
               <ReminderDatePicker selectedDate={undefined} onDatePicked={mockOnDatePicked} label="Date" />
          );

          expect(screen.getByRole('textbox')).toBeInTheDocument();
     });

     it('should apply custom sx styles', () => {
          const { container } = renderWithLocalization(
               <ReminderDatePicker
                    selectedDate={new Date(2025, 5, 15)}
                    onDatePicked={mockOnDatePicked}
                    label="Date"
                    sx={{ minWidth: '50%' }}
               />
          );

          expect(container.firstChild).toBeInTheDocument();
     });
});
