import { it, expect, describe } from 'vitest';

import { renderWithProviders } from 'src/test/test-utils';

import { TableEmptyRows } from './table-empty-rows';

// -------------------------------------------------------------------

describe('TableEmptyRows', () => {
    it('returns null when emptyRows is 0', () => {
        const { container } = renderWithProviders(
            <table>
                <tbody>
                    <TableEmptyRows emptyRows={0} />
                </tbody>
            </table>
        );
        expect(container.querySelector('tr')).not.toBeInTheDocument();
    });

    it('renders a row when emptyRows is greater than 0', () => {
        const { container } = renderWithProviders(
            <table>
                <tbody>
                    <TableEmptyRows emptyRows={3} />
                </tbody>
            </table>
        );
        expect(container.querySelector('tr')).toBeInTheDocument();
    });

    it('renders a cell with colSpan 9', () => {
        const { container } = renderWithProviders(
            <table>
                <tbody>
                    <TableEmptyRows emptyRows={2} />
                </tbody>
            </table>
        );
        const cell = container.querySelector('td');
        expect(cell).toHaveAttribute('colspan', '9');
    });

    it('applies height when provided', () => {
        const { container } = renderWithProviders(
            <table>
                <tbody>
                    <TableEmptyRows emptyRows={2} height={50} />
                </tbody>
            </table>
        );
        const row = container.querySelector('tr');
        expect(row).toBeInTheDocument();
    });

    it('renders without height prop', () => {
        const { container } = renderWithProviders(
            <table>
                <tbody>
                    <TableEmptyRows emptyRows={1} />
                </tbody>
            </table>
        );
        expect(container.querySelector('tr')).toBeInTheDocument();
    });
});
