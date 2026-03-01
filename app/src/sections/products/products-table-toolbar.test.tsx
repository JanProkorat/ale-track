import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { ProductsTableToolbar } from './products-table-toolbar';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../components/iconify', () => ({
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
const mockOnFilterType = vi.fn();

describe('ProductsTableToolbar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the search input with placeholder', () => {
        render(
            <ProductsTableToolbar
                numSelected={0}
                filterName=""
                filterType={undefined}
                onFilterType={mockOnFilterType}
                onFilterName={mockOnFilterName}
            />
        );

        expect(screen.getByPlaceholderText('products.name')).toBeInTheDocument();
    });

    it('should display the current filter value', () => {
        render(
            <ProductsTableToolbar
                numSelected={0}
                filterName="pilsner"
                filterType={undefined}
                onFilterType={mockOnFilterType}
                onFilterName={mockOnFilterName}
            />
        );

        expect(screen.getByDisplayValue('pilsner')).toBeInTheDocument();
    });

    it('should call onFilterName when input changes', () => {
        render(
            <ProductsTableToolbar
                numSelected={0}
                filterName=""
                filterType={undefined}
                onFilterType={mockOnFilterType}
                onFilterName={mockOnFilterName}
            />
        );

        const input = screen.getByPlaceholderText('products.name');
        fireEvent.change(input, { target: { value: 'lager' } });

        expect(mockOnFilterName).toHaveBeenCalled();
    });

    it('should pass numSelected to TableToolbar', () => {
        render(
            <ProductsTableToolbar
                numSelected={5}
                filterName=""
                filterType={undefined}
                onFilterType={mockOnFilterType}
                onFilterName={mockOnFilterName}
            />
        );

        const toolbar = screen.getByTestId('table-toolbar');
        expect(toolbar).toHaveAttribute('data-num-selected', '5');
    });
});
