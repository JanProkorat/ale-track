import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, fireEvent } from 'src/test/test-utils';
import {
    BreweryProductListItemDto,
    UpdateProductDeliveryItemDto,
    CreateProductDeliveryItemDto,
} from 'src/api/Client';

import { DeliveryItemsTable } from './delivery-items-table';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../../components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

const mockProducts: BreweryProductListItemDto[] = [
    new BreweryProductListItemDto({
        id: 'p1',
        name: 'Pilsner',
        kind: 1 as any,
        type: 0 as any,
        packageSize: 0.5,
        weight: 10,
        priceWithVat: 50,
        priceForUnitWithVat: 100,
    }),
    new BreweryProductListItemDto({
        id: 'p2',
        name: 'Lager',
        kind: 2 as any,
        type: 1 as any,
        packageSize: 0.33,
        weight: 8,
        priceWithVat: 40,
        priceForUnitWithVat: 120,
    }),
];

const mockOnProductsChanged = vi.fn();

describe('DeliveryItemsTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render table headers', () => {
        render(
            <DeliveryItemsTable
                deliveryProducts={[]}
                products={mockProducts}
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

    it('should render no data row when there are no delivery products', () => {
        render(
            <DeliveryItemsTable
                deliveryProducts={[]}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('table.noDataTitle')).toBeInTheDocument();
    });

    it('should render product rows with UpdateProductDeliveryItemDto', () => {
        const deliveryProducts = [
            new UpdateProductDeliveryItemDto({ productId: 'p1', quantity: 5 }),
            new UpdateProductDeliveryItemDto({ productId: 'p2', quantity: 3 }),
        ];

        render(
            <DeliveryItemsTable
                deliveryProducts={deliveryProducts}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('Pilsner')).toBeInTheDocument();
        expect(screen.getByText('Lager')).toBeInTheDocument();
        expect(screen.getByDisplayValue('5')).toBeInTheDocument();
        expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    });

    it('should render product rows with CreateProductDeliveryItemDto', () => {
        const deliveryProducts = [
            new CreateProductDeliveryItemDto({ productId: 'p1', quantity: 10 }),
        ];

        render(
            <DeliveryItemsTable
                deliveryProducts={deliveryProducts}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('Pilsner')).toBeInTheDocument();
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('should call onProductsChanged when a product is deleted', () => {
        const deliveryProducts = [
            new UpdateProductDeliveryItemDto({ productId: 'p1', quantity: 5 }),
            new UpdateProductDeliveryItemDto({ productId: 'p2', quantity: 3 }),
        ];

        render(
            <DeliveryItemsTable
                deliveryProducts={deliveryProducts}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        // Sorted by name ascending: Lager (p2), Pilsner (p1)
        // Click the first delete button to delete Lager (p2)
        const deleteButtons = screen.getAllByTestId('iconify')
            .filter((el: HTMLElement) => el.textContent === 'solar:trash-bin-trash-bold')
            .map((el: HTMLElement) => el.closest('button')!);
        deleteButtons[0].click();

        expect(mockOnProductsChanged).toHaveBeenCalledTimes(1);
        const updatedProducts = mockOnProductsChanged.mock.calls[0][0];
        expect(updatedProducts).toHaveLength(1);
        expect(updatedProducts[0].productId).toBe('p1');
    });

    it('should call onProductsChanged when quantity changes', () => {
        const deliveryProducts = [
            new UpdateProductDeliveryItemDto({ productId: 'p1', quantity: 5 }),
        ];

        render(
            <DeliveryItemsTable
                deliveryProducts={deliveryProducts}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const quantityInput = screen.getByDisplayValue('5');
        fireEvent.change(quantityInput, { target: { value: '12' } });

        expect(mockOnProductsChanged).toHaveBeenCalledTimes(1);
        const updatedProducts = mockOnProductsChanged.mock.calls[0][0];
        expect(updatedProducts[0].quantity).toBe(12);
    });

    it('should preserve UpdateProductDeliveryItemDto type when changing quantity', () => {
        const deliveryProducts = [
            new UpdateProductDeliveryItemDto({ productId: 'p1', quantity: 5 }),
        ];

        render(
            <DeliveryItemsTable
                deliveryProducts={deliveryProducts}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const quantityInput = screen.getByDisplayValue('5');
        fireEvent.change(quantityInput, { target: { value: '8' } });

        const updatedProducts = mockOnProductsChanged.mock.calls[0][0];
        expect(updatedProducts[0]).toBeInstanceOf(UpdateProductDeliveryItemDto);
    });

    it('should preserve CreateProductDeliveryItemDto type when changing quantity', () => {
        const deliveryProducts = [
            new CreateProductDeliveryItemDto({ productId: 'p1', quantity: 5 }),
        ];

        render(
            <DeliveryItemsTable
                deliveryProducts={deliveryProducts}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const quantityInput = screen.getByDisplayValue('5');
        fireEvent.change(quantityInput, { target: { value: '8' } });

        const updatedProducts = mockOnProductsChanged.mock.calls[0][0];
        expect(updatedProducts[0]).toBeInstanceOf(CreateProductDeliveryItemDto);
    });

    it('should not render row for product not found in products list', () => {
        const deliveryProducts = [
            new UpdateProductDeliveryItemDto({ productId: 'unknown-id', quantity: 1 }),
        ];

        render(
            <DeliveryItemsTable
                deliveryProducts={deliveryProducts}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        // No product row should appear, the unknown productId should be skipped
        expect(screen.queryByDisplayValue('1')).not.toBeInTheDocument();
    });

    it('should disable rows when disabled prop is true', () => {
        const deliveryProducts = [
            new UpdateProductDeliveryItemDto({ productId: 'p1', quantity: 5 }),
        ];

        render(
            <DeliveryItemsTable
                deliveryProducts={deliveryProducts}
                products={mockProducts}
                onProductsChanged={mockOnProductsChanged}
                disabled
            />
        );

        const quantityInput = screen.getByDisplayValue('5');
        expect(quantityInput).toBeDisabled();

        const deleteButton = screen.getByTestId('iconify').closest('button')!;
        expect(deleteButton).toBeDisabled();
    });
});
