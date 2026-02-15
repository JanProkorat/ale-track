import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { BreweriesView } from './breweries-view';

import type { BreweryListItemDto } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Mock react-router-dom
const mockNavigate = vi.fn();
let mockBreweryId: string | undefined;

vi.mock('react-router-dom', () => ({
    useParams: () => ({ breweryId: mockBreweryId }),
    useNavigate: () => mockNavigate,
    useBlocker: () => ({ state: 'idle' }),
}));

// Mock react-i18next (partial to preserve initReactI18next used by i18n.ts)
vi.mock('react-i18next', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
        }),
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
const mockFetchBreweries = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        fetchBreweries = mockFetchBreweries;
        getBreweryDetailEndpoint = vi.fn();
        fetchRemindersForBrewery = vi.fn().mockResolvedValue([]);
        fetchProductsForBrewery = vi.fn().mockResolvedValue([]);
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

// Mock DashboardContent to simplify rendering
vi.mock('../../../layouts/dashboard', () => ({
    DashboardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock BreweryDetailCard to avoid deep dependency chain (CurrencyProvider, ProductsView, etc.)
vi.mock('../detail-view/brewery-detail-card', () => ({
    BreweryDetailCard: (props: Record<string, unknown>) => (
        <div data-testid="brewery-detail-card">{`Detail card for ${props.id}`}</div>
    ),
}));

// Mock BreweryDetailView (the create drawer)
vi.mock('../detail-view', () => ({
    BreweryDetailView: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="brewery-detail-view">
            <span>breweries.detailTitle</span>
            <button type="button" onClick={onClose}>close</button>
        </div>
    ),
}));

// --- Test data ---
const mockBreweryList: BreweryListItemDto[] = [
    { id: 'brewery-1', name: 'Pilsner Urquell', displayOrder: 1, color: '#FFD700' } as BreweryListItemDto,
    { id: 'brewery-2', name: 'Budweiser Budvar', displayOrder: 2, color: '#CC0000' } as BreweryListItemDto,
];

describe('BreweriesView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBreweryId = undefined;
    });

    // --- Loading state ---
    it('should show loading indicator initially', () => {
        // API call never resolves — stays in loading state
        mockExecuteApiCallWithDefault.mockReturnValue(new Promise(() => { }));

        render(<BreweriesView />);

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // --- Empty state ---
    it('should show empty state when no breweries exist', async () => {
        mockExecuteApiCallWithDefault.mockResolvedValue([]);

        render(<BreweriesView />);

        await waitFor(() => {
            expect(screen.getByText('no items placeholder')).toBeInTheDocument();
        });
    });

    // --- Title and new button ---
    it('should render the title and "new" button', async () => {
        mockExecuteApiCallWithDefault.mockResolvedValue(mockBreweryList);

        render(<BreweriesView />);

        await waitFor(() => {
            expect(screen.getByText('breweries.title')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /breweries\.new/i })).toBeInTheDocument();
        });
    });

    // --- Brewery tabs ---
    it('should render brewery tabs when breweries are loaded', async () => {
        mockExecuteApiCallWithDefault.mockResolvedValue(mockBreweryList);

        render(<BreweriesView />);

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: 'Pilsner Urquell' })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: 'Budweiser Budvar' })).toBeInTheDocument();
        });
    });

    // --- Auto-select first brewery ---
    it('should navigate to the first brewery when no breweryId in URL', async () => {
        mockExecuteApiCallWithDefault.mockResolvedValue(mockBreweryList);

        render(<BreweriesView />);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/breweries/brewery-1', { replace: true });
        });
    });

    // --- Select brewery from URL param ---
    it('should select brewery from URL param', async () => {
        mockBreweryId = 'brewery-2';
        mockExecuteApiCallWithDefault.mockResolvedValue(mockBreweryList);

        render(<BreweriesView />);

        await waitFor(() => {
            const tab = screen.getByRole('tab', { name: 'Budweiser Budvar' });
            expect(tab).toHaveAttribute('aria-selected', 'true');
        });
    });

    // --- Navigate to first brewery when URL param is invalid ---
    it('should fallback to the first brewery when breweryId does not exist', async () => {
        mockBreweryId = 'nonexistent-id';
        mockExecuteApiCallWithDefault.mockResolvedValue(mockBreweryList);

        render(<BreweriesView />);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/breweries/brewery-1', { replace: true });
        });
    });

    // --- Open create brewery drawer ---
    it('should open the create brewery drawer when "new" button is clicked', async () => {
        const user = userEvent.setup();
        mockExecuteApiCallWithDefault.mockResolvedValue(mockBreweryList);

        render(<BreweriesView />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /breweries\.new/i })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /breweries\.new/i }));

        await waitFor(() => {
            // The drawer should open and show the BreweryDetailView with its title
            expect(screen.getByText('breweries.detailTitle')).toBeInTheDocument();
        });
    });

    // --- Tab change ---
    it('should navigate when a different tab is clicked', async () => {
        const user = userEvent.setup();
        mockBreweryId = 'brewery-1';
        mockExecuteApiCallWithDefault.mockResolvedValue(mockBreweryList);

        render(<BreweriesView />);

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: 'Budweiser Budvar' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('tab', { name: 'Budweiser Budvar' }));

        expect(mockNavigate).toHaveBeenCalledWith('/breweries/brewery-2');
    });
});
