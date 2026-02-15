import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, fireEvent, render as baseRender } from 'src/test/test-utils';

import { OrderProductsSelect } from './order-products-select';
import {
    ProductKind,
    ProductType,
    KindGroupDto,
    BreweryGroupDto,
    PackageGroupDto,
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

const mockOnProductsChanged = vi.fn();

const recentProduct1 = new ProductListItemDto({
    id: 'r1',
    name: 'Recent Pilsner',
    kind: ProductKind.Keg,
    type: ProductType.PaleLager,
    packageSize: 50,
});

const recentProduct2 = new ProductListItemDto({
    id: 'r2',
    name: 'Recent Lager',
    kind: ProductKind.Keg,
    type: ProductType.PaleLager,
    packageSize: 50,
});

const breweryProduct1 = new ProductListItemDto({
    id: 'b1p1',
    name: 'Brewery IPA',
    kind: ProductKind.Bottle,
    type: ProductType.SpecialBeer,
    packageSize: 0.5,
});

const mockProducts = new GroupedProductHistoryDto({
    recent: [recentProduct1, recentProduct2],
    breweries: [
        new BreweryGroupDto({
            breweryId: 'brew1',
            breweryName: 'Test Brewery',
            kinds: [
                new KindGroupDto({
                    kind: ProductKind.Bottle,
                    packageSizes: [
                        new PackageGroupDto({
                            size: 0.5,
                            items: [breweryProduct1],
                        }),
                    ],
                }),
            ],
        }),
    ],
});


describe('OrderProductsSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the products label', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('products.title')).toBeInTheDocument();
    });

    it('should render the recent section header', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        // Open the select dropdown
        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        expect(screen.getByText('products.recent')).toBeInTheDocument();
    });

    it('should render brewery name as section header', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        // Open the select dropdown
        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        expect(screen.getByText('Test Brewery')).toBeInTheDocument();
    });

    it('should render recent product items', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        expect(screen.getByText('Recent Pilsner')).toBeInTheDocument();
        expect(screen.getByText('Recent Lager')).toBeInTheDocument();
    });

    it('should render brewery product items', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        expect(screen.getByText('Brewery IPA')).toBeInTheDocument();
    });

    it('should show selected product as checked', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[{ productId: 'r1', quantity: 1 }]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        // Find checkboxes - the one associated with r1 should be checked
        const checkboxes = screen.getAllByRole('checkbox');
        const checkedCheckboxes = checkboxes.filter(
            (cb: HTMLElement) => (cb as HTMLInputElement).checked
        );
        expect(checkedCheckboxes.length).toBeGreaterThanOrEqual(1);
    });

    it('should call onProductsChanged when a product is toggled', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        // Click on a product item
        const pilsnerItem = screen.getByText('Recent Pilsner');
        fireEvent.click(pilsnerItem);

        expect(mockOnProductsChanged).toHaveBeenCalled();
    });

    it('should show validation error when shouldValidate is true and no products selected', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const label = screen.getByText('products.title');
        expect(label.closest('.Mui-error') ?? label.classList.contains('Mui-error')).toBeTruthy();
    });

    it('should not show validation error when products are selected', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[{ productId: 'r1', quantity: 1 }]}
                shouldValidate
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const label = screen.getByText('products.title');
        const errorElement = label.closest('.Mui-error');
        expect(errorElement).toBeNull();
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[]}
                shouldValidate={false}
                disabled
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        expect(selectButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should display selected product chips in the render value', () => {
        render(
            <OrderProductsSelect
                products={mockProducts}
                selectedProducts={[{ productId: 'r1', quantity: 1 }]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        expect(screen.getByText('Recent Pilsner')).toBeInTheDocument();
    });

    it('should not render recent section when there are no recent products', () => {
        const noRecentProducts = new GroupedProductHistoryDto({
            recent: [],
            breweries: [
                new BreweryGroupDto({
                    breweryId: 'brew1',
                    breweryName: 'Test Brewery',
                    kinds: [
                        new KindGroupDto({
                            kind: ProductKind.Bottle,
                            packageSizes: [
                                new PackageGroupDto({
                                    size: 0.5,
                                    items: [breweryProduct1],
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        });

        render(
            <OrderProductsSelect
                products={noRecentProducts}
                selectedProducts={[]}
                shouldValidate={false}
                onProductsChanged={mockOnProductsChanged}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        expect(screen.queryByText('products.recent')).not.toBeInTheDocument();
        expect(screen.getByText('Test Brewery')).toBeInTheDocument();
    });
});
