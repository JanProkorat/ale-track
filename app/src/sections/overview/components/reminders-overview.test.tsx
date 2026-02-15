import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { RemindersOverview } from './reminders-overview';

import type { ReminderSectionDto } from '../../../api/Client';

// Theme with CSS variables
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable mockT to prevent re-render loops
const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

// Mock AuthorizedClient
const mockFetchRemindersOverview = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        fetchRemindersOverview = mockFetchRemindersOverview;
    },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({
        showSnackbar: mockShowSnackbar,
    }),
}));

// Mock useRouter
const mockPush = vi.fn();
vi.mock('../../../routes/hooks', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

// Mock formatDate
vi.mock('../../../locales/formatDate', () => ({
    formatDate: (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
}));

// Mock minimal-shared/utils
vi.mock('minimal-shared/utils', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        varAlpha: () => 'rgba(0,0,0,0.16)',
    };
});

// Mock mapEnumValue to return the string key directly
vi.mock('../../../utils/format-enum-value', () => ({
    mapEnumValue: (_enumObj: any, value: any) => value,
}));

// Mock Scrollbar
vi.mock('../../../components/scrollbar', () => ({
    Scrollbar: ({ children }: { children: React.ReactNode }) => <div data-testid="scrollbar">{children}</div>,
}));

// Mock SectionHeader
vi.mock('../../../components/label/section-header', () => ({
    SectionHeader: ({ text, children }: { text: string; children?: React.ReactNode }) => (
        <div data-testid="section-header">
            <span>{text}</span>
            {children}
        </div>
    ),
}));

// --- Test data ---
const mockReminders: ReminderSectionDto[] = [
    {
        sectionId: 'brewery-1',
        sectionName: 'Prague Brewery',
        sectionType: 0, // Brewery
        reminders: [
            {
                id: 'r1',
                name: 'Annual Inspection',
                description: 'Yearly brewery inspection details',
                occurrenceDate: new Date(2026, 5, 15),
            },
            {
                id: 'r2',
                name: 'Equipment Check',
                description: 'Check brewing equipment',
                occurrenceDate: new Date(2026, 7, 1),
            },
        ],
    } as ReminderSectionDto,
    {
        sectionId: 'client-1',
        sectionName: 'Big Restaurant',
        sectionType: 1, // Client
        reminders: [
            {
                id: 'r3',
                name: 'Contract Renewal',
                description: 'Renew supply contract',
                occurrenceDate: new Date(2026, 8, 20),
            },
        ],
    } as ReminderSectionDto,
];

describe('RemindersOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchRemindersOverview.mockResolvedValue([]);
    });

    // --- Loading state ---
    it('should show the section header', () => {
        render(<RemindersOverview />);

        expect(screen.getByText('reminders.title')).toBeInTheDocument();
    });

    // --- Empty state ---
    it('should show empty state when no reminders exist', async () => {
        mockFetchRemindersOverview.mockResolvedValue([]);

        render(<RemindersOverview />);

        await waitFor(() => {
            expect(screen.getByText('reminders.noUpcomingReminders')).toBeInTheDocument();
        });
    });

    // --- Populated state ---
    it('should display reminder sections after loading', async () => {
        mockFetchRemindersOverview.mockResolvedValue(mockReminders);

        render(<RemindersOverview />);

        await waitFor(() => {
            expect(screen.getByText('Prague Brewery')).toBeInTheDocument();
        });
        expect(screen.getByText('Big Restaurant')).toBeInTheDocument();
    });

    it('should display reminder dates and names', async () => {
        mockFetchRemindersOverview.mockResolvedValue(mockReminders);

        render(<RemindersOverview />);

        await waitFor(() => {
            expect(screen.getByText('2026-06-15')).toBeInTheDocument();
        });
        expect(screen.getByText('Annual Inspection')).toBeInTheDocument();
        expect(screen.getByText('Equipment Check')).toBeInTheDocument();
        expect(screen.getByText('Contract Renewal')).toBeInTheDocument();
    });

    it('should call fetchRemindersOverview on mount', async () => {
        mockFetchRemindersOverview.mockResolvedValue([]);

        render(<RemindersOverview />);

        await waitFor(() => {
            expect(mockFetchRemindersOverview).toHaveBeenCalledTimes(1);
        });
    });

    // --- Error handling ---
    it('should show snackbar on fetch error', async () => {
        mockFetchRemindersOverview.mockRejectedValue(new Error('Network error'));

        render(<RemindersOverview />);

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.fetchError', 'error');
        });
    });

    // --- Popover ---
    it('should show popover with reminder details when a reminder is clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersOverview.mockResolvedValue(mockReminders);

        render(<RemindersOverview />);

        await waitFor(() => {
            expect(screen.getByText('Annual Inspection')).toBeInTheDocument();
        });

        // Click the reminder list item
        await user.click(screen.getByText('Annual Inspection'));

        await waitFor(() => {
            expect(screen.getByText('Yearly brewery inspection details')).toBeInTheDocument();
        });
    });

    // --- Navigation ---
    it('should navigate to brewery detail when brewery open icon is clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersOverview.mockResolvedValue([mockReminders[0]]);

        render(<RemindersOverview />);

        await waitFor(() => {
            expect(screen.getByText('Prague Brewery')).toBeInTheDocument();
        });

        // The SectionHeader mock renders children directly — find the button
        const openButtons = screen.getAllByTestId('OpenInNewIcon');
        await user.click(openButtons[0]);

        expect(mockPush).toHaveBeenCalledWith('/breweries/brewery-1');
    });

    it('should navigate to client detail when client open icon is clicked', async () => {
        const user = userEvent.setup();
        mockFetchRemindersOverview.mockResolvedValue([mockReminders[1]]);

        render(<RemindersOverview />);

        await waitFor(() => {
            expect(screen.getByText('Big Restaurant')).toBeInTheDocument();
        });

        const openButtons = screen.getAllByTestId('OpenInNewIcon');
        await user.click(openButtons[0]);

        expect(mockPush).toHaveBeenCalledWith('/clients/client-1');
    });
});
