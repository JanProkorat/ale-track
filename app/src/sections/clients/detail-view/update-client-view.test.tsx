import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { UpdateClientView } from './update-client-view';
import { Region, Country, ClientDto, AddressDto } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference to prevent useCallback dependency changes
const mockT = (key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

// Mock react-i18next (partial)
vi.mock('react-i18next', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useTranslation: () => ({ t: mockT }),
    };
});

// Mock react-router-dom (DetailCardLayout uses useBlocker)
vi.mock('react-router-dom', () => ({
    useBlocker: () => ({ state: 'idle' }),
}));

// Mock useApiCall
const mockExecuteApiCall = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
    }),
}));

// Mock AuthorizedClient
const mockGetClientDetailEndpoint = vi.fn();
const mockUpdateClientEndpoint = vi.fn();
const mockDeleteClientEndpoint = vi.fn();
const mockFetchRemindersForClient = vi.fn().mockResolvedValue([]);
const mockSetClientReminderResolvedDateEndpoint = vi.fn();
const mockDeleteClientReminderEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        getClientDetailEndpoint = mockGetClientDetailEndpoint;
        updateClientEndpoint = mockUpdateClientEndpoint;
        deleteClientEndpoint = mockDeleteClientEndpoint;
        fetchRemindersForClient = mockFetchRemindersForClient;
        setClientReminderResolvedDateEndpoint = mockSetClientReminderResolvedDateEndpoint;
        deleteClientReminderEndpoint = mockDeleteClientReminderEndpoint;
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
const mockTriggerRefresh = vi.fn();
vi.mock('../../../providers/EntityStatsContext', () => ({
    useEntityStatsRefresh: () => ({
        triggerRefresh: mockTriggerRefresh,
    }),
}));

// Mock GeoLocationProvider
vi.mock('../../../providers/geo-location-provider', () => ({
    GeoLocationProvider: class MockGeoLocationProvider {
        geocode = vi.fn().mockResolvedValue(null);
    },
}));

// Mock minimal-shared/utils (partial)
vi.mock('minimal-shared/utils', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        varAlpha: () => 'rgba(0,0,0,0.16)',
    };
});

// Mock heavy child components to keep tests focused
vi.mock('./components/client-reminders-view', () => ({
    ClientRemindersView: ({ clientId }: { clientId: string }) => (
        <div data-testid="client-reminders-view">{`Reminders for ${clientId}`}</div>
    ),
}));

vi.mock('../../notes/view/notes-view', () => ({
    NotesView: ({ parentId }: { parentId: string }) => (
        <div data-testid="notes-view">{`Notes for ${parentId}`}</div>
    ),
}));

// --- Test data ---
const mockClientData = new ClientDto({
    id: 'client-1',
    name: 'Restaurant Alfa',
    businessName: 'Alfa s.r.o.',
    region: Region.ZittauCity,
    officialAddress: new AddressDto({
        streetName: 'Hlavní',
        streetNumber: '42',
        city: 'Praha',
        zip: '11000',
        country: Country.Czechia,
    }),
    contactAddress: undefined,
    contacts: [],
});

// --- Default props ---
const defaultProps = {
    id: 'client-1',
    shouldCheckPendingChanges: false,
    onDelete: vi.fn(),
    onConfirmed: vi.fn(),
    onHasChangesChange: vi.fn(),
};

