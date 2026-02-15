import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { VehiclesTableRow } from './vehicles-table-row';

import type { VehiclesProps } from './vehicles-table-row';

vi.mock('src/components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

const mockRow: VehiclesProps = {
    id: 'v1',
    name: 'Truck A',
    maxWeight: 1500,
};

const mockOnSelectRow = vi.fn();
const mockOnRowClick = vi.fn();
const mockOnDeleteClick = vi.fn();

const renderInTable = (ui: React.ReactElement) =>
    render(<table><tbody>{ui}</tbody></table>);

describe('VehiclesTableRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render vehicle name', () => {
        renderInTable(
            <VehiclesTableRow
                row={mockRow}
                selected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
                onDeleteClick={mockOnDeleteClick}
            />
        );

        expect(screen.getByText('Truck A')).toBeInTheDocument();
    });

    it('should render max weight', () => {
        renderInTable(
            <VehiclesTableRow
                row={mockRow}
                selected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
                onDeleteClick={mockOnDeleteClick}
            />
        );

        expect(screen.getByText('1500 Kg')).toBeInTheDocument();
    });

    it('should show checkbox checked when selected', () => {
        const { container } = renderInTable(
            <VehiclesTableRow
                row={mockRow}
                selected
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
                onDeleteClick={mockOnDeleteClick}
            />
        );

        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('should call onSelectRow when checkbox is clicked', () => {
        const { container } = renderInTable(
            <VehiclesTableRow
                row={mockRow}
                selected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
                onDeleteClick={mockOnDeleteClick}
            />
        );

        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        fireEvent.click(checkbox);

        expect(mockOnSelectRow).toHaveBeenCalled();
    });

    it('should call onRowClick when name cell is clicked', () => {
        renderInTable(
            <VehiclesTableRow
                row={mockRow}
                selected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
                onDeleteClick={mockOnDeleteClick}
            />
        );

        screen.getByText('Truck A').click();
        expect(mockOnRowClick).toHaveBeenCalled();
    });

    it('should call onDeleteClick when delete button is clicked', () => {
        renderInTable(
            <VehiclesTableRow
                row={mockRow}
                selected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
                onDeleteClick={mockOnDeleteClick}
            />
        );

        const deleteButton = screen.getByRole('button');
        deleteButton.click();
        expect(mockOnDeleteClick).toHaveBeenCalled();
    });
});
