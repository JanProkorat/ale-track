import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { BreweryRemindersView } from './brewery-reminders-view';

import type { ReminderType, ReminderListItemDto } from '../../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Mock react-i18next (partial to preserve initReactI18next used by i18n.ts)
// Use a stable `t` reference to prevent useCallback dependencies from changing on each render
const mockT = (key: string) => key;
vi.mock('react-i18next', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useTranslation: () => ({
            t: mockT,
        }),
    };
});

// Mock AuthorizedClient
const mockFetchRemindersForBrewery = vi.fn();
const mockSetBreweryReminderResolvedDateEndpoint = vi.fn();
const mockDeleteBreweryReminderEndpoint = vi.fn();
vi.mock('../../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        fetchRemindersForBrewery = mockFetchRemindersForBrewery;
        setBreweryReminderResolvedDateEndpoint = mockSetBreweryReminderResolvedDateEndpoint;
        deleteBreweryReminderEndpoint = mockDeleteBreweryReminderEndpoint;
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
            <button type="button" onClick={() => onClose(true)}>save-reminder</button>
            <button type="button" onClick={() => onClose(false)}>cancel-reminder</button>
        </div>
    ),
}));

vi.mock('../../../reminders/detail-view/update-reminder-view', () => ({
    UpdateReminderView: ({ onClose }: { onClose: (shouldRefresh: boolean) => void }) => (
        <div data-testid="update-reminder-view">
            <button type="button" onClick={() => onClose(true)}>save-update</button>
        </div>
    ),
}));

// --- Test data ---
// The API returns type as a string key (e.g. "OneTimeEvent"), and the component
// remaps it via ReminderType[r.type!] to the numeric enum value.
const mockOneTimeReminders = [
    {
        id: 'reminder-1',
        name: 'Annual Inspection',
        description: 'Yearly brewery inspection',
        occurrenceDate: new Date('2026-06-15'),
        isResolved: false,
        type: 'OneTimeEvent' as unknown as ReminderType,
    },
    {
        id: 'reminder-2',
        name: 'License Renewal',
        description: 'Renew brewing license',
        occurrenceDate: new Date('2026-09-01'),
        isResolved: true,
        type: 'OneTimeEvent' as unknown as ReminderType,
    },
] as ReminderListItemDto[];

const mockRegularReminders = [
    {
        id: 'reminder-3',
        name: 'Weekly Cleaning',
        description: 'Deep clean all vats',
        isResolved: false,
        type: 'Regular' as unknown as ReminderType,
        recurrenceType: 0, // Weekly
        daysOfWeek: [1, 5], // Monday, Friday
    },
] as ReminderListItemDto[];

const allReminders = [...mockOneTimeReminders, ...mockRegularReminders];

