import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { ProductType } from '../../../../api/Client';
import { ProductTypeSelect } from './product-type-select';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockOnSelect = vi.fn();

const defaultProps = {
    selectedType: undefined as ProductType | undefined,
    types: [ProductType.PaleDraftBeer, ProductType.DarkLager, ProductType.Radler],
    shouldValidate: false,
    onSelect: mockOnSelect,
};

describe('ProductTypeSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(<ProductTypeSelect {...defaultProps} />);

        expect(screen.getAllByText('products.type').length).toBeGreaterThanOrEqual(1);
    });

    it('should render selected type as chip', () => {
        render(
            <ProductTypeSelect {...defaultProps} selectedType={ProductType.PaleDraftBeer} />
        );

        expect(screen.getByText('productType.1')).toBeInTheDocument();
    });

    it('should open dropdown and show type options', () => {
        render(<ProductTypeSelect {...defaultProps} />);

        const select = screen.getByRole('combobox');
        fireEvent.mouseDown(select);

        const listbox = screen.getByRole('listbox');
        expect(within(listbox).getByText('productType.1')).toBeInTheDocument();
        expect(within(listbox).getByText('productType.4')).toBeInTheDocument();
        expect(within(listbox).getByText('productType.8')).toBeInTheDocument();
    });

    it('should call onSelect when a type is clicked', () => {
        render(<ProductTypeSelect {...defaultProps} />);

        const select = screen.getByRole('combobox');
        fireEvent.mouseDown(select);

        const listbox = screen.getByRole('listbox');
        const option = within(listbox).getByText('productType.4').closest('li')!;
        fireEvent.click(option);

        expect(mockOnSelect).toHaveBeenCalledWith(ProductType.DarkLager);
    });

    it('should not show error when shouldValidate is false and nothing selected', () => {
        render(<ProductTypeSelect {...defaultProps} />);

        const label = screen.getAllByText('products.type')[0];
        expect(label.className).not.toContain('Mui-error');
    });

    it('should show error when shouldValidate is true and nothing selected', () => {
        render(<ProductTypeSelect {...defaultProps} shouldValidate />);

        const label = screen.getAllByText('products.type')[0];
        expect(label.className).toContain('Mui-error');
    });

    it('should not show error when shouldValidate is true and type is selected', () => {
        render(
            <ProductTypeSelect
                {...defaultProps}
                shouldValidate
                selectedType={ProductType.Radler}
            />
        );

        const label = screen.getAllByText('products.type')[0];
        expect(label.className).not.toContain('Mui-error');
    });
});
