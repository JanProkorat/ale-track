import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { BreweryDetailCard } from './brewery-detail-card';
import { Country, AddressDto, BreweryDto } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Mock react-i18next (partial to preserve initReactI18next used by i18n.ts)
// Use a stable `t` reference to prevent useCallback dependencies from changing on each render
const mockT = (key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
vi.mock('react-i18next', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useTranslation: () => ({
            t: mockT,
        }),
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
const mockGetBreweryDetailEndpoint = vi.fn();
const mockUpdateBreweryEndpoint = vi.fn();
const mockDeleteBreweryEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        getBreweryDetailEndpoint = mockGetBreweryDetailEndpoint;
        updateBreweryEndpoint = mockUpdateBreweryEndpoint;
        deleteBreweryEndpoint = mockDeleteBreweryEndpoint;
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

// Mock GeoLocationProvider to prevent real network requests
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
vi.mock('../../products/view', () => ({
    ProductsView: ({ breweryId }: { breweryId: string }) => (
        <div data-testid="products-view">{`Products for ${breweryId}`}</div>
    ),
}));

vi.mock('./components/brewery-reminders-view', () => ({
    BreweryRemindersView: ({ breweryId }: { breweryId: string }) => (
        <div data-testid="reminders-view">{`Reminders for ${breweryId}`}</div>
    ),
}));

// --- Test data ---
// Use real BreweryDto/AddressDto so JSON.stringify comparisons in DetailCardLayout work correctly
const mockBreweryData = new BreweryDto({
    id: 'brewery-1',
    name: 'Pilsner Urquell',
    color: '#FFD700',
    officialAddress: new AddressDto({
        streetName: 'U Prazdroje',
        streetNumber: '7',
        city: 'Plzeň',
        zip: '30100',
        country: Country.Czechia,
    }),
    contactAddress: undefined,
});

// --- Default props ---
const defaultProps = {
    id: 'brewery-1',
    shouldCheckPendingChanges: false,
    onDelete: vi.fn(),
    onConfirmed: vi.fn(),
    onHasChangesChange: vi.fn(),
    onProgressbarVisibilityChange: vi.fn(),
};

describe('BreweryDetailCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: executeApiCall calls the API function and returns its result
        mockExecuteApiCall.mockImplementation((apiCall: () => Promise<unknown>) => apiCall());
        mockGetBreweryDetailEndpoint.mockResolvedValue(mockBreweryData);
    });

    // --- Rendering ---
    it('should show "no detail" message when id is null', () => {
        render(<BreweryDetailCard {...defaultProps} id={null} />);

        expect(screen.getByText('breweries.noDetailToDisplay')).toBeInTheDocument();
    });

    it('should fetch and display brewery details on mount', async () => {
        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(mockGetBreweryDetailEndpoint).toHaveBeenCalledWith('brewery-1');
        });

        await waitFor(() => {
            expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
        });
    });

    it('should render brewery name input with loaded data', async () => {
        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            const nameInput = screen.getByLabelText('breweries.name');
            expect(nameInput).toHaveValue('Pilsner Urquell');
        });
    });

    it('should call onProgressbarVisibilityChange(false) after fetching', async () => {
        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(defaultProps.onProgressbarVisibilityChange).toHaveBeenCalledWith(false);
        });
    });

    it('should render ProductsView and BreweryRemindersView when id is set', async () => {
        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('products-view')).toBeInTheDocument();
            expect(screen.getByTestId('reminders-view')).toBeInTheDocument();
        });
    });

    it('should not render ProductsView or BreweryRemindersView when id is null', () => {
        render(<BreweryDetailCard {...defaultProps} id={null} />);

        expect(screen.queryByTestId('products-view')).not.toBeInTheDocument();
        expect(screen.queryByTestId('reminders-view')).not.toBeInTheDocument();
    });

    // --- Editing ---
    it('should update brewery name when typing', async () => {
        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
        });

        const nameInput = screen.getByLabelText('breweries.name');
        fireEvent.change(nameInput, { target: { value: 'New Brewery Name' } });

        await waitFor(() => {
            expect(nameInput).toHaveValue('New Brewery Name');
        });
    });

    it('should notify parent about unsaved changes', async () => {
        const onHasChangesChange = vi.fn();
        render(<BreweryDetailCard {...defaultProps} onHasChangesChange={onHasChangesChange} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
        });

        // Clear existing calls from initial load
        onHasChangesChange.mockClear();

        const nameInput = screen.getByLabelText('breweries.name');
        fireEvent.change(nameInput, { target: { value: 'Changed' } });

        await waitFor(() => {
            expect(onHasChangesChange).toHaveBeenCalledWith(true);
        });
    });

    // --- Saving ---
    it('should call update API when save button is clicked', async () => {
        const user = userEvent.setup();
        mockUpdateBreweryEndpoint.mockResolvedValue({});

        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
        });

        // Change the name
        fireEvent.change(screen.getByLabelText('breweries.name'), { target: { value: 'Updated Brewery' } });

        // Wait for the save/reset buttons to become enabled
        await waitFor(() => {
            const allBtns = screen.getAllByRole('button');
            const enabledPrimaryBtns = allBtns.filter(
                (btn: HTMLElement) =>
                    btn.classList.contains('MuiIconButton-colorPrimary') &&
                    !btn.hasAttribute('disabled')
            );
            expect(enabledPrimaryBtns.length).toBeGreaterThanOrEqual(2);
        });

        // Click the save button (second enabled primary icon button)
        const allBtns = screen.getAllByRole('button');
        const enabledPrimaryBtns = allBtns.filter(
            (btn: HTMLElement) =>
                btn.classList.contains('MuiIconButton-colorPrimary') &&
                !btn.hasAttribute('disabled')
        );
        await user.click(enabledPrimaryBtns[1]);

        await waitFor(() => {
            expect(mockUpdateBreweryEndpoint).toHaveBeenCalledWith('brewery-1', expect.any(Object));
        });
    });

    it('should show validation error when saving with empty name', async () => {
        const user = userEvent.setup();
        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
        });

        // Clear the name to make it invalid but also trigger hasChanges
        const nameInput = screen.getByLabelText('breweries.name');
        fireEvent.change(nameInput, { target: { value: '' } });

        // Wait for the buttons to become enabled
        await waitFor(() => {
            const primaryBtns = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
            expect(primaryBtns.length).toBeGreaterThanOrEqual(2);
        });

        const enabledPrimaryBtns = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
        await user.click(enabledPrimaryBtns[1] as HTMLElement); // save = second button

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });

        expect(mockUpdateBreweryEndpoint).not.toHaveBeenCalled();
    });

    // --- Deleting ---
    it('should show delete confirmation dialog when delete button is clicked', async () => {
        const user = userEvent.setup();
        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
        });

        // The delete button is the error-colored IconButton
        const deleteButton = document.querySelector('.MuiIconButton-colorError') as HTMLElement;
        expect(deleteButton).toBeTruthy();
        await user.click(deleteButton);

        // Confirmation dialog should appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('should call delete API after confirming deletion', async () => {
        const user = userEvent.setup();
        mockDeleteBreweryEndpoint.mockResolvedValue({});

        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
        });

        // Click delete icon (error-colored icon button)
        const deleteButton = document.querySelector('.MuiIconButton-colorError') as HTMLElement;
        await user.click(deleteButton);

        // Wait for dialog to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Click the "common.delete" button in the dialog
        const confirmButton = screen.getByRole('button', { name: 'common.delete' });
        await user.click(confirmButton);

        await waitFor(() => {
            expect(mockDeleteBreweryEndpoint).toHaveBeenCalledWith('brewery-1');
            expect(mockTriggerRefresh).toHaveBeenCalled();
        });
    });

    // --- Reset ---
    it('should show reset confirmation dialog when reset button is clicked', async () => {
        const user = userEvent.setup();
        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
        });

        // Change the name to enable reset
        const nameInput = screen.getByLabelText('breweries.name');
        fireEvent.change(nameInput, { target: { value: 'Changed' } });

        // Wait for reset button to become enabled (first primary IconButton)
        await waitFor(() => {
            const primaryButtons = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
            expect(primaryButtons.length).toBeGreaterThanOrEqual(1);
        });

        const primaryButtons = document.querySelectorAll('.MuiIconButton-colorPrimary:not([disabled])');
        const resetButton = primaryButtons[0] as HTMLElement;
        await user.click(resetButton);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('common.reset')).toBeInTheDocument();
        });
    });

    // --- Fetch failure ---
    it('should handle fetch failure gracefully', async () => {
        mockExecuteApiCall.mockResolvedValue(null);

        render(<BreweryDetailCard {...defaultProps} />);

        await waitFor(() => {
            expect(defaultProps.onProgressbarVisibilityChange).toHaveBeenCalledWith(false);
        });

        // Should still show the empty form, not crash
        expect(screen.getByLabelText('breweries.name')).toHaveValue('');
    });
});
