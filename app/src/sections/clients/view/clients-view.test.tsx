import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { ClientsView } from './clients-view';

import type { ClientListItemDto } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference to prevent useCallback dependency changes
const mockT = (key: string) => key;

// Mock react-router-dom
const mockNavigate = vi.fn();
let mockClientId: string | undefined;

vi.mock('react-router-dom', () => ({
    useParams: () => ({ clientId: mockClientId }),
    useNavigate: () => mockNavigate,
    useBlocker: () => ({ state: 'idle' }),
}));

// Mock react-i18next (partial to preserve initReactI18next)
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
const mockFetchClients = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        fetchClients = mockFetchClients;
        getClientDetailEndpoint = vi.fn();
        fetchRemindersForClient = vi.fn().mockResolvedValue([]);
        deleteClientEndpoint = vi.fn();
        updateClientEndpoint = vi.fn();
        createClientEndpoint = vi.fn();
        setClientReminderResolvedDateEndpoint = vi.fn();
        deleteClientReminderEndpoint = vi.fn();
    },
}));

// Mock SnackbarProvider
vi.mock('../../../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({
        showSnackbar: vi.fn(),
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

// Mock DashboardContent
vi.mock('../../../layouts/dashboard', () => ({
    DashboardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock UpdateClientView (heavy child – tested separately)
vi.mock('../detail-view/update-client-view', () => ({
    UpdateClientView: (props: Record<string, unknown>) => (
        <div data-testid="update-client-view">{`Detail for ${props.id}`}</div>
    ),
}));

// Mock CreateClientView (heavy child – tested separately)
vi.mock('../detail-view', () => ({
    CreateClientView: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="create-client-view">
            <span>clients.detailTitle</span>
            <button type="button" onClick={onClose}>close</button>
        </div>
    ),
}));

// Mock GeoLocationProvider
vi.mock('../../../providers/geo-location-provider', () => ({
    GeoLocationProvider: class MockGeoLocationProvider {
        geocode = vi.fn().mockResolvedValue(null);
    },
}));

// --- Test data ---
const mockClientList: ClientListItemDto[] = [
    { id: 'client-1', name: 'Restaurant Alfa', region: 0 } as ClientListItemDto,
    { id: 'client-2', name: 'Pub Beta', region: 0 } as ClientListItemDto,
];

describe('ClientsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClientId = undefined;
        // Default: executeApiCallWithDefault calls the API fn and returns its result
        mockExecuteApiCallWithDefault.mockImplementation(
            (apiCall: () => Promise<unknown>, defaultValue: unknown) =>
                apiCall().catch(() => defaultValue)
        );
        mockFetchClients.mockResolvedValue(mockClientList);
    });

    // --- Loading state ---
    it('should show loading indicator initially', () => {
        // Never resolve → stays in loading state
        mockFetchClients.mockReturnValue(new Promise(() => { }));

        render(<ClientsView />);

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // --- Title and new button ---
    it('should render the title and "new" button', async () => {
        render(<ClientsView />);

        await waitFor(() => {
            expect(screen.getByText('clients.title')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /clients\.new/i })).toBeInTheDocument();
        });
    });

    // --- Region tabs ---
    it('should render region tabs when loaded', async () => {
        render(<ClientsView />);

        await waitFor(() => {
            // Region enum keys rendered as tabs with translation keys
            expect(screen.getByRole('tab', { name: 'region.ZittauCity' })).toBeInTheDocument();
        });
    });

    // --- Client list ---
    it('should display clients in the table', async () => {
        render(<ClientsView />);

        await waitFor(() => {
            expect(screen.getByText('Restaurant Alfa')).toBeInTheDocument();
            expect(screen.getByText('Pub Beta')).toBeInTheDocument();
        });
    });

    // --- Auto-select first client ---
    it('should navigate to the first client when no clientId in URL', async () => {
        render(<ClientsView />);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/clients/client-1', { replace: true });
        });
    });

    // --- Select client from URL param ---
    it('should display UpdateClientView when a client is selected', async () => {
        mockClientId = 'client-1';
        render(<ClientsView />);

        await waitFor(() => {
            expect(screen.getByTestId('update-client-view')).toBeInTheDocument();
            expect(screen.getByText('Detail for client-1')).toBeInTheDocument();
        });
    });

    // --- Empty list ---
    it('should show "no detail" message when no clients exist', async () => {
        mockFetchClients.mockResolvedValue([]);

        render(<ClientsView />);

        await waitFor(() => {
            expect(screen.getByText('clients.noDetailToDisplay')).toBeInTheDocument();
        });
    });

    // --- Open create drawer ---
    it('should open the create client drawer when "new" button is clicked', async () => {
        const user = userEvent.setup();
        render(<ClientsView />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /clients\.new/i })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /clients\.new/i }));

        await waitFor(() => {
            expect(screen.getByTestId('create-client-view')).toBeInTheDocument();
            expect(screen.getByText('clients.detailTitle')).toBeInTheDocument();
        });
    });

    // --- Row click ---
    it('should navigate when a client row is clicked', async () => {
        const user = userEvent.setup();
        mockClientId = 'client-1';
        render(<ClientsView />);

        await waitFor(() => {
            expect(screen.getByText('Pub Beta')).toBeInTheDocument();
        });

        // Click on the second client's name cell
        await user.click(screen.getByText('Pub Beta'));

        expect(mockNavigate).toHaveBeenCalledWith('/clients/client-2');
    });
});
