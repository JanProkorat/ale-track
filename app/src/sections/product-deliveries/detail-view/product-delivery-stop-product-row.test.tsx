import { it, vi, expect, describe, beforeEach } from 'vitest';

import { BreweryProductListItemDto } from 'src/api/Client';
import { screen, render, fireEvent } from 'src/test/test-utils';

import { ProductDeliveryStopProductRow } from './product-delivery-stop-product-row';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../../components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

const mockProduct = new BreweryProductListItemDto({
    id: 'p1',
    name: 'Pilsner',
    kind: 1 as any,
    type: 0 as any,
    packageSize: 0.5,
    weight: 10,
    priceWithVat: 50,
    priceForUnitWithVat: 100,
});

const mockOnDeleteClick = vi.fn();
const mockOnQuantityChange = vi.fn();

const renderInTable = (ui: React.ReactElement) =>
    render(<table><tbody>{ui}</tbody></table>);

describe('ProductDeliveryStopProductRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render product name', () => {
        renderInTable(
            <ProductDeliveryStopProductRow
                row={mockProduct}
                quantity={5}
                onDeleteClick={mockOnDeleteClick}
                onQuantityChange={mockOnQuantityChange}
            />
        );

        expect(screen.getByText('Pilsner')).toBeInTheDocument();
    });

    it('should render quantity in a text field', () => {
        renderInTable(
            <ProductDeliveryStopProductRow
                row={mockProduct}
                quantity={5}
                onDeleteClick={mockOnDeleteClick}
                onQuantityChange={mockOnQuantityChange}
            />
        );

        const input = screen.getByDisplayValue('5');
        expect(input).toBeInTheDocument();
    });

    it('should render product details', () => {
        renderInTable(
            <ProductDeliveryStopProductRow
                row={mockProduct}
                quantity={3}
                onDeleteClick={mockOnDeleteClick}
                onQuantityChange={mockOnQuantityChange}
            />
        );

        expect(screen.getByText('0.5 L')).toBeInTheDocument();
        expect(screen.getByText('10 Kg')).toBeInTheDocument();
        expect(screen.getByText('50 Kč')).toBeInTheDocument();
        expect(screen.getByText('100 Kč')).toBeInTheDocument();
        expect(screen.getByText('productKind.1')).toBeInTheDocument();
        expect(screen.getByText('productType.0')).toBeInTheDocument();
    });

    it('should call onQuantityChange when quantity changes', () => {
        renderInTable(
            <ProductDeliveryStopProductRow
                row={mockProduct}
                quantity={5}
                onDeleteClick={mockOnDeleteClick}
                onQuantityChange={mockOnQuantityChange}
            />
        );

        const input = screen.getByDisplayValue('5');
        fireEvent.change(input, { target: { value: '10' } });

        expect(mockOnQuantityChange).toHaveBeenCalledWith(10);
    });

    it('should call onQuantityChange with undefined when empty', () => {
        renderInTable(
            <ProductDeliveryStopProductRow
                row={mockProduct}
                quantity={5}
                onDeleteClick={mockOnDeleteClick}
                onQuantityChange={mockOnQuantityChange}
            />
        );

        const input = screen.getByDisplayValue('5');
        fireEvent.change(input, { target: { value: '' } });

        expect(mockOnQuantityChange).toHaveBeenCalledWith(undefined);
    });

    it('should call onDeleteClick when delete button is clicked', () => {
        renderInTable(
            <ProductDeliveryStopProductRow
                row={mockProduct}
                quantity={5}
                onDeleteClick={mockOnDeleteClick}
                onQuantityChange={mockOnQuantityChange}
            />
        );

        const deleteButton = screen.getByRole('button');
        deleteButton.click();

        expect(mockOnDeleteClick).toHaveBeenCalled();
    });

    it('should disable quantity input and delete button when disabled', () => {
        renderInTable(
            <ProductDeliveryStopProductRow
                row={mockProduct}
                quantity={5}
                onDeleteClick={mockOnDeleteClick}
                onQuantityChange={mockOnQuantityChange}
                disabled
            />
        );

        const input = screen.getByDisplayValue('5');
        expect(input).toBeDisabled();

        const deleteButton = screen.getByRole('button');
        expect(deleteButton).toBeDisabled();
    });

    it('should toggle checkbox selection', () => {
        const { container } = renderInTable(
            <ProductDeliveryStopProductRow
                row={mockProduct}
                quantity={5}
                onDeleteClick={mockOnDeleteClick}
                onQuantityChange={mockOnQuantityChange}
            />
        );

        const checkboxInput = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkboxInput.checked).toBe(false);

        fireEvent.click(checkboxInput);
        expect(checkboxInput.checked).toBe(true);

        fireEvent.click(checkboxInput);
        expect(checkboxInput.checked).toBe(false);
    });
});
