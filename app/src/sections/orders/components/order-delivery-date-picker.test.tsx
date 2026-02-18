import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import { screen, render as baseRender } from 'src/test/test-utils';

import { OrderDeliveryDatePicker } from './order-delivery-date-picker';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) =>
     baseRender(<LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>, { theme: testTheme });

const mockOnDatePicked = vi.fn();

describe('OrderDeliveryDatePicker', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render the label', () => {
          render(
               <OrderDeliveryDatePicker
                    selectedDeliveryDate={undefined}
                    label="Delivery Date"
                    onDatePicked={mockOnDatePicked}
               />
          );

          // MUI DatePicker renders label in both <label> and <legend><span>
          const labels = screen.getAllByText('Delivery Date');
          expect(labels.length).toBeGreaterThanOrEqual(1);
     });

     it('should display the date input', () => {
          const testDate = new Date(2025, 5, 15);
          render(
               <OrderDeliveryDatePicker
                    selectedDeliveryDate={testDate}
                    label="Delivery Date"
                    onDatePicked={mockOnDatePicked}
               />
          );

          // Should render the date input field
          const input = screen.getByRole('textbox');
          expect(input).toBeInTheDocument();
     });

     it('should show clear button when date is selected', () => {
          const testDate = new Date(2025, 5, 15);
          render(
               <OrderDeliveryDatePicker
                    selectedDeliveryDate={testDate}
                    label="Delivery Date"
                    onDatePicked={mockOnDatePicked}
               />
          );

          const clearButton = screen.getByText('✕');
          expect(clearButton).toBeInTheDocument();
     });

     it('should not show clear button when no date is selected', () => {
          render(
               <OrderDeliveryDatePicker
                    selectedDeliveryDate={undefined}
                    label="Delivery Date"
                    onDatePicked={mockOnDatePicked}
               />
          );

          expect(screen.queryByText('✕')).not.toBeInTheDocument();
     });

     it('should call onDatePicked with undefined when clear button is clicked', () => {
          const testDate = new Date(2025, 5, 15);
          render(
               <OrderDeliveryDatePicker
                    selectedDeliveryDate={testDate}
                    label="Delivery Date"
                    onDatePicked={mockOnDatePicked}
               />
          );

          const clearButton = screen.getByText('✕');
          clearButton.click();

          expect(mockOnDatePicked).toHaveBeenCalledWith(undefined);
     });

     it('should be disabled when disabled prop is true', () => {
          render(
               <OrderDeliveryDatePicker
                    selectedDeliveryDate={undefined}
                    label="Delivery Date"
                    onDatePicked={mockOnDatePicked}
                    disabled
               />
          );

          const input = screen.getByRole('textbox');
          expect(input).toBeDisabled();
     });

     it('should render with a provided date value', () => {
          const testDate = new Date(2025, 0, 10);
          render(
               <OrderDeliveryDatePicker
                    selectedDeliveryDate={testDate}
                    label="Delivery Date"
                    onDatePicked={mockOnDatePicked}
               />
          );

          const input = screen.getByRole('textbox') as HTMLInputElement;
          // The input should have some value (formatted date)
          expect(input.value).not.toBe('');
     });
});
