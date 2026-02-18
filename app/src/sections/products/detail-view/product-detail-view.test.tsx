import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { ProductDetailView } from './product-detail-view';
import { ProductDto, ProductKind, ProductType } from '../../../api/Client';

const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

const mockT = (key: string) => key;
vi.mock('react-i18next', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          useTranslation: () => ({ t: mockT }),
     };
});

vi.mock('minimal-shared/utils', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          varAlpha: () => 'rgba(0,0,0,0.16)',
     };
});

const mockExecuteApiCall = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
     useApiCall: () => ({
          executeApiCall: mockExecuteApiCall,
     }),
}));

const mockGetProductDetailEndpoint = vi.fn();
const mockGetProductTypeListEndpoint = vi.fn();
const mockGetProductKindListEndpoint = vi.fn();
const mockCreateProductsEndpoint = vi.fn();
const mockUpdateProductEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class MockAuthorizedClient {
          getProductDetailEndpoint = mockGetProductDetailEndpoint;
          getProductTypeListEndpoint = mockGetProductTypeListEndpoint;
          getProductKindListEndpoint = mockGetProductKindListEndpoint;
          createProductsEndpoint = mockCreateProductsEndpoint;
          updateProductEndpoint = mockUpdateProductEndpoint;
     },
}));

const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
     useSnackbar: () => ({
          showSnackbar: mockShowSnackbar,
     }),
}));

vi.mock('../../../providers/currency-provider', () => ({
     useCurrency: () => ({
          selectedCurrency: { currencyCode: 'CZK', rate: 1 },
          formatPriceValue: (v: number | undefined) => v,
          formatPriceToDefault: (v: number | undefined) => v ?? 0,
     }),
}));

// Mock child select components
vi.mock('./components/product-type-select', () => ({
     ProductTypeSelect: ({ onSelect, selectedType }: { onSelect: (t: unknown) => void; selectedType: unknown }) => (
          <div data-testid="product-type-select">
               <span data-testid="selected-type">{String(selectedType ?? 'none')}</span>
               <button onClick={() => onSelect(1)}>select-type</button>
          </div>
     ),
}));

vi.mock('./components/product-kind-select', () => ({
     ProductKindSelect: ({ onSelect, selectedKind }: { onSelect: (k: unknown) => void; selectedKind: unknown }) => (
          <div data-testid="product-kind-select">
               <span data-testid="selected-kind">{String(selectedKind ?? 'none')}</span>
               <button onClick={() => onSelect(1)}>select-kind</button>
          </div>
     ),
}));

const mockProduct = new ProductDto({
     id: 'p1',
     name: 'Pilsner Urquell',
     description: 'Classic Czech lager',
     kind: ProductKind.Keg,
     type: ProductType.PaleLager,
     alcoholPercentage: 4.4,
     platoDegree: 11.99,
     packageSize: 50,
     priceWithVat: 2500,
     priceForUnitWithVat: 50,
     priceForUnitWithoutVat: 41.32,
});

const mockOnClose = vi.fn();

