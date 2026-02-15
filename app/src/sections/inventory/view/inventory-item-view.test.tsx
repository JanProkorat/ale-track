import { it, vi, expect, describe } from 'vitest';

import { screen, render } from 'src/test/test-utils';
import { InventoryItemListItemDto } from 'src/api/Client';

import { InventoryItemView } from './inventory-item-view';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockItem = new InventoryItemListItemDto({
    id: 'inv1',
    name: 'Pilsner',
    quantity: 42,
    kind: 1 as any,
    alcoholPercentage: 4.5,
    platoDegree: 12,
    packageSize: 0.5,
    priceWithVat: 50,
});

describe('InventoryItemView', () => {
    it('should render item name', () => {
        render(<InventoryItemView item={mockItem} />);

        expect(screen.getByText('Pilsner')).toBeInTheDocument();
    });

    it('should render item quantity', () => {
        render(<InventoryItemView item={mockItem} />);

        expect(screen.getByText('42 Ks')).toBeInTheDocument();
    });

    it('should render alcohol percentage', () => {
        render(<InventoryItemView item={mockItem} />);

        expect(screen.getByText('products.alcoholPercentage')).toBeInTheDocument();
        expect(screen.getByText('4.5 %')).toBeInTheDocument();
    });

    it('should render plato degree', () => {
        render(<InventoryItemView item={mockItem} />);

        expect(screen.getByText('products.platoDegree')).toBeInTheDocument();
        expect(screen.getByText('12 %')).toBeInTheDocument();
    });

    it('should render package size', () => {
        render(<InventoryItemView item={mockItem} />);

        expect(screen.getByText('products.packageSize')).toBeInTheDocument();
        expect(screen.getByText('0.5 L')).toBeInTheDocument();
    });

    it('should render price with VAT', () => {
        render(<InventoryItemView item={mockItem} />);

        expect(screen.getByText('products.priceVat')).toBeInTheDocument();
        expect(screen.getByText('50 Kč')).toBeInTheDocument();
    });

    it('should render product image', () => {
        render(<InventoryItemView item={mockItem} />);

        const img = screen.getByAltText('Pilsner');
        expect(img).toBeInTheDocument();
    });
});
