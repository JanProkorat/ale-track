import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { Region } from '../../../api/Client';
import { CreateClientView } from './create-client-view';

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
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
    }),
}));

// Mock AuthorizedClient
const mockCreateClientEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        createClientEndpoint = mockCreateClientEndpoint;
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

// --- Default props ---
const mockOnClose = vi.fn();
const defaultProps = {
    region: Region.ZittauCity,
    onClose: mockOnClose,
};

describe('CreateClientView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCall.mockImplementation((apiCall: () => Promise<unknown>) => apiCall());
    });

    // --- Rendering ---
    it('should render the drawer with title and form fields', () => {
        render(<CreateClientView {...defaultProps} />);

        expect(screen.getByText('clients.detailTitle')).toBeInTheDocument();
        expect(screen.getByLabelText('clients.name')).toBeInTheDocument();
        expect(screen.getByLabelText('clients.businessName')).toBeInTheDocument();
    });

    it('should render close and save buttons', () => {
        render(<CreateClientView {...defaultProps} />);

        expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'common.saveAndClose' })).toBeInTheDocument();
    });

    it('should render the address section', () => {
        render(<CreateClientView {...defaultProps} />);

        // The collapsible address form
        expect(screen.getByText('address.address')).toBeInTheDocument();
    });

    it('should render the contacts section', () => {
        render(<CreateClientView {...defaultProps} />);

        expect(screen.getByText('clients.contacts.title')).toBeInTheDocument();
    });

    // --- Input handling ---
    it('should allow typing a client name', () => {
        render(<CreateClientView {...defaultProps} />);

        const nameInput = screen.getByLabelText('clients.name');
        fireEvent.change(nameInput, { target: { value: 'New Client' } });

        expect(nameInput).toHaveValue('New Client');
    });

    it('should allow typing a business name', () => {
        render(<CreateClientView {...defaultProps} />);

        const businessInput = screen.getByLabelText('clients.businessName');
        fireEvent.change(businessInput, { target: { value: 'Business Corp' } });

        expect(businessInput).toHaveValue('Business Corp');
    });

    // --- Close ---
    it('should call onClose when close button is clicked', async () => {
        const user = userEvent.setup();
        render(<CreateClientView {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: 'common.close' }));

        expect(mockOnClose).toHaveBeenCalled();
    });

    // --- Validation ---
    it('should show validation error when saving with empty name', async () => {
        const user = userEvent.setup();
        render(<CreateClientView {...defaultProps} />);

        // Click save without filling in required fields
        await user.click(screen.getByRole('button', { name: 'common.saveAndClose' }));

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });

        expect(mockCreateClientEndpoint).not.toHaveBeenCalled();
    });

    // --- Successful save ---
    it('should call create API and close on successful save', async () => {
        const user = userEvent.setup();
        mockCreateClientEndpoint.mockResolvedValue('new-client-id');

        render(<CreateClientView {...defaultProps} />);

        // Fill required fields
        fireEvent.change(screen.getByLabelText('clients.name'), { target: { value: 'New Client' } });

        // Expand address section and fill required address fields
        const addressHeader = screen.getByText('address.address');
        await user.click(addressHeader);

        await waitFor(() => {
            expect(screen.getAllByLabelText('address.street').length).toBeGreaterThanOrEqual(1);
        });

        // There are two address forms (official + contact), use the first (official) set
        const streetInputs = screen.getAllByLabelText('address.street');
        const numberInputs = screen.getAllByLabelText('address.number');
        const cityInputs = screen.getAllByLabelText('address.city');
        const zipInputs = screen.getAllByLabelText('address.zip');

        fireEvent.change(streetInputs[0], { target: { value: 'Main St' } });
        fireEvent.change(numberInputs[0], { target: { value: '1' } });
        fireEvent.change(cityInputs[0], { target: { value: 'Prague' } });
        fireEvent.change(zipInputs[0], { target: { value: '11000' } });

        // Click save
        await user.click(screen.getByRole('button', { name: 'common.saveAndClose' }));

        await waitFor(() => {
            expect(mockCreateClientEndpoint).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('clients.saveSuccess', 'success');
            expect(mockTriggerRefresh).toHaveBeenCalled();
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    // --- Save failure ---
    it('should not close when API call fails', async () => {
        const user = userEvent.setup();
        mockExecuteApiCall.mockResolvedValue(null); // API returns null on failure

        render(<CreateClientView {...defaultProps} />);

        // Fill required fields
        fireEvent.change(screen.getByLabelText('clients.name'), { target: { value: 'New Client' } });

        const addressHeader = screen.getByText('address.address');
        await user.click(addressHeader);

        await waitFor(() => {
            expect(screen.getAllByLabelText('address.street').length).toBeGreaterThanOrEqual(1);
        });

        // Use first (official) address form inputs
        const streetInputs = screen.getAllByLabelText('address.street');
        const numberInputs = screen.getAllByLabelText('address.number');
        const cityInputs = screen.getAllByLabelText('address.city');
        const zipInputs = screen.getAllByLabelText('address.zip');

        fireEvent.change(streetInputs[0], { target: { value: 'Main St' } });
        fireEvent.change(numberInputs[0], { target: { value: '1' } });
        fireEvent.change(cityInputs[0], { target: { value: 'Prague' } });
        fireEvent.change(zipInputs[0], { target: { value: '11000' } });

        await user.click(screen.getByRole('button', { name: 'common.saveAndClose' }));

        await waitFor(() => {
            // onClose should NOT be called when API fails
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });
});
