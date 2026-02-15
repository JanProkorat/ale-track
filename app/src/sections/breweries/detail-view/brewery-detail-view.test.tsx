import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { BreweryDetailView } from './brewery-detail-view';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

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
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
    }),
}));

// Mock AuthorizedClient
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        createBreweryEndpoint = vi.fn();
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

// Mock minimal-shared/utils (partial)
vi.mock('minimal-shared/utils', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        varAlpha: () => 'rgba(0,0,0,0.16)',
    };
});

// Mock GeoLocationProvider to prevent real network requests during tests
vi.mock('../../../providers/geo-location-provider', () => ({
    GeoLocationProvider: class MockGeoLocationProvider {
        geocode = vi.fn().mockResolvedValue(null);
    },
}));

describe('BreweryDetailView', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCall.mockReset();
    });

    // --- Rendering ---
    it('should render the create brewery form', () => {
        render(<BreweryDetailView onClose={mockOnClose} />);

        expect(screen.getByText('breweries.detailTitle')).toBeInTheDocument();
        expect(screen.getByLabelText('breweries.name')).toBeInTheDocument();
    });

    it('should render address form sections', () => {
        render(<BreweryDetailView onClose={mockOnClose} />);

        expect(screen.getByText('address.officialAddress')).toBeInTheDocument();
        expect(screen.getByText('address.contactAddress')).toBeInTheDocument();
    });

    // --- Name field ---
    it('should update the brewery name field', async () => {
        const user = userEvent.setup();
        render(<BreweryDetailView onClose={mockOnClose} />);

        const nameInput = screen.getByLabelText('breweries.name');
        await user.type(nameInput, 'Test Brewery');

        expect(nameInput).toHaveValue('Test Brewery');
    });

    // --- Validation ---
    it('should show validation error when saving without a name', async () => {
        const user = userEvent.setup();
        render(<BreweryDetailView onClose={mockOnClose} />);

        // Find and click the save button
        const saveButton = screen.getByRole('button', { name: /common\.saveAndClose/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });

        // API should not be called
        expect(mockExecuteApiCall).not.toHaveBeenCalled();
    });

    // --- Successful save ---
    it('should call API and close on successful save', async () => {
        const user = userEvent.setup();
        mockExecuteApiCall.mockResolvedValue({ id: 'new-brewery-id' });

        render(<BreweryDetailView onClose={mockOnClose} />);

        // Fill in the name
        const nameInput = screen.getByLabelText('breweries.name');
        await user.type(nameInput, 'New Brewery');

        // Fill in address fields (official address is required)
        const streetInputs = screen.getAllByLabelText('address.street');
        const numberInputs = screen.getAllByLabelText('address.number');
        const cityInputs = screen.getAllByLabelText('address.city');
        const zipInputs = screen.getAllByLabelText('address.zip');

        await user.type(streetInputs[0], 'Main Street');
        await user.type(numberInputs[0], '123');
        await user.type(cityInputs[0], 'Prague');
        await user.type(zipInputs[0], '11000');

        // Click save
        const saveButton = screen.getByRole('button', { name: /common\.saveAndClose/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockExecuteApiCall).toHaveBeenCalledOnce();
            expect(mockTriggerRefresh).toHaveBeenCalled();
            expect(mockShowSnackbar).toHaveBeenCalledWith('breweries.saveSuccess', 'success');
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    // --- Failed save ---
    it('should not close when save fails', async () => {
        const user = userEvent.setup();
        mockExecuteApiCall.mockResolvedValue(null);

        render(<BreweryDetailView onClose={mockOnClose} />);

        // Fill in the name and required address
        const nameInput = screen.getByLabelText('breweries.name');
        await user.type(nameInput, 'New Brewery');

        const streetInputs = screen.getAllByLabelText('address.street');
        const numberInputs = screen.getAllByLabelText('address.number');
        const cityInputs = screen.getAllByLabelText('address.city');
        const zipInputs = screen.getAllByLabelText('address.zip');

        await user.type(streetInputs[0], 'Main Street');
        await user.type(numberInputs[0], '123');
        await user.type(cityInputs[0], 'Prague');
        await user.type(zipInputs[0], '11000');

        const saveButton = screen.getByRole('button', { name: /common\.saveAndClose/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockExecuteApiCall).toHaveBeenCalledOnce();
        });

        // Should NOT close or trigger refresh
        expect(mockTriggerRefresh).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
    });
});