describe('BreweryRemindersView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchRemindersForBrewery.mockResolvedValue([]);
    });

    // --- Empty state ---
    it('should show empty state when no reminders exist', async () => {
        mockFetchRemindersForBrewery.mockResolvedValue([]);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getByText('reminders.noDataTitle')).toBeInTheDocument();
            expect(screen.getByText('reminders.noDataMessage')).toBeInTheDocument();
        });
    });

    it('should show "new" button in empty state', async () => {
        mockFetchRemindersForBrewery.mockResolvedValue([]);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /reminders\.new/i })).toBeInTheDocument();
        });
    });

    // --- Loading reminders ---
    it('should fetch reminders on mount', async () => {
        mockFetchRemindersForBrewery.mockResolvedValue(allReminders);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(mockFetchRemindersForBrewery).toHaveBeenCalledWith('brewery-1', {});
        });
    });

    it('should display reminder names in the list', async () => {
        mockFetchRemindersForBrewery.mockResolvedValue(mockOneTimeReminders);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            // Use getAllByText because the name may appear in both the list and the detail panel
            expect(screen.getAllByText(/Annual Inspection/).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/License Renewal/).length).toBeGreaterThan(0);
        });
    });

    // --- Tabs ---
    it('should render reminder type tabs', async () => {
        mockFetchRemindersForBrewery.mockResolvedValue(allReminders);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: 'reminderType.OneTimeEvent' })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: 'reminderType.Regular' })).toBeInTheDocument();
        });
    });

    it('should switch to regular reminders when tab is clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersForBrewery.mockResolvedValue(allReminders);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getAllByText(/Annual Inspection/).length).toBeGreaterThan(0);
        });

        // Click the "Regular" tab
        await user.click(screen.getByRole('tab', { name: 'reminderType.Regular' }));

        await waitFor(() => {
            expect(screen.getAllByText(/Weekly Cleaning/).length).toBeGreaterThan(0);
        });
    });

    // --- Detail view (right side) ---
    it('should show selected reminder details', async () => {
        mockFetchRemindersForBrewery.mockResolvedValue(mockOneTimeReminders);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            // First reminder should be selected by default
            expect(screen.getByText('Yearly brewery inspection')).toBeInTheDocument();
        });
    });

    it('should show a different reminder when clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersForBrewery.mockResolvedValue(mockOneTimeReminders);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getAllByText(/Annual Inspection/).length).toBeGreaterThan(0);
        });

        // Click the second reminder in the list (License Renewal)
        const licenseItems = screen.getAllByText(/License Renewal/);
        await user.click(licenseItems[0]);

        await waitFor(() => {
            expect(screen.getByText('Renew brewing license')).toBeInTheDocument();
        });
    });

    // --- Resolve / unresolve ---
    it('should call resolve API when check icon is clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersForBrewery.mockResolvedValue(mockOneTimeReminders);
        mockSetBreweryReminderResolvedDateEndpoint.mockResolvedValue({});

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getAllByText(/Annual Inspection/).length).toBeGreaterThan(0);
        });

        // Find check circle icons (resolve buttons) - they use CheckCircleTwoToneIcon from MUI
        const checkIcons = screen.getAllByTestId('CheckCircleTwoToneIcon');
        expect(checkIcons.length).toBeGreaterThan(0);

        // Click the IconButton containing the first check icon
        const iconButton = checkIcons[0].closest('button')!;
        await user.click(iconButton);

        await waitFor(() => {
            expect(mockSetBreweryReminderResolvedDateEndpoint).toHaveBeenCalledWith(
                'reminder-1',
                expect.any(Object)
            );
        });
    });

    // --- Delete ---
    it('should delete a reminder when delete icon is clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersForBrewery.mockResolvedValue(mockOneTimeReminders);
        mockDeleteBreweryReminderEndpoint.mockResolvedValue({});

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getByText('Yearly brewery inspection')).toBeInTheDocument();
        });

        // The delete icon is the error-colored IconButton in the detail view
        const deleteButton = document.querySelector('.MuiIconButton-colorError') as HTMLElement;
        expect(deleteButton).toBeTruthy();
        await user.click(deleteButton);

        await waitFor(() => {
            expect(mockDeleteBreweryReminderEndpoint).toHaveBeenCalledWith('reminder-1');
            expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.deleteSuccess', 'success');
        });
    });

    // --- Create drawer ---
    it('should open create drawer when "new" button is clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersForBrewery.mockResolvedValue(mockOneTimeReminders);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getAllByText(/Annual Inspection/).length).toBeGreaterThan(0);
        });

        // There may be multiple "new" buttons (one in header, one in empty state area)
        const newButtons = screen.getAllByRole('button', { name: /reminders\.new/i });
        await user.click(newButtons[0]);

        await waitFor(() => {
            expect(screen.getByTestId('create-reminder-view')).toBeInTheDocument();
        });
    });

    // --- Edit drawer ---
    it('should open edit drawer when edit icon is clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersForBrewery.mockResolvedValue(mockOneTimeReminders);

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getByText('Yearly brewery inspection')).toBeInTheDocument();
        });

        // The edit icon is a default-colored (not error) IconButton in the detail panel
        // It's next to the delete (error) button. Find all non-error icon buttons in the detail view.
        const allIconButtons = document.querySelectorAll('.MuiIconButton-root:not(.MuiIconButton-colorError)');
        // Filter to the ones in the detail panel (not the resolve buttons in the list)
        // The edit button should not have CheckCircleTwoToneIcon
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
        mockFetchRemindersForBrewery.mockRejectedValue(new Error('Network error'));

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.fetchError', 'error');
        });
    });

    // --- Delete error ---
    it('should show error snackbar when delete fails', async () => {
        const user = userEvent.setup();
        mockFetchRemindersForBrewery.mockResolvedValue(mockOneTimeReminders);
        mockDeleteBreweryReminderEndpoint.mockRejectedValue(new Error('Delete failed'));

        render(<BreweryRemindersView breweryId="brewery-1" />);

        await waitFor(() => {
            expect(screen.getByText('Yearly brewery inspection')).toBeInTheDocument();
        });

        // Click the error-colored delete icon button
        const deleteButton = document.querySelector('.MuiIconButton-colorError') as HTMLElement;
        await user.click(deleteButton);

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.saveError', 'error');
        });
    });
});
