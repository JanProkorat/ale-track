import { it, vi, expect, describe, beforeEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';

import { renderWithProviders } from 'src/test/test-utils';

import { SortableTableHead } from './sortable-table-head';

// -------------------------------------------------------------------

const headLabel = [
    { id: 'name', label: 'Name', width: 200 },
    { id: 'status', label: 'Status', align: 'center' },
    { id: '', label: '' },
];

const defaultProps = {
    order: 'asc' as const,
    orderBy: 'name',
    rowCount: 10,
    numSelected: 0,
    onSort: vi.fn(),
    headLabel,
    onSelectAllRows: vi.fn(),
};

function renderHead(overrides = {}) {
    return renderWithProviders(
        <table>
            <SortableTableHead {...defaultProps} {...overrides} />
        </table>
    );
}

describe('SortableTableHead', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all head labels', () => {
        renderHead();
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('renders checkbox by default', () => {
        renderHead();
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('hides checkbox when checkboxVisible is false', () => {
        renderHead({ checkboxVisible: false });
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('checkbox is unchecked when numSelected is 0', () => {
        renderHead();
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
    });

    it('checkbox is checked when all rows are selected', () => {
        renderHead({ numSelected: 10, rowCount: 10 });
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('checkbox is not fully checked when some rows are selected', () => {
        renderHead({ numSelected: 3, rowCount: 10 });
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
    });

    it('calls onSelectAllRows when checkbox is clicked', () => {
        const onSelectAllRows = vi.fn();
        renderHead({ onSelectAllRows });
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onSelectAllRows).toHaveBeenCalledTimes(1);
    });

    it('calls onSort when a column header is clicked', () => {
        const onSort = vi.fn();
        renderHead({ onSort });
        fireEvent.click(screen.getByText('Name'));
        expect(onSort).toHaveBeenCalledWith('name');
    });

    it('calls onSort with correct id for different columns', () => {
        const onSort = vi.fn();
        renderHead({ onSort });
        fireEvent.click(screen.getByText('Status'));
        expect(onSort).toHaveBeenCalledWith('status');
    });

    it('shows sort direction text for active column', () => {
        renderHead({ orderBy: 'name', order: 'asc' });
        expect(screen.getByText('sorted ascending')).toBeInTheDocument();
    });

    it('shows descending text when order is desc', () => {
        renderHead({ orderBy: 'name', order: 'desc' });
        expect(screen.getByText('sorted descending')).toBeInTheDocument();
    });

    it('does not show sort direction for inactive columns', () => {
        renderHead({ orderBy: 'name' });
        const statusCell = screen.getByText('Status').closest('th')!;
        expect(within(statusCell).queryByText(/sorted/)).not.toBeInTheDocument();
    });
});
