import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { NotesView } from './notes-view';
import { NoteDto, SectionType } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference
const mockT = (key: string) => key;

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
const mockExecuteApiCallWithDefault = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
     useApiCall: () => ({
          executeApiCall: mockExecuteApiCall,
          executeApiCallWithDefault: mockExecuteApiCallWithDefault,
     }),
}));

// Mock AuthorizedClient
const mockGetClientNotesEndpoint = vi.fn();
const mockDeleteClientNoteEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class MockAuthorizedClient {
          getClientNotesEndpoint = mockGetClientNotesEndpoint;
          deleteClientNoteEndpoint = mockDeleteClientNoteEndpoint;
          createClientNoteEndpoint = vi.fn();
          updateClientNoteEndpoint = vi.fn();
     },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
     useSnackbar: () => ({
          showSnackbar: mockShowSnackbar,
     }),
}));

// Mock EntityStatsContext
vi.mock('../../../providers/EntityStatsContext', () => ({
     useEntityStatsRefresh: () => ({
          triggerRefresh: vi.fn(),
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

// Mock NoteDetailView (heavy child – tested separately)
vi.mock('./components/note-detail-view', () => ({
     __esModule: true,
     default: ({ onClose }: { onClose: (refresh: boolean) => void }) => (
          <div data-testid="note-detail-view">
               <button type="button" onClick={() => onClose(true)}>
                    close-detail
               </button>
          </div>
     ),
}));

// --- Test data ---
const mockNotes: NoteDto[] = [
     new NoteDto({ id: 'note-1', text: 'First test note' }),
     new NoteDto({ id: 'note-2', text: 'Second test note' }),
];

const defaultProps = {
     parentId: 'client-1',
     parentType: SectionType.Client,
};

describe('NotesView', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mockExecuteApiCallWithDefault.mockImplementation((apiCall: () => Promise<unknown>, defaultValue: unknown) =>
               apiCall().catch(() => defaultValue)
          );
          mockGetClientNotesEndpoint.mockResolvedValue(mockNotes);
     });

     // --- Title ---
     it('should render the section title', async () => {
          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(screen.getByText('notes.title')).toBeInTheDocument();
          });
     });

     // --- New button ---
     it('should render the "new" button', async () => {
          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: /notes\.new/i })).toBeInTheDocument();
          });
     });

     // --- Fetch notes on mount ---
     it('should fetch notes on mount for Client section type', async () => {
          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(mockGetClientNotesEndpoint).toHaveBeenCalledWith('client-1');
          });
     });

     // --- Display notes list ---
     it('should display notes in the list', async () => {
          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(screen.getByText('First test note')).toBeInTheDocument();
               expect(screen.getByText('Second test note')).toBeInTheDocument();
          });
     });

     // --- Empty state ---
     it('should show empty state when no notes exist', async () => {
          mockGetClientNotesEndpoint.mockResolvedValue([]);

          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(screen.getByText('notes.noDataTitle')).toBeInTheDocument();
               expect(screen.getByText('notes.noDataMessage')).toBeInTheDocument();
          });
     });

     // --- Open create drawer ---
     it('should open the create note drawer when "new" button is clicked', async () => {
          const user = userEvent.setup();
          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(screen.getByText('First test note')).toBeInTheDocument();
          });

          await user.click(screen.getByRole('button', { name: /notes\.new/i }));

          await waitFor(() => {
               expect(screen.getByTestId('note-detail-view')).toBeInTheDocument();
          });
     });

     // --- Open edit drawer ---
     it('should open the edit note drawer when edit button is clicked', async () => {
          const user = userEvent.setup();
          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(screen.getByText('First test note')).toBeInTheDocument();
          });

          // Click the edit (pen) icon button — inherit color icon buttons
          const editButtons = document.querySelectorAll('.MuiIconButton-colorInherit');
          expect(editButtons.length).toBeGreaterThan(0);
          await user.click(editButtons[0] as HTMLElement);

          await waitFor(() => {
               expect(screen.getByTestId('note-detail-view')).toBeInTheDocument();
          });
     });

     // --- Delete note ---
     it('should delete a note when delete button is clicked', async () => {
          const user = userEvent.setup();
          mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
          mockDeleteClientNoteEndpoint.mockResolvedValue('ok');

          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(screen.getByText('First test note')).toBeInTheDocument();
          });

          // Click the delete (error color) icon button on the first note
          const deleteButtons = document.querySelectorAll('.MuiIconButton-colorError');
          expect(deleteButtons.length).toBeGreaterThan(0);
          await user.click(deleteButtons[0] as HTMLElement);

          await waitFor(() => {
               expect(mockDeleteClientNoteEndpoint).toHaveBeenCalledWith('note-1');
               expect(mockShowSnackbar).toHaveBeenCalledWith('notes.deleteSuccess', 'success');
          });
     });

     // --- Popover on note click ---
     it('should show popover with full note text when note is clicked', async () => {
          const user = userEvent.setup();
          render(<NotesView {...defaultProps} />);

          await waitFor(() => {
               expect(screen.getByText('First test note')).toBeInTheDocument();
          });

          // Click on the note list item text
          await user.click(screen.getByText('First test note'));

          // Popover shows the full text (appears a second time in the popover)
          await waitFor(() => {
               expect(screen.getAllByText('First test note').length).toBeGreaterThanOrEqual(2);
          });
     });

     // --- Does not fetch for non-Client type ---
     it('should not fetch notes for Brewery section type', () => {
          render(<NotesView parentId="brewery-1" parentType={SectionType.Brewery} />);

          expect(mockGetClientNotesEndpoint).not.toHaveBeenCalled();
     });
});
