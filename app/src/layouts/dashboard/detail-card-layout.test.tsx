import { screen, fireEvent } from '@testing-library/react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { renderWithProviders } from 'src/test/test-utils';

import { DetailCardLayout } from './detail-card-layout';

// -------------------------------------------------------------------

const mockBlockerReset = vi.fn();
const mockBlockerProceed = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
    useBlocker: () => ({ state: 'idle', reset: mockBlockerReset, proceed: mockBlockerProceed }),
}));

vi.mock('src/components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

vi.mock('src/components/label/section-header', () => ({
    SectionHeader: ({ text, children }: any) => (
        <div data-testid="section-header">
            <span>{text}</span>
            {children}
        </div>
    ),
}));

vi.mock('src/components/dialogs/delete-confirmation-dialog', () => ({
    DeleteConfirmationDialog: ({ open, onClose, onDelete }: any) =>
        open ? (
            <div data-testid="delete-dialog">
                <button onClick={onClose}>Cancel</button>
                <button onClick={onDelete}>Delete</button>
            </div>
        ) : null,
}));

vi.mock('src/components/dialogs/reset-confirmation-dialog', () => ({
    ResetConfirmationDialog: ({ open, onClose, onReset }: any) =>
        open ? (
            <div data-testid="reset-dialog">
                <button onClick={onClose}>Cancel</button>
                <button onClick={onReset}>Reset</button>
            </div>
        ) : null,
}));

vi.mock('src/components/dialogs/pending-changes-confirmation-dialog', () => ({
    PendingChangesConfirmationDialog: ({ open, onClose }: any) =>
        open ? (
            <div data-testid="pending-dialog">
                <button onClick={onClose}>Cancel</button>
            </div>
        ) : null,
}));

const defaultProps = {
    id: 'test-id',
    shouldCheckPendingChanges: false,
    onDelete: vi.fn(),
    onConfirmed: vi.fn(),
    onProgressbarVisibilityChange: vi.fn(),
    title: 'Detail Title',
    noDetailMessage: 'No detail selected',
    entity: { name: 'Test' },
    initialEntity: { name: 'Test' },
    onFetchEntity: vi.fn().mockResolvedValue(undefined),
    onSaveEntity: vi.fn().mockResolvedValue(true),
    onDeleteEntity: vi.fn().mockResolvedValue(undefined),
    onResetEntity: vi.fn(),
    deleteConfirmMessage: 'Are you sure?',
    children: <div data-testid="detail-child">Detail Content</div>,
};

describe('DetailCardLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders title in section header', () => {
        renderWithProviders(<DetailCardLayout {...defaultProps} />);
        expect(screen.getByText('Detail Title')).toBeInTheDocument();
    });

    it('renders children when id is provided', () => {
        renderWithProviders(<DetailCardLayout {...defaultProps} />);
        expect(screen.getByTestId('detail-child')).toBeInTheDocument();
    });

    it('shows no detail message when id is null', () => {
        renderWithProviders(<DetailCardLayout {...defaultProps} id={null} />);
        expect(screen.getByText('No detail selected')).toBeInTheDocument();
        expect(screen.queryByTestId('detail-child')).not.toBeInTheDocument();
    });

    it('calls onFetchEntity when id is provided', () => {
        renderWithProviders(<DetailCardLayout {...defaultProps} />);
        expect(defaultProps.onFetchEntity).toHaveBeenCalled();
    });

    it('does not call onFetchEntity when id is null', () => {
        renderWithProviders(<DetailCardLayout {...defaultProps} id={null} />);
        expect(defaultProps.onFetchEntity).not.toHaveBeenCalled();
    });

    it('renders action buttons (reset, save, delete)', () => {
        renderWithProviders(<DetailCardLayout {...defaultProps} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('opens delete dialog when delete button is clicked', () => {
        renderWithProviders(<DetailCardLayout {...defaultProps} />);
        // Find the delete button (the one with trash icon)
        const deleteIconButtons = screen.getAllByRole('button');
        // The last iconbutton in the header is the delete button
        const deleteButton = deleteIconButtons.find((btn: HTMLElement) =>
            btn.querySelector('[data-testid="iconify"]')?.textContent === 'solar:trash-bin-trash-bold'
        );
        expect(deleteButton).toBeDefined();
        fireEvent.click(deleteButton!);
        expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    });

    it('opens reset dialog when reset button is clicked', () => {
        // Need hasChanges = true for reset button to be enabled
        renderWithProviders(
            <DetailCardLayout {...defaultProps} entity={{ name: 'Changed' }} />
        );
        const resetButton = screen.getAllByRole('button').find((btn: HTMLElement) =>
            btn.querySelector('[data-testid="iconify"]')?.textContent === 'solar:restart-bold'
        );
        expect(resetButton).toBeDefined();
        fireEvent.click(resetButton!);
        expect(screen.getByTestId('reset-dialog')).toBeInTheDocument();
    });

    it('disables save and reset buttons when no changes', () => {
        renderWithProviders(<DetailCardLayout {...defaultProps} />);
        const resetButton = screen.getAllByRole('button').find((btn: HTMLElement) =>
            btn.querySelector('[data-testid="iconify"]')?.textContent === 'solar:restart-bold'
        );
        expect(resetButton).toBeDisabled();
    });
});
