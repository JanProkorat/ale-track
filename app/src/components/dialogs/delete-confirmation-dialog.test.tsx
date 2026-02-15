import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render } from 'src/test/test-utils';

import { DeleteConfirmationDialog } from './delete-confirmation-dialog';

const mockOnClose = vi.fn();
const mockOnDelete = vi.fn();

describe('DeleteConfirmationDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render confirmation message when open', () => {
        render(
            <DeleteConfirmationDialog
                open
                onClose={mockOnClose}
                onDelete={mockOnDelete}
                deleteConfirmMessage="Are you sure you want to delete?"
                cancelLabel="Cancel"
                deleteLabel="Delete"
            />
        );

        expect(screen.getByText('Are you sure you want to delete?')).toBeInTheDocument();
    });

    it('should render cancel and delete buttons', () => {
        render(
            <DeleteConfirmationDialog
                open
                onClose={mockOnClose}
                onDelete={mockOnDelete}
                deleteConfirmMessage="Delete this item?"
                cancelLabel="Cancel"
                deleteLabel="Delete"
            />
        );

        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', () => {
        render(
            <DeleteConfirmationDialog
                open
                onClose={mockOnClose}
                onDelete={mockOnDelete}
                deleteConfirmMessage="Delete?"
                cancelLabel="Cancel"
                deleteLabel="Delete"
            />
        );

        screen.getByText('Cancel').click();

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onDelete when delete button is clicked', () => {
        render(
            <DeleteConfirmationDialog
                open
                onClose={mockOnClose}
                onDelete={mockOnDelete}
                deleteConfirmMessage="Delete?"
                cancelLabel="Cancel"
                deleteLabel="Delete"
            />
        );

        screen.getByText('Delete').click();

        expect(mockOnDelete).toHaveBeenCalled();
    });

    it('should not render content when closed', () => {
        render(
            <DeleteConfirmationDialog
                open={false}
                onClose={mockOnClose}
                onDelete={mockOnDelete}
                deleteConfirmMessage="Delete?"
                cancelLabel="Cancel"
                deleteLabel="Delete"
            />
        );

        expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
    });
});
