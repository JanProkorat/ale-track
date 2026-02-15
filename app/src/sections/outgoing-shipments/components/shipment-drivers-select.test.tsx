import { fireEvent } from '@testing-library/react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { DriverDto } from 'src/api/Client';
import { screen, render, within } from 'src/test/test-utils';

import { ShipmentDriversSelect } from './shipment-drivers-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockDrivers: DriverDto[] = [
    new DriverDto({ id: 'd1', firstName: 'John', lastName: 'Doe', phoneNumber: '123' }),
    new DriverDto({ id: 'd2', firstName: 'Jane', lastName: 'Smith', phoneNumber: '456' }),
    new DriverDto({ id: 'd3', firstName: 'Bob', lastName: 'Brown', phoneNumber: '789' }),
];

const mockOnSelect = vi.fn();

describe('ShipmentDriversSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <ShipmentDriversSelect
                drivers={mockDrivers}
                selectedDriverIds={[]}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('outgoingShipments.drivers')).toBeInTheDocument();
    });

    it('should render chips for selected drivers', () => {
        render(
            <ShipmentDriversSelect
                drivers={mockDrivers}
                selectedDriverIds={['d1', 'd2']}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should render all driver options when opened', async () => {
        render(
            <ShipmentDriversSelect
                drivers={mockDrivers}
                selectedDriverIds={[]}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options).toHaveLength(3);
    });

    it('should show checked checkboxes for selected drivers', async () => {
        render(
            <ShipmentDriversSelect
                drivers={mockDrivers}
                selectedDriverIds={['d1']}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const checkboxes = within(listbox).getAllByRole('checkbox');
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).not.toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
    });

    it('should show error state when shouldValidate is true and no drivers selected', () => {
        render(
            <ShipmentDriversSelect
                drivers={mockDrivers}
                selectedDriverIds={[]}
                shouldValidate
                onSelect={mockOnSelect}
            />
        );

        const label = screen.getByText('outgoingShipments.drivers');
        expect(label).toHaveClass('Mui-error');
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <ShipmentDriversSelect
                drivers={mockDrivers}
                selectedDriverIds={[]}
                shouldValidate={false}
                onSelect={mockOnSelect}
                disabled
            />
        );

        // MUI Select renders a hidden input that is disabled
        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-disabled', 'true');
    });
});
