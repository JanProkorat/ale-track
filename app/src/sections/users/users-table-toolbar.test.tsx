import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';

import { UsersTableToolbar } from './users-table-toolbar';

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

const mockOnFilterUserName = vi.fn();

describe('UsersTableToolbar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the search input with placeholder', () => {
        render(
            <UsersTableToolbar
                numSelected={0}
                filterUserName={null}
                onFilterUserName={mockOnFilterUserName}
            />
        );

        expect(screen.getByPlaceholderText('users.userName...')).toBeInTheDocument();
    });

    it('should display the current filter value', () => {
        render(
            <UsersTableToolbar
                numSelected={0}
                filterUserName="john"
                onFilterUserName={mockOnFilterUserName}
            />
        );

        expect(screen.getByDisplayValue('john')).toBeInTheDocument();
    });

    it('should call onFilterUserName when input changes', () => {
        render(
            <UsersTableToolbar
                numSelected={0}
                filterUserName=""
                onFilterUserName={mockOnFilterUserName}
            />
        );

        const input = screen.getByPlaceholderText('users.userName...');
        fireEvent.change(input, { target: { value: 'jane' } });

        expect(mockOnFilterUserName).toHaveBeenCalledWith('jane');
    });

    it('should pass numSelected to TableToolbar', () => {
        render(
            <UsersTableToolbar
                numSelected={3}
                filterUserName={null}
                onFilterUserName={mockOnFilterUserName}
            />
        );

        const toolbar = screen.getByTestId('table-toolbar');
        expect(toolbar).toHaveAttribute('data-num-selected', '3');
    });
});
