import { it, vi, expect, describe, beforeEach } from 'vitest';

import { BreweryProductListItemDto } from 'src/api/Client';
import { screen, render, fireEvent } from 'src/test/test-utils';

import { ProductsTableRow } from './products-table-row';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../components/iconify', () => ({
     Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

vi.mock('../../providers/currency-provider', () => ({
     useCurrency: () => ({
          formatPrice: (value: number | undefined) => (value !== undefined ? `${value} Kč` : ''),
     }),
}));

const mockRow = new BreweryProductListItemDto({
     id: 'p1',
     name: 'Pilsner',
     kind: 1 as any,
     type: 0 as any,
     packageSize: 0.5,
     weight: 10,
     alcoholPercentage: 4.5,
     platoDegree: 12,
     priceWithVat: 50,
     priceForUnitWithVat: 100,
     priceForUnitWithoutVat: 83,
});

const mockOnSelectRow = vi.fn();
const mockOnRowClick = vi.fn();
const mockOnDeleteClick = vi.fn();

const renderInTable = (ui: React.ReactElement) =>
     render(
          <table>
               <tbody>{ui}</tbody>
          </table>
     );

describe('ProductsTableRow', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render product name', () => {
          renderInTable(
               <ProductsTableRow
                    row={mockRow}
                    selected={false}
                    onSelectRow={mockOnSelectRow}
                    onRowClick={mockOnRowClick}
                    onDeleteClick={mockOnDeleteClick}
               />
          );

          expect(screen.getByText('Pilsner')).toBeInTheDocument();
     });

     it('should render product details', () => {
          renderInTable(
               <ProductsTableRow
                    row={mockRow}
                    selected={false}
                    onSelectRow={mockOnSelectRow}
                    onRowClick={mockOnRowClick}
                    onDeleteClick={mockOnDeleteClick}
               />
          );

          expect(screen.getByText('0.5 L')).toBeInTheDocument();
          expect(screen.getByText('10 Kg')).toBeInTheDocument();
          expect(screen.getByText('4.5%')).toBeInTheDocument();
          expect(screen.getByText('12%')).toBeInTheDocument();
          expect(screen.getByText('productKind.1')).toBeInTheDocument();
          expect(screen.getByText('productType.0')).toBeInTheDocument();
     });

     it('should render formatted prices', () => {
          renderInTable(
               <ProductsTableRow
                    row={mockRow}
                    selected={false}
                    onSelectRow={mockOnSelectRow}
                    onRowClick={mockOnRowClick}
                    onDeleteClick={mockOnDeleteClick}
               />
          );

          expect(screen.getByText('50 Kč')).toBeInTheDocument();
          expect(screen.getByText('100 Kč')).toBeInTheDocument();
          expect(screen.getByText('83 Kč')).toBeInTheDocument();
     });

     it('should show checkbox checked when selected', () => {
          const { container } = renderInTable(
               <ProductsTableRow
                    row={mockRow}
                    selected
                    onSelectRow={mockOnSelectRow}
                    onRowClick={mockOnRowClick}
                    onDeleteClick={mockOnDeleteClick}
               />
          );

          const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
          expect(checkbox.checked).toBe(true);
     });

     it('should call onSelectRow when checkbox is clicked', () => {
          const { container } = renderInTable(
               <ProductsTableRow
                    row={mockRow}
                    selected={false}
                    onSelectRow={mockOnSelectRow}
                    onRowClick={mockOnRowClick}
                    onDeleteClick={mockOnDeleteClick}
               />
          );

          const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
          fireEvent.click(checkbox);

          expect(mockOnSelectRow).toHaveBeenCalled();
     });

     it('should call onRowClick when name cell is clicked', () => {
          renderInTable(
               <ProductsTableRow
                    row={mockRow}
                    selected={false}
                    onSelectRow={mockOnSelectRow}
                    onRowClick={mockOnRowClick}
                    onDeleteClick={mockOnDeleteClick}
               />
          );

          screen.getByText('Pilsner').click();
          expect(mockOnRowClick).toHaveBeenCalled();
     });

     it('should call onDeleteClick when delete button is clicked', () => {
          renderInTable(
               <ProductsTableRow
                    row={mockRow}
                    selected={false}
                    onSelectRow={mockOnSelectRow}
                    onRowClick={mockOnRowClick}
                    onDeleteClick={mockOnDeleteClick}
               />
          );

          const deleteButton = screen.getByRole('button');
          deleteButton.click();
          expect(mockOnDeleteClick).toHaveBeenCalled();
     });
});
