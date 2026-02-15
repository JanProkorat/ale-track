import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { VehiclesTableToolbar } from './vehicles-table-toolbar';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

vi.mock('src/components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

vi.mock('../../components/table/table-toolbar', () => ({
    TableToolbar: ({ numSelected, filters }: { numSelected: number; filters: React.ReactNode[] }) => (
        <div data-testid="table-toolbar" data-num-selected={numSelected}>
            {filters}
        </div>
    ),
}));

const mockOnFilterName = vi.fn();

describe('VehiclesTableToolbar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the search input with placeholder', () => {
        render(
            <VehiclesTableToolbar
                numSelected={0}
                filterName=""
                onFilterName={mockOnFilterName}
            />
        );

        expect(screen.getByPlaceholderText('vehicles.name...')).toBeInTheDocument();
    });

    it('should display the current filter value', () => {
        render(
            <VehiclesTableToolbar
                numSelected={0}
                filterName="truck"
                onFilterName={mockOnFilterName}
            />
        );

        expect(screen.getByDisplayValue('truck')).toBeInTheDocument();
    });

    it('should call onFilterName when input changes', () => {
        render(
            <VehiclesTableToolbar
                numSelected={0}
                filterName=""
                onFilterName={mockOnFilterName}
            />
        );

        const input = screen.getByPlaceholderText('vehicles.name...');
        fireEvent.change(input, { target: { value: 'van' } });

        expect(mockOnFilterName).toHaveBeenCalled();
    });

    it('should pass numSelected to TableToolbar', () => {
        render(
            <VehiclesTableToolbar
                numSelected={2}
                filterName=""
                onFilterName={mockOnFilterName}
            />
        );

        const toolbar = screen.getByTestId('table-toolbar');
        expect(toolbar).toHaveAttribute('data-num-selected', '2');
    });
});
