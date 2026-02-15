import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { ProductsView } from './products-view';
import { BreweryProductListItemDto } from '../../../api/Client';

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

const mockExecuteApiCallWithDefault = vi.fn();
const mockExecuteApiCall = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCallWithDefault: mockExecuteApiCallWithDefault,
        executeApiCall: mockExecuteApiCall,
    }),
}));

const mockFetchBreweryProducts = vi.fn();
const mockGetProductKindListEndpoint = vi.fn();
const mockDeleteProductEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        fetchBreweryProducts = mockFetchBreweryProducts;
        getProductKindListEndpoint = mockGetProductKindListEndpoint;
        deleteProductEndpoint = mockDeleteProductEndpoint;
    },
}));

const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({
        showSnackbar: mockShowSnackbar,
    }),
}));

vi.mock('../../../components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

vi.mock('../../../providers/currency-provider', () => ({
    useCurrency: () => ({
        formatPrice: (v: number | undefined) => (v !== undefined ? `${v} Kč` : ''),
    }),
}));

vi.mock('../detail-view/product-detail-view', () => ({
    ProductDetailView: ({
        id,
        onClose,
    }: {
        id: string | null;
        onClose: (reload: boolean) => void;
    }) => (
        <div data-testid="product-detail-view">
            <span data-testid="detail-id">{id ?? 'new'}</span>
            <button onClick={() => onClose(true)}>mock-save-close</button>
            <button onClick={() => onClose(false)}>mock-close</button>
        </div>
    ),
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

describe('ProductsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCallWithDefault.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockFetchBreweryProducts.mockResolvedValue(mockProducts);
        mockGetProductKindListEndpoint.mockResolvedValue(['Keg', 'Bottle', 'Can']);
    });

    // --- Title & new button ---

    it('should render the section header', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('products.title')).toBeInTheDocument();
        });
    });

    it('should render the new product button', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /products\.new/ })).toBeInTheDocument();
        });
    });

    // --- Fetch on mount ---

    it('should fetch products on mount', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(mockFetchBreweryProducts).toHaveBeenCalled();
        });
    });

    it('should fetch product kinds on mount', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(mockGetProductKindListEndpoint).toHaveBeenCalled();
        });
    });

    // --- Display products in table ---

    it('should display product rows in the table', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('Pilsner')).toBeInTheDocument();
            expect(screen.getByText('Lager')).toBeInTheDocument();
        });
    });

    // --- Empty state ---

    it('should show empty state when no products', async () => {
        mockFetchBreweryProducts.mockResolvedValue([]);

        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('table.noDataTitle')).toBeInTheDocument();
        });
    });

    // --- Table headers ---

    it('should render table column headers', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('products.name')).toBeInTheDocument();
            expect(screen.getByText('products.platoDegree')).toBeInTheDocument();
            expect(screen.getByText('products.kind')).toBeInTheDocument();
            expect(screen.getByText('products.packageSize')).toBeInTheDocument();
            expect(screen.getByText('products.priceVat')).toBeInTheDocument();
        });
    });

    // --- Kind tabs ---

    it('should render kind tabs', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('productKind.Keg')).toBeInTheDocument();
            expect(screen.getByText('productKind.Bottle')).toBeInTheDocument();
            expect(screen.getByText('productKind.Can')).toBeInTheDocument();
        });
    });

    it('should refetch products when kind tab changes', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('productKind.Bottle')).toBeInTheDocument();
        });

        mockFetchBreweryProducts.mockClear();
        fireEvent.click(screen.getByText('productKind.Bottle'));

        await waitFor(() => {
            expect(mockFetchBreweryProducts).toHaveBeenCalled();
        });
    });

    // --- Create drawer ---

    it('should open detail drawer when new button is clicked', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('Pilsner')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /products\.new/ }));

        await waitFor(() => {
            expect(screen.getByTestId('product-detail-view')).toBeInTheDocument();
            expect(screen.getByTestId('detail-id')).toHaveTextContent('new');
        });
    });

    // --- Delete dialog ---

    it('should open delete dialog when delete icon is clicked', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('Pilsner')).toBeInTheDocument();
        });

        // Click the first delete button (trash icon)
        const deleteButtons = screen
            .getAllByTestId('iconify')
            .filter((el: HTMLElement) => el.textContent === 'solar:trash-bin-trash-bold')
            .map((el: HTMLElement) => el.closest('button')!);
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('products.deleteConfirm')).toBeInTheDocument();
        });
    });

    it('should close delete dialog on cancel', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('Pilsner')).toBeInTheDocument();
        });

        const deleteButtons = screen
            .getAllByTestId('iconify')
            .filter((el: HTMLElement) => el.textContent === 'solar:trash-bin-trash-bold')
            .map((el: HTMLElement) => el.closest('button')!);
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('products.deleteConfirm')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

        await waitFor(() => {
            expect(screen.queryByText('products.deleteConfirm')).not.toBeInTheDocument();
        });
    });

    it('should delete product and show success snackbar', async () => {
        mockDeleteProductEndpoint.mockResolvedValue('ok');

        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('Pilsner')).toBeInTheDocument();
        });

        const deleteButtons = screen
            .getAllByTestId('iconify')
            .filter((el: HTMLElement) => el.textContent === 'solar:trash-bin-trash-bold')
            .map((el: HTMLElement) => el.closest('button')!);
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('products.deleteConfirm')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('product.deleteSuccess', 'success');
        });
    });

    // --- Pagination ---

    it('should render pagination', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByText('table.rowsPerPage')).toBeInTheDocument();
        });
    });

    // --- Filter toolbar ---

    it('should render the name filter toolbar', async () => {
        render(<ProductsView breweryId="b1" />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('products.name')).toBeInTheDocument();
        });
    });
});
