import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, render as baseRender } from 'src/test/test-utils';

import { OrderItemsTable } from './order-items-table';
import {
    KindGroupDto,
    BreweryGroupDto,
    PackageGroupDto,
    CreateOrderItemDto,
    ProductListItemDto,
    GroupedProductHistoryDto,
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

// Mock Scrollbar
vi.mock('src/components/scrollbar', () => ({
    Scrollbar: ({ children }: { children: React.ReactNode }) => <div data-testid="scrollbar">{children}</div>,
}));

// Mock OrderItemTableRow as a simple row to avoid complex child rendering
vi.mock('./order-item-table-row', () => ({
    OrderItemTableRow: ({ row, quantity }: { row: { name: string }; quantity: number }) => (
        <tr data-testid={`order-item-row-${row.name}`}>
            <td>{row.name}</td>
            <td>{quantity}</td>
        </tr>
    ),
}));

const mockOnProductsChanged = vi.fn();

const mockProducts: ProductListItemDto[] = [
    new ProductListItemDto({
        id: 'p1',
        name: 'Pilsner',
        kind: 1,
        type: 2,
        packageSize: 50,
        weight: 55,
        priceWithVat: 1200,
        priceForUnitWithVat: 24,
    }),
    new ProductListItemDto({
        id: 'p2',
        name: 'Lager',
        kind: 1,
        type: 3,
        packageSize: 30,
        weight: 35,
        priceWithVat: 800,
        priceForUnitWithVat: 26,
    }),
];

const mockGroupedProducts = new GroupedProductHistoryDto({
    recent: mockProducts,
    breweries: [],
});

const mockOrderProducts = [
    new CreateOrderItemDto({ productId: 'p1', quantity: 5 }),
    new CreateOrderItemDto({ productId: 'p2', quantity: 10 }),
];

describe('OrderItemsTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render table column headers', () => {
        render(
            <OrderItemsTable
                orderProducts={mockOrderProducts}
                products={mockGroupedProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('products.name')).toBeInTheDocument();
        expect(screen.getByText('productDeliveries.quantity')).toBeInTheDocument();
        expect(screen.getByText('products.kind')).toBeInTheDocument();
        expect(screen.getByText('products.packageSize')).toBeInTheDocument();
        expect(screen.getByText('products.weight')).toBeInTheDocument();
        expect(screen.getByText('products.priceVat')).toBeInTheDocument();
        expect(screen.getByText('products.priceUnitVat')).toBeInTheDocument();
        expect(screen.getByText('products.type')).toBeInTheDocument();
    });

    it('should render order item rows for each product', () => {
        render(
            <OrderItemsTable
                orderProducts={mockOrderProducts}
                products={mockGroupedProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByTestId('order-item-row-Pilsner')).toBeInTheDocument();
        expect(screen.getByTestId('order-item-row-Lager')).toBeInTheDocument();
    });

    it('should show empty state when no order products', () => {
        render(
            <OrderItemsTable
                orderProducts={[]}
                products={mockGroupedProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('table.noDataTitle')).toBeInTheDocument();
    });

    it('should not render rows for products not found in allProducts', () => {
        const unknownOrderProducts = [
            new CreateOrderItemDto({ productId: 'unknown-id', quantity: 3 }),
        ];

        render(
            <OrderItemsTable
                orderProducts={unknownOrderProducts}
                products={mockGroupedProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        // Should not crash; no row rendered for unknown product
        expect(screen.queryByTestId('order-item-row-Pilsner')).not.toBeInTheDocument();
    });

    it('should render products from brewery groups', () => {
        const breweryGroupedProducts = new GroupedProductHistoryDto({
            recent: [],
            breweries: [
                new BreweryGroupDto({
                    breweryId: 'b1',
                    breweryName: 'Test Brewery',
                    kinds: [
                        new KindGroupDto({
                            kind: 1,
                            packageSizes: [
                                new PackageGroupDto({
                                    size: 50,
                                    items: [mockProducts[0]],
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        });

        const orderProductsFromBrewery = [
            new CreateOrderItemDto({ productId: 'p1', quantity: 7 }),
        ];

        render(
            <OrderItemsTable
                orderProducts={orderProductsFromBrewery}
                products={breweryGroupedProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByTestId('order-item-row-Pilsner')).toBeInTheDocument();
    });
});
