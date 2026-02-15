import { it, vi, expect, describe, beforeEach } from 'vitest';

import { DriverDto } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { DriversSelect } from './drivers-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockDrivers: DriverDto[] = [
    new DriverDto({ id: 'd1', firstName: 'John', lastName: 'Doe' }),
    new DriverDto({ id: 'd2', firstName: 'Jane', lastName: 'Smith' }),
    new DriverDto({ id: 'd3', firstName: 'Bob', lastName: 'Brown' }),
];

const mockOnSelect = vi.fn();

describe('DriversSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <DriversSelect
                selectedDriverIds={[]}
                drivers={mockDrivers}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('productDeliveries.selectedDrivers')).toBeInTheDocument();
    });

    it('should render chips for selected drivers', () => {
        render(
            <DriversSelect
                selectedDriverIds={['d1', 'd3']}
                drivers={mockDrivers}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Bob Brown')).toBeInTheDocument();
    });

    it('should render all driver options when opened', async () => {
        render(
            <DriversSelect
                selectedDriverIds={[]}
                drivers={mockDrivers}
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
            <DriversSelect
                selectedDriverIds={['d1']}
                drivers={mockDrivers}
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
            <DriversSelect
                selectedDriverIds={[]}
                drivers={mockDrivers}
                shouldValidate
                onSelect={mockOnSelect}
            />
        );

        const label = screen.getByText('productDeliveries.selectedDrivers');
        expect(label).toHaveClass('Mui-error');
    });

    it('should not show error when drivers are selected and shouldValidate is true', () => {
        render(
            <DriversSelect
                selectedDriverIds={['d1']}
                drivers={mockDrivers}
                shouldValidate
                onSelect={mockOnSelect}
            />
        );

        const label = screen.getAllByText('productDeliveries.selectedDrivers')[0];
        expect(label).not.toHaveClass('Mui-error');
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <DriversSelect
                selectedDriverIds={[]}
                drivers={mockDrivers}
                shouldValidate={false}
                onSelect={mockOnSelect}
                disabled
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-disabled', 'true');
    });
});
