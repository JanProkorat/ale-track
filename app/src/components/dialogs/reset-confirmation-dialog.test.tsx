import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render } from 'src/test/test-utils';

import { ResetConfirmationDialog } from './reset-confirmation-dialog';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockOnClose = vi.fn();
const mockOnReset = vi.fn();

describe('ResetConfirmationDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render confirmation title when open', () => {
        render(
            <ResetConfirmationDialog
                open
                onClose={mockOnClose}
                onReset={mockOnReset}
                cancelLabel="Cancel"
                resetLabel="Reset"
            />
        );

        expect(screen.getByText('common.resetConfirm')).toBeInTheDocument();
    });

    it('should render cancel and reset buttons', () => {
        render(
            <ResetConfirmationDialog
                open
                onClose={mockOnClose}
                onReset={mockOnReset}
                cancelLabel="Cancel"
                resetLabel="Reset"
            />
        );

        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('should call onClose when cancel is clicked', () => {
        render(
            <ResetConfirmationDialog
                open
                onClose={mockOnClose}
                onReset={mockOnReset}
                cancelLabel="Cancel"
                resetLabel="Reset"
            />
        );

        screen.getByText('Cancel').click();

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onReset when reset is clicked', () => {
        render(
            <ResetConfirmationDialog
                open
                onClose={mockOnClose}
                onReset={mockOnReset}
                cancelLabel="Cancel"
                resetLabel="Reset"
            />
        );

        screen.getByText('Reset').click();

        expect(mockOnReset).toHaveBeenCalled();
    });

    it('should not render content when closed', () => {
        render(
            <ResetConfirmationDialog
                open={false}
                onClose={mockOnClose}
                onReset={mockOnReset}
                cancelLabel="Cancel"
                resetLabel="Reset"
            />
        );

        expect(screen.queryByText('common.resetConfirm')).not.toBeInTheDocument();
    });
});