describe('UpdateClientView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: executeApiCall calls the API function and returns its result
        mockExecuteApiCall.mockImplementation((apiCall: () => Promise<unknown>) => apiCall());
        mockGetClientDetailEndpoint.mockResolvedValue(mockClientData);
    });

    // --- Rendering ---
    it('should fetch and display client details on mount', async () => {
        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            expect(mockGetClientDetailEndpoint).toHaveBeenCalledWith('client-1');
        });

        await waitFor(() => {
            expect(screen.getByDisplayValue('Restaurant Alfa')).toBeInTheDocument();
        });
    });

    it('should render client name and business name inputs with loaded data', async () => {
        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            const nameInput = screen.getByLabelText('clients.name');
            expect(nameInput).toHaveValue('Restaurant Alfa');
        });

        const businessInput = screen.getByLabelText('clients.businessName');
        expect(businessInput).toHaveValue('Alfa s.r.o.');
    });

    it('should render ClientRemindersView and NotesView when loaded', async () => {
        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('client-reminders-view')).toBeInTheDocument();
            expect(screen.getByTestId('notes-view')).toBeInTheDocument();
        });
    });

    // --- Editing ---
    it('should update client name when typing', async () => {
        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Restaurant Alfa')).toBeInTheDocument();
        });

        const nameInput = screen.getByLabelText('clients.name');
        fireEvent.change(nameInput, { target: { value: 'New Client Name' } });

        await waitFor(() => {
            expect(nameInput).toHaveValue('New Client Name');
        });
    });

    it('should notify parent about unsaved changes', async () => {
        const onHasChangesChange = vi.fn();
        render(<UpdateClientView {...defaultProps} onHasChangesChange={onHasChangesChange} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Restaurant Alfa')).toBeInTheDocument();
        });

        // Clear existing calls from initial load
        onHasChangesChange.mockClear();

        const nameInput = screen.getByLabelText('clients.name');
        fireEvent.change(nameInput, { target: { value: 'Changed' } });

        await waitFor(() => {
            expect(onHasChangesChange).toHaveBeenCalledWith(true);
        });
    });

    // --- Saving ---
    it('should call update API when save button is clicked', async () => {
        const user = userEvent.setup();
        mockUpdateClientEndpoint.mockResolvedValue({});

        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Restaurant Alfa')).toBeInTheDocument();
        });

        // Change the name
        fireEvent.change(screen.getByLabelText('clients.name'), { target: { value: 'Updated Client' } });

        // Wait for save/reset buttons to become enabled
        await waitFor(() => {
            const enabledPrimaryBtns = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
            expect(enabledPrimaryBtns.length).toBeGreaterThanOrEqual(2);
        });

        // Click the save button (second enabled primary icon button)
        const enabledPrimaryBtns = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
        await user.click(enabledPrimaryBtns[1] as HTMLElement);

        await waitFor(() => {
            expect(mockUpdateClientEndpoint).toHaveBeenCalledWith('client-1', expect.any(Object));
        });
    });

    it('should show validation error when saving with empty name', async () => {
        const user = userEvent.setup();
        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Restaurant Alfa')).toBeInTheDocument();
        });

        // Clear the name
        fireEvent.change(screen.getByLabelText('clients.name'), { target: { value: '' } });

        // Wait for buttons to become enabled
        await waitFor(() => {
            const primaryBtns = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
            expect(primaryBtns.length).toBeGreaterThanOrEqual(2);
        });

        const enabledPrimaryBtns = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
        await user.click(enabledPrimaryBtns[1] as HTMLElement); // save = second button

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });

        expect(mockUpdateClientEndpoint).not.toHaveBeenCalled();
    });

    // --- Deleting ---
    it('should show delete confirmation dialog when delete button is clicked', async () => {
        const user = userEvent.setup();
        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Restaurant Alfa')).toBeInTheDocument();
        });

        const deleteButton = document.querySelector('.MuiIconButton-colorError') as HTMLElement;
        expect(deleteButton).toBeTruthy();
        await user.click(deleteButton);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('should call delete API after confirming deletion', async () => {
        const user = userEvent.setup();
        mockDeleteClientEndpoint.mockResolvedValue({});

        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Restaurant Alfa')).toBeInTheDocument();
        });

        // Click delete icon
        const deleteButton = document.querySelector('.MuiIconButton-colorError') as HTMLElement;
        await user.click(deleteButton);

        // Wait for dialog
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Click the confirm delete button in the dialog
        const confirmButton = screen.getByRole('button', { name: 'common.delete' });
        await user.click(confirmButton);

        await waitFor(() => {
            expect(mockDeleteClientEndpoint).toHaveBeenCalledWith('client-1');
        });
    });

    // --- Reset ---
    it('should show reset confirmation dialog when reset button is clicked', async () => {
        const user = userEvent.setup();
        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Restaurant Alfa')).toBeInTheDocument();
        });

        // Change the name to enable reset
        fireEvent.change(screen.getByLabelText('clients.name'), { target: { value: 'Changed' } });

        // Wait for reset button to become enabled (first primary IconButton)
        await waitFor(() => {
            const primaryButtons = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
            expect(primaryButtons.length).toBeGreaterThanOrEqual(1);
        });

        const primaryButtons = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
        await user.click(primaryButtons[0] as HTMLElement);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('common.reset')).toBeInTheDocument();
        });
    });

    // --- Fetch failure ---
    it('should handle fetch failure gracefully', async () => {
        mockExecuteApiCall.mockResolvedValue(null);

        render(<UpdateClientView {...defaultProps} />);

        await waitFor(() => {
            // Should show error message, not crash
            expect(screen.getByText('clients.loadDetailError')).toBeInTheDocument();
        });
    });
});
