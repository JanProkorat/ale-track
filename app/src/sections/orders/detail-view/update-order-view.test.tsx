import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import { screen, render as baseRender } from 'src/test/test-utils';

import { UpdateOrderView } from './update-order-view';
import {
    OrderState,
    UpdateOrderDto,
    UpdateOrderItemDto,
    GroupedProductHistoryDto,
} from '../../../api/Client';

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
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCallWithDefault: vi.fn(),
    }),
}));

// Mock AuthorizedClient
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        fetchClients = vi.fn().mockResolvedValue([]);
    },
}));

// Mock heavy child components
vi.mock('../components/client-select', () => ({
    ClientSelect: ({ disabled }: { disabled?: boolean }) => (
        <div data-testid="client-select">{disabled ? 'disabled' : 'enabled'}</div>
    ),
}));

vi.mock('../components/order-state-select', () => ({
    OrderStateSelect: ({ selectedState }: { selectedState: OrderState }) => (
        <div data-testid="order-state-select">state:{selectedState}</div>
    ),
}));

vi.mock('../components/order-products-select', () => ({
    OrderProductsSelect: ({ disabled }: { disabled?: boolean }) => (
        <div data-testid="order-products-select">{disabled ? 'disabled' : 'enabled'}</div>
    ),
}));

vi.mock('../components/order-items-table', () => ({
    OrderItemsTable: ({ disabled }: { disabled?: boolean }) => (
        <div data-testid="order-items-table">{disabled ? 'disabled' : 'enabled'}</div>
    ),
}));

// --- Test data ---
const mockOrder = new UpdateOrderDto({
    clientId: 'client-1',
    state: OrderState.New,
    requiredDeliveryDate: new Date('2026-04-01'),
    actualDeliveryDate: undefined,
    orderItems: [
        new UpdateOrderItemDto({ productId: 'prod-1', quantity: 5 }),
    ],
});

const mockProducts = new GroupedProductHistoryDto({});
const mockOnChange = vi.fn();

describe('UpdateOrderView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the client select', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByTestId('client-select')).toBeInTheDocument();
    });

    it('should render the order state select', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByTestId('order-state-select')).toBeInTheDocument();
    });

    it('should render required delivery date picker', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getAllByText('orders.requiredDeliveryDate').length).toBeGreaterThanOrEqual(1);
    });

    it('should render actual delivery date picker', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getAllByText('orders.actualDeliveryDate').length).toBeGreaterThanOrEqual(1);
    });

    it('should render products section title', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByText('products.title')).toBeInTheDocument();
    });

    it('should render product select and items table', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByTestId('order-products-select')).toBeInTheDocument();
        expect(screen.getByTestId('order-items-table')).toBeInTheDocument();
    });

    it('should pass disabled to child components when disabled', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled
                onChange={mockOnChange}
            />
        );

        expect(screen.getByTestId('client-select')).toHaveTextContent('disabled');
        expect(screen.getByTestId('order-products-select')).toHaveTextContent('disabled');
        expect(screen.getByTestId('order-items-table')).toHaveTextContent('disabled');
    });

    it('should pass enabled to child components when not disabled', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByTestId('client-select')).toHaveTextContent('enabled');
        expect(screen.getByTestId('order-products-select')).toHaveTextContent('enabled');
        expect(screen.getByTestId('order-items-table')).toHaveTextContent('enabled');
    });

    it('should display current order state', () => {
        render(
            <UpdateOrderView
                order={mockOrder}
                products={mockProducts}
                shouldValidate={false}
                disabled={false}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByTestId('order-state-select')).toHaveTextContent(`state:${OrderState.New}`);
    });
});
