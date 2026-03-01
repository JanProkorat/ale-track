import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { CreateOrderView } from './create-order-view';
import { GroupedProductHistoryDto } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) =>
    baseRender(<LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>, {
        theme: testTheme,
    });

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
const mockCreateOrderEndpoint = vi.fn();
const mockFetchProductsWithClientHistory = vi.fn();
const mockFetchClients = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        createOrderEndpoint = mockCreateOrderEndpoint;
        fetchProductsWithClientHistory = mockFetchProductsWithClientHistory;
        fetchClients = mockFetchClients;
    },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
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

// Mock heavy child components
vi.mock('../components/client-select', () => ({
    ClientSelect: ({ onSelect }: { onSelect: (id: string) => void }) => (
        <div data-testid="client-select">
            <button onClick={() => onSelect('client-1')}>select-client</button>
        </div>
    ),
}));

vi.mock('../components/order-products-select', () => ({
    OrderProductsSelect: () => <div data-testid="order-products-select" />,
}));

vi.mock('../components/order-items-table', () => ({
    OrderItemsTable: () => <div data-testid="order-items-table" />,
}));

const mockOnClose = vi.fn();
const mockOnSave = vi.fn();

describe('CreateOrderView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchClients.mockResolvedValue([]);
        mockFetchProductsWithClientHistory.mockResolvedValue(new GroupedProductHistoryDto({}));
    });

    it('should render the drawer title', () => {
        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('orders.new')).toBeInTheDocument();
    });

    it('should render close and save buttons', () => {
        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'common.saveAndClose' })).toBeInTheDocument();
    });

    it('should render client select component', () => {
        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByTestId('client-select')).toBeInTheDocument();
    });

    it('should render delivery date picker', () => {
        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getAllByText('orders.requiredDeliveryDate').length).toBeGreaterThanOrEqual(1);
    });

    it('should render products section title', () => {
        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('products.title')).toBeInTheDocument();
    });

    it('should render product select and items table', () => {
        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByTestId('order-products-select')).toBeInTheDocument();
        expect(screen.getByTestId('order-items-table')).toBeInTheDocument();
    });

    it('should show validation error when saving without client', async () => {
        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });
    });

    it('should call create API on successful save', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockCreateOrderEndpoint.mockResolvedValue('new-order-id');

        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        // Select a client first
        fireEvent.click(screen.getByText('select-client'));

        await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

        await waitFor(() => {
            expect(mockCreateOrderEndpoint).toHaveBeenCalled();
        });
    });

    it('should call onClose when close button is clicked', async () => {
        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.click(screen.getByRole('button', { name: 'common.close' }));

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should fetch products when client is selected', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());

        render(<CreateOrderView width={1100} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.click(screen.getByText('select-client'));

        await waitFor(() => {
            expect(mockFetchProductsWithClientHistory).toHaveBeenCalled();
        });
    });
});
