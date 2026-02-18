import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import { screen, render as baseRender } from 'src/test/test-utils';

import { ShipmentDeliveryDatePicker } from './shipment-delivery-date-picker';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) =>
     baseRender(<LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>, { theme: testTheme });

const mockOnDatePicked = vi.fn();

describe('ShipmentDeliveryDatePicker', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render the label', () => {
          render(<ShipmentDeliveryDatePicker selectedDeliveryDate={undefined} onDatePicked={mockOnDatePicked} />);

          const labels = screen.getAllByText('outgoingShipments.deliveryDate');
          expect(labels.length).toBeGreaterThanOrEqual(1);
     });

     it('should display the date input field', () => {
          const testDate = new Date(2025, 5, 15);
          render(<ShipmentDeliveryDatePicker selectedDeliveryDate={testDate} onDatePicked={mockOnDatePicked} />);

          const input = screen.getByRole('textbox');
          expect(input).toBeInTheDocument();
     });

     it('should show clear button when a date is selected', () => {
          const testDate = new Date(2025, 5, 15);
          render(<ShipmentDeliveryDatePicker selectedDeliveryDate={testDate} onDatePicked={mockOnDatePicked} />);

          const clearButton = screen.getByText('✕');
          expect(clearButton).toBeInTheDocument();
     });

     it('should not show clear button when no date is selected', () => {
          render(<ShipmentDeliveryDatePicker selectedDeliveryDate={undefined} onDatePicked={mockOnDatePicked} />);

          expect(screen.queryByText('✕')).not.toBeInTheDocument();
     });

     it('should call onDatePicked with null when clear button is clicked', async () => {
          const testDate = new Date(2025, 5, 15);
          render(<ShipmentDeliveryDatePicker selectedDeliveryDate={testDate} onDatePicked={mockOnDatePicked} />);

          const clearButton = screen.getByText('✕');
          clearButton.click();

          expect(mockOnDatePicked).toHaveBeenCalledWith(null);
     });

     it('should be disabled when disabled prop is true', () => {
          render(
               <ShipmentDeliveryDatePicker selectedDeliveryDate={undefined} onDatePicked={mockOnDatePicked} disabled />
          );

          const input = screen.getByRole('textbox');
          expect(input).toBeDisabled();
     });

     it('should show error state when shouldValidate is true and no date is selected', () => {
          const { container } = render(
               <ShipmentDeliveryDatePicker
                    selectedDeliveryDate={undefined}
                    onDatePicked={mockOnDatePicked}
                    shouldValidate
               />
          );

          const input = container.querySelector('.MuiInputBase-root');
          expect(input).toHaveClass('Mui-error');
     });
});
