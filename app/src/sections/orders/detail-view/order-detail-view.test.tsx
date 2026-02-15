import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { OrderDetailView } from './order-detail-view';
import {
    OrderDto,
    OrderItemDto,
    ClientInfoDto,
    GroupedProductHistoryDto,
} from '../../../api/Client';

import type {
    OrderState,
    UpdateOrderDto
} from '../../../api/Client';

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

// Mock react-router-dom
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useBlocker: () => ({ state: 'idle' }),
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
const mockGetOrderDetailEndpoint = vi.fn();
const mockUpdateOrderEndpoint = vi.fn();
const mockDeleteOrderEndpoint = vi.fn();
const mockFetchProductsWithClientHistory = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        getOrderDetailEndpoint = mockGetOrderDetailEndpoint;
        updateOrderEndpoint = mockUpdateOrderEndpoint;
        deleteOrderEndpoint = mockDeleteOrderEndpoint;
        fetchProductsWithClientHistory = mockFetchProductsWithClientHistory;
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

// Mock UpdateOrderView child
vi.mock('./update-order-view', () => ({
    UpdateOrderView: ({
        disabled,
        order,
    }: {
        disabled: boolean;
        order: UpdateOrderDto;
    }) => (
        <div data-testid="update-order-view">
            {disabled ? 'disabled' : 'enabled'} | client:{order.clientId}
        </div>
    ),
}));

// --- Test data ---
const mockOrderDetail = new OrderDto({
    id: 'order-1',
    client: new ClientInfoDto({ id: 'client-1', name: 'Test Client' }),
    state: 'New' as unknown as OrderState,
    requiredDeliveryDate: new Date('2026-04-01'),
    orderItems: [
        new OrderItemDto({ productId: 'prod-1', quantity: 10 }),
    ],
});

const mockCancelledOrder = new OrderDto({
    id: 'order-2',
    client: new ClientInfoDto({ id: 'client-2', name: 'Cancelled Client' }),
    state: 'Cancelled' as unknown as OrderState,
    requiredDeliveryDate: new Date('2026-04-01'),
    orderItems: [],
});

const defaultProps = {
    shouldCheckPendingChanges: false,
    onDelete: vi.fn(),
    onConfirmed: vi.fn(),
    onHasChangesChange: vi.fn(),
    onProgressbarVisibilityChange: vi.fn(),
};

describe('OrderDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchProductsWithClientHistory.mockResolvedValue(new GroupedProductHistoryDto({}));
    });

    // --- No ID ---

    it('should show no detail message when id is undefined', () => {
        render(
            <OrderDetailView id={undefined} {...defaultProps} />
        );

        expect(screen.getByText('orders.noDetailToDisplay')).toBeInTheDocument();
    });

    it('should not render UpdateOrderView when id is undefined', () => {
        render(
            <OrderDetailView id={undefined} {...defaultProps} />
        );

        expect(screen.queryByTestId('update-order-view')).not.toBeInTheDocument();
    });

    // --- Fetch order on mount ---

    it('should fetch order detail when id is provided', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetOrderDetailEndpoint.mockResolvedValue(mockOrderDetail);

        render(
            <OrderDetailView id="order-1" {...defaultProps} />
        );

        await waitFor(() => {
            expect(mockGetOrderDetailEndpoint).toHaveBeenCalledWith('order-1');
        });
    });

    it('should render the detail title', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetOrderDetailEndpoint.mockResolvedValue(mockOrderDetail);

        render(
            <OrderDetailView id="order-1" {...defaultProps} />
        );

        await waitFor(() => {
            expect(screen.getByText('orders.detailTitle')).toBeInTheDocument();
        });
    });

    it('should render UpdateOrderView with order data after fetch', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetOrderDetailEndpoint.mockResolvedValue(mockOrderDetail);

        render(
            <OrderDetailView id="order-1" {...defaultProps} />
        );

        await waitFor(() => {
            expect(screen.getByTestId('update-order-view')).toBeInTheDocument();
            expect(screen.getByText(/client:client-1/)).toBeInTheDocument();
        });
    });

    // --- Disabled state for cancelled/finished orders ---

    it('should disable UpdateOrderView for cancelled orders', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetOrderDetailEndpoint.mockResolvedValue(mockCancelledOrder);

        render(
            <OrderDetailView id="order-2" {...defaultProps} />
        );

        await waitFor(() => {
            expect(screen.getByText(/disabled/)).toBeInTheDocument();
        });
    });

    it('should disable UpdateOrderView for finished orders', async () => {
        const finishedOrder = new OrderDto({
            ...mockCancelledOrder,
            state: 'Finished' as unknown as OrderState,
        });
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetOrderDetailEndpoint.mockResolvedValue(finishedOrder);

        render(
            <OrderDetailView id="order-2" {...defaultProps} />
        );

        await waitFor(() => {
            expect(screen.getByText(/disabled/)).toBeInTheDocument();
        });
    });

    it('should enable UpdateOrderView for new orders', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetOrderDetailEndpoint.mockResolvedValue(mockOrderDetail);

        render(
            <OrderDetailView id="order-1" {...defaultProps} />
        );

        await waitFor(() => {
            expect(screen.getByText(/enabled/)).toBeInTheDocument();
        });
    });

    // --- Delete ---

    it('should render delete button', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetOrderDetailEndpoint.mockResolvedValue(mockOrderDetail);

        render(
            <OrderDetailView id="order-1" {...defaultProps} />
        );

        await waitFor(() => {
            expect(screen.getByTestId('update-order-view')).toBeInTheDocument();
        });

        // Delete button is the error-colored icon button
        const deleteButton = document.querySelector('.MuiIconButton-colorError');
        expect(deleteButton).toBeInTheDocument();
    });

    // --- Progressbar visibility ---

    it('should call onProgressbarVisibilityChange during fetch', async () => {
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockGetOrderDetailEndpoint.mockResolvedValue(mockOrderDetail);

        render(
            <OrderDetailView id="order-1" {...defaultProps} />
        );

        await waitFor(() => {
            expect(defaultProps.onProgressbarVisibilityChange).toHaveBeenCalledWith(true);
            expect(defaultProps.onProgressbarVisibilityChange).toHaveBeenCalledWith(false);
        });
    });
});
