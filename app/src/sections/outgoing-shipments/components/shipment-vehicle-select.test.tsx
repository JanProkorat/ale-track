import { it, vi, expect, describe, beforeEach } from 'vitest';

import { VehicleDto } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { ShipmentVehicleSelect } from './shipment-vehicle-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockVehicles: VehicleDto[] = [
    new VehicleDto({ id: 'v1', name: 'Truck A', maxWeight: 1000 }),
    new VehicleDto({ id: 'v2', name: 'Van B', maxWeight: 500 }),
    new VehicleDto({ id: 'v3', name: 'Car C', maxWeight: 200 }),
];

const mockOnSelect = vi.fn();

describe('ShipmentVehicleSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <ShipmentVehicleSelect
                vehicles={mockVehicles}
                selectedVehicleId={undefined}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('outgoingShipments.vehicle')).toBeInTheDocument();
    });

    it('should render a chip with the selected vehicle name', () => {
        render(
            <ShipmentVehicleSelect
                vehicles={mockVehicles}
                selectedVehicleId="v1"
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('Truck A')).toBeInTheDocument();
    });

    it('should render all vehicle options when opened', async () => {
        render(
            <ShipmentVehicleSelect
                vehicles={mockVehicles}
                selectedVehicleId={undefined}
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

    it('should show checked checkbox for the selected vehicle', async () => {
        render(
            <ShipmentVehicleSelect
                vehicles={mockVehicles}
                selectedVehicleId="v2"
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');

        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const checkboxes = within(listbox).getAllByRole('checkbox');
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
    });

    it('should call onSelect with vehicle id and maxWeight when selecting a new vehicle', async () => {
        render(
            <ShipmentVehicleSelect
                vehicles={mockVehicles}
                selectedVehicleId={undefined}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');

        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[0].click();

        expect(mockOnSelect).toHaveBeenCalledWith('v1', 1000);
    });

    it('should call onSelect with undefined when deselecting the same vehicle (toggle)', async () => {
        render(
            <ShipmentVehicleSelect
                vehicles={mockVehicles}
                selectedVehicleId="v1"
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');

        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[0].click();

        expect(mockOnSelect).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should show error state when shouldValidate is true and no vehicle is selected', () => {
        render(
            <ShipmentVehicleSelect
                vehicles={mockVehicles}
                selectedVehicleId={undefined}
                shouldValidate
                onSelect={mockOnSelect}
            />
        );

        const label = screen.getByText('outgoingShipments.vehicle');
        expect(label).toHaveClass('Mui-error');
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <ShipmentVehicleSelect
                vehicles={mockVehicles}
                selectedVehicleId={undefined}
                shouldValidate={false}
                onSelect={mockOnSelect}
                disabled
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-disabled', 'true');
    });
});
