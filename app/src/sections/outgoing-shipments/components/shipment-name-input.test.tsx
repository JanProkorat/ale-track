import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { ShipmentNameInput } from './shipment-name-input';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockOnNameChange = vi.fn();

describe('ShipmentNameInput', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <ShipmentNameInput
                shipmentName=""
                shouldValidate={false}
                onNameChange={mockOnNameChange}
            />
        );

        expect(screen.getAllByText('outgoingShipments.name').length).toBeGreaterThanOrEqual(1);
    });

    it('should display the current shipment name', () => {
        render(
            <ShipmentNameInput
                shipmentName="Test Shipment"
                shouldValidate={false}
                onNameChange={mockOnNameChange}
            />
        );

        const input = screen.getByDisplayValue('Test Shipment');
        expect(input).toBeInTheDocument();
    });

    it('should call onNameChange when user types', () => {
        render(
            <ShipmentNameInput
                shipmentName=""
                shouldValidate={false}
                onNameChange={mockOnNameChange}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Name' } });

        expect(mockOnNameChange).toHaveBeenCalledWith('New Name');
    });

    it('should show error state when shouldValidate is true and name is empty', () => {
        render(
            <ShipmentNameInput
                shipmentName=""
                shouldValidate
                onNameChange={mockOnNameChange}
            />
        );

        const labels = screen.getAllByText('outgoingShipments.name');
        expect(labels[0]).toHaveClass('Mui-error');
    });

    it('should not show error state when shouldValidate is true and name is provided', () => {
        render(
            <ShipmentNameInput
                shipmentName="Valid Name"
                shouldValidate
                onNameChange={mockOnNameChange}
            />
        );

        const labels = screen.getAllByText('outgoingShipments.name');
        expect(labels[0]).not.toHaveClass('Mui-error');
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <ShipmentNameInput
                shipmentName=""
                shouldValidate={false}
                onNameChange={mockOnNameChange}
                disabled
            />
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });
});
