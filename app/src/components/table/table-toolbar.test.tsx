import { screen } from '@testing-library/react';
import { it, vi, expect, describe } from 'vitest';

import { renderWithProviders } from 'src/test/test-utils';

import { TableToolbar } from './table-toolbar';

// -------------------------------------------------------------------

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('TableToolbar', () => {
    it('renders filters when nothing is selected', () => {
        renderWithProviders(
            <TableToolbar
                numSelected={0}
                filters={[<input key="f1" placeholder="Filter 1" />]}
            />
        );
        expect(screen.getByPlaceholderText('Filter 1')).toBeInTheDocument();
    });

    it('renders multiple filters', () => {
        renderWithProviders(
            <TableToolbar
                numSelected={0}
                filters={[
                    <input key="f1" placeholder="Filter A" />,
                    <input key="f2" placeholder="Filter B" />,
                ]}
            />
        );
        expect(screen.getByPlaceholderText('Filter A')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Filter B')).toBeInTheDocument();
    });

    it('shows selected count when items are selected', () => {
        renderWithProviders(<TableToolbar numSelected={5} filters={[]} />);
        expect(screen.getByText(/table\.selected/)).toBeInTheDocument();
        expect(screen.getByText(/5/)).toBeInTheDocument();
    });

    it('hides filters when items are selected', () => {
        renderWithProviders(
            <TableToolbar
                numSelected={3}
                filters={[<input key="f1" placeholder="Hidden filter" />]}
            />
        );
        expect(screen.queryByPlaceholderText('Hidden filter')).not.toBeInTheDocument();
    });

    it('shows filters when numSelected is 0', () => {
        renderWithProviders(
            <TableToolbar
                numSelected={0}
                filters={[<span key="f1">Visible</span>]}
            />
        );
        expect(screen.getByText('Visible')).toBeInTheDocument();
        expect(screen.queryByText(/table\.selected/)).not.toBeInTheDocument();
    });

    it('renders with empty filters array', () => {
        const { container } = renderWithProviders(
            <TableToolbar numSelected={0} filters={[]} />
        );
        expect(container.firstElementChild).toBeInTheDocument();
    });
});
