import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render } from 'src/test/test-utils';

import { PendingChangesConfirmationDialog } from './pending-changes-confirmation-dialog';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockOnClose = vi.fn();
const mockOnSave = vi.fn();
const mockOnDiscard = vi.fn();

describe('PendingChangesConfirmationDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render confirmation title when open', () => {
        render(
            <PendingChangesConfirmationDialog
                open
                onClose={mockOnClose}
                onSave={mockOnSave}
                onDiscard={mockOnDiscard}
                cancelLabel="Cancel"
                discardLabel="Discard"
                saveLabel="Save"
            />
        );

        expect(screen.getByText('common.pendingChangesConfirm')).toBeInTheDocument();
    });

    it('should render cancel, discard and save buttons', () => {
        render(
            <PendingChangesConfirmationDialog
                open
                onClose={mockOnClose}
                onSave={mockOnSave}
                onDiscard={mockOnDiscard}
                cancelLabel="Cancel"
                discardLabel="Discard"
                saveLabel="Save"
            />
        );

        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Discard')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should call onClose when cancel is clicked', () => {
        render(
            <PendingChangesConfirmationDialog
                open
                onClose={mockOnClose}
                onSave={mockOnSave}
                onDiscard={mockOnDiscard}
                cancelLabel="Cancel"
                discardLabel="Discard"
                saveLabel="Save"
            />
        );

        screen.getByText('Cancel').click();

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onDiscard when discard is clicked', () => {
        render(
            <PendingChangesConfirmationDialog
                open
                onClose={mockOnClose}
                onSave={mockOnSave}
                onDiscard={mockOnDiscard}
                cancelLabel="Cancel"
                discardLabel="Discard"
                saveLabel="Save"
            />
        );

        screen.getByText('Discard').click();

        expect(mockOnDiscard).toHaveBeenCalled();
    });

    it('should call onSave when save is clicked', () => {
        render(
            <PendingChangesConfirmationDialog
                open
                onClose={mockOnClose}
                onSave={mockOnSave}
                onDiscard={mockOnDiscard}
                cancelLabel="Cancel"
                discardLabel="Discard"
                saveLabel="Save"
            />
        );

        screen.getByText('Save').click();

        expect(mockOnSave).toHaveBeenCalled();
    });

    it('should not render content when closed', () => {
        render(
            <PendingChangesConfirmationDialog
                open={false}
                onClose={mockOnClose}
                onSave={mockOnSave}
                onDiscard={mockOnDiscard}
                cancelLabel="Cancel"
                discardLabel="Discard"
                saveLabel="Save"
            />
        );

        expect(screen.queryByText('common.pendingChangesConfirm')).not.toBeInTheDocument();
    });
});
