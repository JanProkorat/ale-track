import { it, vi, expect, describe, beforeEach } from 'vitest';

import { VehicleDto } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { VehicleSelect } from './vehicle-select';

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

describe('VehicleSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <VehicleSelect
                selectedVehicleId={undefined}
                vehicles={mockVehicles}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('productDeliveries.selectedVehicle')).toBeInTheDocument();
    });

    it('should render a chip with the selected vehicle name', () => {
        render(
            <VehicleSelect
                selectedVehicleId="v1"
                vehicles={mockVehicles}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('Truck A')).toBeInTheDocument();
    });

    it('should render all vehicle options when opened', async () => {
        render(
            <VehicleSelect
                selectedVehicleId={undefined}
                vehicles={mockVehicles}
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
            <VehicleSelect
                selectedVehicleId="v2"
                vehicles={mockVehicles}
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

    it('should call onSelect with vehicle id when selecting', async () => {
        render(
            <VehicleSelect
                selectedVehicleId={undefined}
                vehicles={mockVehicles}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[0].click();

        expect(mockOnSelect).toHaveBeenCalledWith('v1');
    });

    it('should show error state when shouldValidate is true and no vehicle selected', () => {
        render(
            <VehicleSelect
                selectedVehicleId={undefined}
                vehicles={mockVehicles}
                shouldValidate
                onSelect={mockOnSelect}
            />
        );

        const label = screen.getByText('productDeliveries.selectedVehicle');
        expect(label).toHaveClass('Mui-error');
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <VehicleSelect
                selectedVehicleId={undefined}
                vehicles={mockVehicles}
                shouldValidate={false}
                onSelect={mockOnSelect}
                disabled
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-disabled', 'true');
    });
});
