import { it, vi, expect, describe } from 'vitest';

import { screen, renderWithProviders } from 'src/test/test-utils';

import { TableNoData } from './table-no-data';

// -------------------------------------------------------------------

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('TableNoData', () => {
    it('renders no data title', () => {
        renderWithProviders(
            <table>
                <tbody>
                    <TableNoData colSpan={5} />
                </tbody>
            </table>
        );
        expect(screen.getByText('table.noDataTitle')).toBeInTheDocument();
    });

    it('renders no data message', () => {
        renderWithProviders(
            <table>
                <tbody>
                    <TableNoData colSpan={5} />
                </tbody>
            </table>
        );
        expect(screen.getByText('table.noDataMessage')).toBeInTheDocument();
    });

    it('renders cell with correct colSpan', () => {
        const { container } = renderWithProviders(
            <table>
                <tbody>
                    <TableNoData colSpan={4} />
                </tbody>
            </table>
        );
        const cell = container.querySelector('td');
        expect(cell).toHaveAttribute('colspan', '5'); // colSpan + 1
    });

    it('renders within a table row', () => {
        const { container } = renderWithProviders(
            <table>
                <tbody>
                    <TableNoData colSpan={3} />
                </tbody>
            </table>
        );
        const row = container.querySelector('tr');
        expect(row).toBeInTheDocument();
    });
});
