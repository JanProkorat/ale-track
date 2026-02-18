import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { ProductKind } from '../../../../api/Client';
import { ProductKindSelect } from './product-kind-select';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

const mockOnSelect = vi.fn();

const defaultProps = {
     selectedKind: undefined as ProductKind | undefined,
     kinds: ['Keg', 'Bottle', 'Can'],
     shouldValidate: false,
     onSelect: mockOnSelect,
};

describe('ProductKindSelect', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render the label', () => {
          render(<ProductKindSelect {...defaultProps} />);

          expect(screen.getAllByText('products.kind').length).toBeGreaterThanOrEqual(1);
     });

     it('should render selected kind as chip', () => {
          render(<ProductKindSelect {...defaultProps} selectedKind={ProductKind.Keg} />);

          expect(screen.getByText('productKind.Keg')).toBeInTheDocument();
     });

     it('should open dropdown and show kind options', () => {
          render(<ProductKindSelect {...defaultProps} />);

          const select = screen.getByRole('combobox');
          fireEvent.mouseDown(select);

          const listbox = screen.getByRole('listbox');
          expect(within(listbox).getByText('productKind.Keg')).toBeInTheDocument();
          expect(within(listbox).getByText('productKind.Bottle')).toBeInTheDocument();
          expect(within(listbox).getByText('productKind.Can')).toBeInTheDocument();
     });

     it('should call onSelect when a kind is clicked', () => {
          render(<ProductKindSelect {...defaultProps} />);

          const select = screen.getByRole('combobox');
          fireEvent.mouseDown(select);

          const listbox = screen.getByRole('listbox');
          const option = within(listbox).getByText('productKind.Keg').closest('li')!;
          fireEvent.click(option);

          expect(mockOnSelect).toHaveBeenCalledWith(ProductKind.Keg);
     });

     it('should not show error when shouldValidate is false and nothing selected', () => {
          render(<ProductKindSelect {...defaultProps} />);

          const label = screen.getAllByText('products.kind')[0];
          expect(label.className).not.toContain('Mui-error');
     });

     it('should show error when shouldValidate is true and nothing selected', () => {
          render(<ProductKindSelect {...defaultProps} shouldValidate />);

          const label = screen.getAllByText('products.kind')[0];
          expect(label.className).toContain('Mui-error');
     });

     it('should not show error when shouldValidate is true and kind is selected', () => {
          render(<ProductKindSelect {...defaultProps} shouldValidate selectedKind={ProductKind.Bottle} />);

          const label = screen.getAllByText('products.kind')[0];
          expect(label.className).not.toContain('Mui-error');
     });
});
