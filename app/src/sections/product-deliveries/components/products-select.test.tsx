import { it, vi, expect, describe, beforeEach } from 'vitest';

import { BreweryProductListItemDto } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { ProductsSelect } from './products-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockProducts: BreweryProductListItemDto[] = [
    new BreweryProductListItemDto({
        id: 'p1',
        name: 'Pilsner',
        kind: 1 as any,
        type: 0 as any,
        packageSize: 0.5,
    }),
    new BreweryProductListItemDto({
        id: 'p2',
        name: 'Lager',
        kind: 1 as any,
        type: 1 as any,
        packageSize: 0.5,
    }),
    new BreweryProductListItemDto({
        id: 'p3',
        name: 'Stout',
        kind: 2 as any,
        type: 0 as any,
        packageSize: 0.33,
    }),
];

const mockOnProductsChanged = vi.fn();

describe('ProductsSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <ProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('products.title')).toBeInTheDocument();
    });

    it('should render chips for selected products', () => {
        render(
            <ProductsSelect
                products={mockProducts}
                selectedProducts={[{ productId: 'p1', quantity: 2 }]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('Pilsner')).toBeInTheDocument();
    });

    it('should render product options grouped by kind when opened', async () => {
        render(
            <ProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        // Products are grouped by kind/packageSize with ListSubheader sections
        // Each product renders as a MenuItem (option role)
        expect(within(listbox).getByText('Pilsner')).toBeInTheDocument();
        expect(within(listbox).getByText('Lager')).toBeInTheDocument();
        expect(within(listbox).getByText('Stout')).toBeInTheDocument();
    });

    it('should show checked checkbox for selected products', async () => {
        render(
            <ProductsSelect
                products={mockProducts}
                selectedProducts={[{ productId: 'p1', quantity: 1 }]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const checkboxes = within(listbox).getAllByRole('checkbox');

        // At least one checkbox should be checked (the one for p1)
        const checked = checkboxes.filter((cb: HTMLElement) => cb.getAttribute('aria-checked') === 'true' || (cb as HTMLInputElement).checked);
        expect(checked.length).toBeGreaterThanOrEqual(1);
    });

    it('should call onProductsChanged when toggling a product', async () => {
        render(
            <ProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        // Find and click on a product option directly
        const option = within(listbox).getByText('Pilsner').closest('li');
        if (option) {
            fireEvent.click(option);
        }

        expect(mockOnProductsChanged).toHaveBeenCalled();
    });

    it('should show error state when shouldValidate is true and no products selected', () => {
        render(
            <ProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const label = screen.getByText('products.title');
        expect(label).toHaveClass('Mui-error');
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <ProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
                disabled
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-disabled', 'true');
    });

    it('should show +N chip when more than 4 products are selected', () => {
        const selectedProducts = [
            { productId: 'p1', quantity: 1 },
            { productId: 'p2', quantity: 1 },
            { productId: 'p3', quantity: 1 },
            { productId: 'p4', quantity: 1 },
            { productId: 'p5', quantity: 1 },
        ];

        const manyProducts = [
            ...mockProducts,
            new BreweryProductListItemDto({ id: 'p4', name: 'IPA', kind: 1 as any, type: 0 as any, packageSize: 0.5 }),
            new BreweryProductListItemDto({ id: 'p5', name: 'Porter', kind: 2 as any, type: 0 as any, packageSize: 0.33 }),
        ];

        render(
            <ProductsSelect
                products={manyProducts}
                selectedProducts={selectedProducts}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('+1')).toBeInTheDocument();
    });
});
