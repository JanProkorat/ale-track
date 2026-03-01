import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import NoteDetailView from './note-detail-view';
import { NoteDto, SectionType } from '../../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference
const mockT = (key: string, opts?: Record<string, unknown>) => {
    if (opts?.count !== undefined) return `${key}:${opts.count}`;
    return key;
};

// Mock react-i18next (partial)
vi.mock('react-i18next', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useTranslation: () => ({ t: mockT }),
    };
});

// Mock useApiCall
const mockExecuteApiCall = vi.fn();
vi.mock('../../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
    }),
}));

// Mock AuthorizedClient
const mockCreateClientNoteEndpoint = vi.fn();
const mockUpdateClientNoteEndpoint = vi.fn();
vi.mock('../../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        createClientNoteEndpoint = mockCreateClientNoteEndpoint;
        updateClientNoteEndpoint = mockUpdateClientNoteEndpoint;
    },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({
        showSnackbar: mockShowSnackbar,
    }),
}));

// Mock EntityStatsContext
const mockTriggerRefresh = vi.fn();
vi.mock('../../../../providers/EntityStatsContext', () => ({
    useEntityStatsRefresh: () => ({
        triggerRefresh: mockTriggerRefresh,
    }),
}));

// Mock minimal-shared/utils (partial)
vi.mock('minimal-shared/utils', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        varAlpha: () => 'rgba(0,0,0,0.16)',
    };
});

const mockOnClose = vi.fn();

describe('NoteDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ==================== CREATE MODE (no id) ====================

    describe('create mode', () => {
        const newNote = new NoteDto({ text: '' });

        it('should render the form with empty text field', () => {
            render(
                <NoteDetailView
                    noteToUpdate={newNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('notes.detailTitle')).toBeInTheDocument();
            expect(screen.getByLabelText('Text')).toHaveValue('');
        });

        it('should render close and save buttons', () => {
            render(
                <NoteDetailView
                    noteToUpdate={newNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'common.saveAndClose' })).toBeInTheDocument();
        });

        it('should allow typing note text', () => {
            render(
                <NoteDetailView
                    noteToUpdate={newNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            fireEvent.change(screen.getByLabelText('Text'), {
                target: { value: 'My new note' },
            });

            expect(screen.getByLabelText('Text')).toHaveValue('My new note');
        });

        it('should show character count', () => {
            render(
                <NoteDetailView
                    noteToUpdate={newNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('0/1000')).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText('Text'), {
                target: { value: 'Hello' },
            });

            expect(screen.getByText('5/1000')).toBeInTheDocument();
        });

        it('should show validation error when saving with empty text', async () => {
            render(
                <NoteDetailView
                    noteToUpdate={newNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
            });
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('should call create API and close on successful save', async () => {
            mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
            mockCreateClientNoteEndpoint.mockResolvedValue('new-id');

            render(
                <NoteDetailView
                    noteToUpdate={newNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            fireEvent.change(screen.getByLabelText('Text'), {
                target: { value: 'My new note content' },
            });

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockCreateClientNoteEndpoint).toHaveBeenCalled();
                expect(mockTriggerRefresh).toHaveBeenCalled();
                expect(mockShowSnackbar).toHaveBeenCalledWith('notes.saveSuccess', 'success');
                expect(mockOnClose).toHaveBeenCalledWith(true);
            });
        });

        it('should not close when create API call fails', async () => {
            mockExecuteApiCall.mockImplementation(
                (_fn: () => Promise<unknown>, _?: unknown, opts?: { onError?: () => void }) => {
                    opts?.onError?.();
                    return Promise.resolve(undefined);
                }
            );

            render(
                <NoteDetailView
                    noteToUpdate={newNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            fireEvent.change(screen.getByLabelText('Text'), {
                target: { value: 'My new note content' },
            });

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockOnClose).not.toHaveBeenCalled();
            });
        });

        it('should call onClose(false) when close button is clicked', async () => {
            const user = (await import('@testing-library/user-event')).default.setup();
            render(
                <NoteDetailView
                    noteToUpdate={newNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            await user.click(screen.getByRole('button', { name: 'common.close' }));

            expect(mockOnClose).toHaveBeenCalledWith(false);
        });
    });

    // ==================== EDIT MODE (has id) ====================

    describe('edit mode', () => {
        const existingNote = new NoteDto({ id: 'note-1', text: 'Existing note text' });

        it('should render the form with existing note text', () => {
            render(
                <NoteDetailView
                    noteToUpdate={existingNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByLabelText('Text')).toHaveValue('Existing note text');
        });

        it('should update text when typing', () => {
            render(
                <NoteDetailView
                    noteToUpdate={existingNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            fireEvent.change(screen.getByLabelText('Text'), {
                target: { value: 'Updated note text' },
            });

            expect(screen.getByLabelText('Text')).toHaveValue('Updated note text');
        });

        it('should call update API when saving an existing note', async () => {
            mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
            mockUpdateClientNoteEndpoint.mockResolvedValue('ok');

            render(
                <NoteDetailView
                    noteToUpdate={existingNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockUpdateClientNoteEndpoint).toHaveBeenCalled();
                expect(mockTriggerRefresh).toHaveBeenCalled();
                expect(mockShowSnackbar).toHaveBeenCalledWith('notes.saveSuccess', 'success');
                expect(mockOnClose).toHaveBeenCalledWith(true);
            });
        });

        it('should show character count for existing text', () => {
            render(
                <NoteDetailView
                    noteToUpdate={existingNote}
                    parentId="client-1"
                    parentType={SectionType.Client}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('18/1000')).toBeInTheDocument();
        });
    });
});
