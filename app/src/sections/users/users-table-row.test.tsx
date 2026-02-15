import { it, vi, expect, describe, beforeEach } from 'vitest';

import { UserListItemDto } from 'src/api/Client';
import { screen, render, fireEvent } from 'src/test/test-utils';

import { UsersTableRow } from './users-table-row';

const mockRow = new UserListItemDto({
    id: 'u1',
    userName: 'john.doe',
    firstName: 'John',
    lastName: 'Doe',
    userRoles: [],
});

const mockOnSelectRow = vi.fn();
const mockOnRowClick = vi.fn();

const renderInTable = (ui: React.ReactElement) =>
    render(<table><tbody>{ui}</tbody></table>);

describe('UsersTableRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render user name', () => {
        renderInTable(
            <UsersTableRow
                row={mockRow}
                selected={false}
                isSelected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
            />
        );

        expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    it('should show checkbox unchecked when not selected', () => {
        const { container } = renderInTable(
            <UsersTableRow
                row={mockRow}
                selected={false}
                isSelected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
            />
        );

        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
    });

    it('should show checkbox checked when selected', () => {
        const { container } = renderInTable(
            <UsersTableRow
                row={mockRow}
                selected
                isSelected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
            />
        );

        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('should call onSelectRow when checkbox is clicked', () => {
        const { container } = renderInTable(
            <UsersTableRow
                row={mockRow}
                selected={false}
                isSelected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
            />
        );

        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        fireEvent.click(checkbox);

        expect(mockOnSelectRow).toHaveBeenCalled();
    });

    it('should call onRowClick when userName cell is clicked', () => {
        renderInTable(
            <UsersTableRow
                row={mockRow}
                selected={false}
                isSelected={false}
                onSelectRow={mockOnSelectRow}
                onRowClick={mockOnRowClick}
            />
        );

        screen.getByText('john.doe').click();

        expect(mockOnRowClick).toHaveBeenCalled();
    });
});
