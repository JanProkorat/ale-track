import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import { screen, render as baseRender } from 'src/test/test-utils';

import { DeliveryDatePicker } from './delivery-date-picker';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) =>
    baseRender(
        <LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>,
        { theme: testTheme }
    );

const mockOnDatePicked = vi.fn();

describe('DeliveryDatePicker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <DeliveryDatePicker
                selectedDeliveryDate={undefined}
                onDatePicked={mockOnDatePicked}
            />
        );

        const labels = screen.getAllByText('productDeliveries.deliveryDate');
        expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it('should display the date input field', () => {
        const testDate = new Date(2025, 5, 15);
        render(
            <DeliveryDatePicker
                selectedDeliveryDate={testDate}
                onDatePicked={mockOnDatePicked}
            />
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <DeliveryDatePicker
                selectedDeliveryDate={undefined}
                onDatePicked={mockOnDatePicked}
                disabled
            />
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });
});