describe('ProductDetailView', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
          mockGetProductDetailEndpoint.mockResolvedValue(mockProduct);
          mockGetProductTypeListEndpoint.mockResolvedValue([ProductType.PaleDraftBeer, ProductType.PaleLager]);
          mockGetProductKindListEndpoint.mockResolvedValue(['Keg', 'Bottle']);
     });

     // --- Rendering ---

     it('should render the detail title', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByText('products.detailTitle')).toBeInTheDocument();
          });
     });

     it('should fetch product detail when id is provided', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(mockGetProductDetailEndpoint).toHaveBeenCalledWith('p1');
          });
     });

     it('should not fetch product detail when id is null (create mode)', async () => {
          render(<ProductDetailView id={null} breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(mockGetProductTypeListEndpoint).toHaveBeenCalled();
          });

          expect(mockGetProductDetailEndpoint).not.toHaveBeenCalled();
     });

     it('should fetch product types and kinds on mount', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(mockGetProductTypeListEndpoint).toHaveBeenCalled();
               expect(mockGetProductKindListEndpoint).toHaveBeenCalled();
          });
     });

     it('should populate form fields with product data', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
          });

          expect(screen.getByDisplayValue('Classic Czech lager')).toBeInTheDocument();
     });

     it('should render type and kind selects', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByTestId('product-type-select')).toBeInTheDocument();
               expect(screen.getByTestId('product-kind-select')).toBeInTheDocument();
          });
     });

     // --- Form labels ---

     it('should render all form field labels', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
          });

          expect(screen.getAllByText('products.name').length).toBeGreaterThanOrEqual(1);
          expect(screen.getAllByText('products.platoDegree').length).toBeGreaterThanOrEqual(1);
          expect(screen.getAllByText('products.packageSize').length).toBeGreaterThanOrEqual(1);
          expect(screen.getAllByText('products.alcoholPercentage').length).toBeGreaterThanOrEqual(1);
          expect(screen.getAllByText('products.priceVat').length).toBeGreaterThanOrEqual(1);
          expect(screen.getAllByText('products.priceUnitVat').length).toBeGreaterThanOrEqual(1);
          expect(screen.getAllByText('products.priceUnitNoVat').length).toBeGreaterThanOrEqual(1);
          expect(screen.getAllByText('products.description').length).toBeGreaterThanOrEqual(1);
     });

     // --- Input changes ---

     it('should update product name on input change', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
          });

          fireEvent.change(screen.getByDisplayValue('Pilsner Urquell'), {
               target: { value: 'New Name' },
          });

          expect(screen.getByDisplayValue('New Name')).toBeInTheDocument();
     });

     // --- Close & Save ---

     it('should render close and save buttons', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
               expect(screen.getByRole('button', { name: 'common.saveAndClose' })).toBeInTheDocument();
          });
     });

     it('should call onClose(false) when close button is clicked', async () => {
          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
          });

          fireEvent.click(screen.getByRole('button', { name: 'common.close' }));

          expect(mockOnClose).toHaveBeenCalledWith(false);
     });

     // --- Validation ---

     it('should show validation error when saving without required fields', async () => {
          mockGetProductDetailEndpoint.mockResolvedValue(new ProductDto());

          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: 'common.saveAndClose' })).toBeInTheDocument();
          });

          fireEvent.click(screen.getByRole('button', { name: 'common.saveAndClose' }));

          await waitFor(() => {
               expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
          });
     });

     it('should show field error for empty name', async () => {
          mockGetProductDetailEndpoint.mockResolvedValue(new ProductDto());

          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: 'common.saveAndClose' })).toBeInTheDocument();
          });

          fireEvent.click(screen.getByRole('button', { name: 'common.saveAndClose' }));

          await waitFor(() => {
               expect(screen.getByText('common.required')).toBeInTheDocument();
          });
     });

     // --- Save success ---

     it('should call update API and show success when saving existing product', async () => {
          mockUpdateProductEndpoint.mockResolvedValue('ok');

          render(<ProductDetailView id="p1" breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByDisplayValue('Pilsner Urquell')).toBeInTheDocument();
          });

          fireEvent.click(screen.getByRole('button', { name: 'common.saveAndClose' }));

          await waitFor(() => {
               expect(mockShowSnackbar).toHaveBeenCalledWith('products.saveSuccess', 'success');
               expect(mockOnClose).toHaveBeenCalledWith(true);
          });
     });

     it('should call create API when saving new product', async () => {
          mockCreateProductsEndpoint.mockResolvedValue('ok');

          render(<ProductDetailView id={null} breweryId="b1" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: 'common.saveAndClose' })).toBeInTheDocument();
          });

          // Fill required fields
          const nameInput = screen.getByLabelText('products.name');
          fireEvent.change(nameInput, { target: { value: 'New Product' } });

          const priceInput = screen.getByLabelText('products.priceVat');
          fireEvent.change(priceInput, { target: { value: '100' } });

          fireEvent.click(screen.getByRole('button', { name: 'common.saveAndClose' }));

          await waitFor(() => {
               expect(mockCreateProductsEndpoint).toHaveBeenCalled();
               expect(mockShowSnackbar).toHaveBeenCalledWith('products.saveSuccess', 'success');
          });
     });
});
