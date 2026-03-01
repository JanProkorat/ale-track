import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { ClientRemindersView } from './client-reminders-view';

import type { ReminderType, ReminderListItemDto } from '../../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference to prevent useCallback dependency changes
const mockT = (key: string) => key;
vi.mock('react-i18next', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          useTranslation: () => ({ t: mockT }),
     };
});

// Mock AuthorizedClient
const mockFetchRemindersForClient = vi.fn();
const mockSetClientReminderResolvedDateEndpoint = vi.fn();
const mockDeleteClientReminderEndpoint = vi.fn();
vi.mock('../../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class MockAuthorizedClient {
          fetchRemindersForClient = mockFetchRemindersForClient;
          setClientReminderResolvedDateEndpoint = mockSetClientReminderResolvedDateEndpoint;
          deleteClientReminderEndpoint = mockDeleteClientReminderEndpoint;
     },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../../providers/SnackbarProvider', () => ({
     useSnackbar: () => ({
          showSnackbar: mockShowSnackbar,
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

// Mock the create/update reminder drawer views to keep tests focused
vi.mock('../../../reminders/detail-view/create-reminder-view', () => ({
     __esModule: true,
     default: ({ onClose }: { onClose: (shouldRefresh: boolean) => void }) => (
          <div data-testid="create-reminder-view">
               <button type="button" onClick={() => onClose(true)}>
                    save-reminder
               </button>
               <button type="button" onClick={() => onClose(false)}>
                    cancel-reminder
               </button>
          </div>
     ),
}));

vi.mock('../../../reminders/detail-view/update-reminder-view', () => ({
     UpdateReminderView: ({ onClose }: { onClose: (shouldRefresh: boolean) => void }) => (
          <div data-testid="update-reminder-view">
               <button type="button" onClick={() => onClose(true)}>
                    save-update
               </button>
          </div>
     ),
}));

// --- Test data ---
// The API returns type as a string key (e.g. "OneTimeEvent"), and the component
// remaps it via ReminderType[r.type!] to the numeric enum value.
const mockOneTimeReminders = [
     {
          id: 'reminder-1',
          name: 'Contract Review',
          description: 'Review client contract terms',
          occurrenceDate: new Date('2026-06-15'),
          isResolved: false,
          type: 'OneTimeEvent' as unknown as ReminderType,
     },
     {
          id: 'reminder-2',
          name: 'Payment Due',
          description: 'Outstanding invoice payment',
          occurrenceDate: new Date('2026-09-01'),
          isResolved: true,
          type: 'OneTimeEvent' as unknown as ReminderType,
     },
] as ReminderListItemDto[];

const mockRegularReminders = [
     {
          id: 'reminder-3',
          name: 'Weekly Delivery',
          description: 'Regular delivery schedule check',
          isResolved: false,
          type: 'Regular' as unknown as ReminderType,
          recurrenceType: 0, // Weekly
          daysOfWeek: [1, 5], // Monday, Friday
     },
] as ReminderListItemDto[];

const allReminders = [...mockOneTimeReminders, ...mockRegularReminders];

describe('ClientRemindersView', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mockFetchRemindersForClient.mockResolvedValue([]);
     });

     // --- Empty state ---
     it('should show empty state when no reminders exist', async () => {
          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getByText('reminders.noDataTitle')).toBeInTheDocument();
               expect(screen.getByText('reminders.noDataMessage')).toBeInTheDocument();
          });
     });

     it('should show "new" button in empty state', async () => {
          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: /reminders\.new/i })).toBeInTheDocument();
          });
     });

     // --- Loading reminders ---
     it('should fetch reminders on mount', async () => {
          mockFetchRemindersForClient.mockResolvedValue(allReminders);

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(mockFetchRemindersForClient).toHaveBeenCalledWith('client-1', {});
          });
     });

     it('should display reminder names in the list', async () => {
          mockFetchRemindersForClient.mockResolvedValue(mockOneTimeReminders);

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getAllByText(/Contract Review/).length).toBeGreaterThan(0);
               expect(screen.getAllByText(/Payment Due/).length).toBeGreaterThan(0);
          });
     });

     // --- Tabs ---
     it('should render reminder type tabs', async () => {
          mockFetchRemindersForClient.mockResolvedValue(allReminders);

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getByRole('tab', { name: 'reminderType.OneTimeEvent' })).toBeInTheDocument();
               expect(screen.getByRole('tab', { name: 'reminderType.Regular' })).toBeInTheDocument();
          });
     });

     it('should switch to regular reminders when tab is clicked', async () => {
          const user = userEvent.setup();
          mockFetchRemindersForClient.mockResolvedValue(allReminders);

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getAllByText(/Contract Review/).length).toBeGreaterThan(0);
          });

          await user.click(screen.getByRole('tab', { name: 'reminderType.Regular' }));

          await waitFor(() => {
               expect(screen.getAllByText(/Weekly Delivery/).length).toBeGreaterThan(0);
          });
     });

     // --- Detail view (right side) ---
     it('should show selected reminder details', async () => {
          mockFetchRemindersForClient.mockResolvedValue(mockOneTimeReminders);

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               // First reminder should be selected by default
               expect(screen.getByText('Review client contract terms')).toBeInTheDocument();
          });
     });

     it('should show a different reminder when clicked', async () => {
          const user = userEvent.setup();
          mockFetchRemindersForClient.mockResolvedValue(mockOneTimeReminders);

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getAllByText(/Contract Review/).length).toBeGreaterThan(0);
          });

          const paymentItems = screen.getAllByText(/Payment Due/);
          await user.click(paymentItems[0]);

          await waitFor(() => {
               expect(screen.getByText('Outstanding invoice payment')).toBeInTheDocument();
          });
     });

     // --- Resolve / unresolve ---
     it('should call resolve API when check icon is clicked', async () => {
          const user = userEvent.setup();
          mockFetchRemindersForClient.mockResolvedValue(mockOneTimeReminders);
          mockSetClientReminderResolvedDateEndpoint.mockResolvedValue({});

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getAllByText(/Contract Review/).length).toBeGreaterThan(0);
          });

          const checkIcons = screen.getAllByTestId('CheckCircleTwoToneIcon');
          expect(checkIcons.length).toBeGreaterThan(0);

          const iconButton = checkIcons[0].closest('button')!;
          await user.click(iconButton);

          await waitFor(() => {
               expect(mockSetClientReminderResolvedDateEndpoint).toHaveBeenCalledWith('reminder-1', expect.any(Object));
          });
     });

     // --- Delete ---
     it('should delete a reminder when delete icon is clicked', async () => {
          const user = userEvent.setup();
          mockFetchRemindersForClient.mockResolvedValue(mockOneTimeReminders);
          mockDeleteClientReminderEndpoint.mockResolvedValue({});

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getByText('Review client contract terms')).toBeInTheDocument();
          });

          const deleteButton = document.querySelector('.MuiIconButton-colorError') as HTMLElement;
          expect(deleteButton).toBeTruthy();
          await user.click(deleteButton);

          await waitFor(() => {
               expect(mockDeleteClientReminderEndpoint).toHaveBeenCalledWith('reminder-1');
               expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.deleteSuccess', 'success');
          });
     });

     // --- Create drawer ---
     it('should open create drawer when "new" button is clicked', async () => {
          const user = userEvent.setup();
          mockFetchRemindersForClient.mockResolvedValue(mockOneTimeReminders);

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getAllByText(/Contract Review/).length).toBeGreaterThan(0);
          });

          const newButtons = screen.getAllByRole('button', { name: /reminders\.new/i });
          await user.click(newButtons[0]);

          await waitFor(() => {
               expect(screen.getByTestId('create-reminder-view')).toBeInTheDocument();
          });
     });

     // --- Edit drawer ---
     it('should open edit drawer when edit icon is clicked', async () => {
          const user = userEvent.setup();
          mockFetchRemindersForClient.mockResolvedValue(mockOneTimeReminders);

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getByText('Review client contract terms')).toBeInTheDocument();
          });

          // The edit icon is a default-colored (not error) IconButton in the detail panel
          const allIconButtons = document.querySelectorAll('.MuiIconButton-root:not(.MuiIconButton-colorError)');
          const editButton = Array.from(allIconButtons).find(
               (btn) => !btn.querySelector('[data-testid="CheckCircleTwoToneIcon"]')
          ) as HTMLElement;

          expect(editButton).toBeTruthy();
          await user.click(editButton);

          await waitFor(() => {
               expect(screen.getByTestId('update-reminder-view')).toBeInTheDocument();
          });
     });

     // --- Fetch error ---
     it('should show error snackbar when fetch fails', async () => {
          mockFetchRemindersForClient.mockRejectedValue(new Error('Network error'));

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.fetchError', 'error');
          });
     });

     // --- Delete error ---
     it('should show error snackbar when delete fails', async () => {
          const user = userEvent.setup();
          mockFetchRemindersForClient.mockResolvedValue(mockOneTimeReminders);
          mockDeleteClientReminderEndpoint.mockRejectedValue(new Error('Delete failed'));

          render(<ClientRemindersView clientId="client-1" />);

          await waitFor(() => {
               expect(screen.getByText('Review client contract terms')).toBeInTheDocument();
          });

          const deleteButton = document.querySelector('.MuiIconButton-colorError') as HTMLElement;
          await user.click(deleteButton);

          await waitFor(() => {
               expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.saveError', 'error');
          });
     });
});
