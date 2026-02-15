import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { ProductDeliveriesView } from './product-deliveries-view';
import {
    DriverInfoDto,
    VehicleInfoDto,
    BreweryInfoDto,
    ProductDeliveryDto,
    ProductDeliveryState,
    ProductDeliveryStopDto,
    ProductDeliveryItemDto,
    ProductDeliveryListItemDto,
} from '../../../api/Client';

// CSS variables theme matching app config
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference
const mockT = (key: string) => key;

vi.mock('react-i18next', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useTranslation: () => ({ t: mockT }),
    };
});

// Mock minimal-shared/utils
vi.mock('minimal-shared/utils', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        varAlpha: () => 'rgba(0,0,0,0.16)',
    };
});

// Mock Iconify so icon names are visible as text
vi.mock('../../../components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

// Mock useApiCall
const mockExecuteApiCallWithDefault = vi.fn();
const mockExecuteApiCall = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCallWithDefault: mockExecuteApiCallWithDefault,
        executeApiCall: mockExecuteApiCall,
    }),
}));

// Mock AuthorizedClient
const mockFetchProductDeliveries = vi.fn();
const mockGetProductDeliveryDetailEndpoint = vi.fn();
const mockDeleteProductDeliveryEndpoint = vi.fn();
const mockUpdateProductDeliveryEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        fetchProductDeliveries = mockFetchProductDeliveries;
        getProductDeliveryDetailEndpoint = mockGetProductDeliveryDetailEndpoint;
        deleteProductDeliveryEndpoint = mockDeleteProductDeliveryEndpoint;
        updateProductDeliveryEndpoint = mockUpdateProductDeliveryEndpoint;
    },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({
        showSnackbar: mockShowSnackbar,
    }),
}));

// Mock heavy child components
vi.mock('../detail-view/product-delivery-detail-view', () => ({
    ProductDeliveryDetailView: ({
        delivery,
        onDeliveryChange,
    }: {
        delivery: Record<string, unknown> | undefined;
        onDeliveryChange: (d: unknown) => void;
    }) => (
        <div data-testid="product-delivery-detail-view">
            {delivery ? 'has-delivery' : 'no-delivery'}
            <button
                data-testid="mock-change-delivery"
                onClick={() =>
                    onDeliveryChange({ ...delivery, note: 'changed' })
                }
            >
                change
            </button>
        </div>
    ),
}));

vi.mock('../detail-view/create-product-delivery-view', () => ({
    CreateProductDeliveryView: ({
        onClose,
        onSave,
    }: {
        onClose: () => void;
        onSave: (id: string) => void;
    }) => (
        <div data-testid="create-product-delivery-view">
            <button onClick={onClose}>mock-close</button>
            <button onClick={() => onSave('new-delivery-id')}>mock-save</button>
        </div>
    ),
}));

vi.mock('../components/product-delivery-select', () => ({
    ProductDeliverySelect: ({
        deliveries,
        selectedDeliveryId,
        onSelect,
    }: {
        deliveries: ProductDeliveryListItemDto[];
        selectedDeliveryId: string | undefined;
        onSelect: (id: string) => void;
    }) => (
        <div data-testid="product-delivery-select">
            <span data-testid="selected-id">{selectedDeliveryId ?? 'none'}</span>
            {deliveries.map((d) => (
                <button key={d.id} onClick={() => onSelect(d.id!)}>
                    {d.stopNames?.join(', ') ?? d.id}
                </button>
            ))}
        </div>
    ),
}));

// --- Test data ---

const mockDeliveries: ProductDeliveryListItemDto[] = [
    new ProductDeliveryListItemDto({
        id: 'del-1',
        deliveryDate: new Date('2026-03-15'),
        state: ProductDeliveryState.InPlanning,
        stopNames: ['Brewery A', 'Brewery B'],
    }),
    new ProductDeliveryListItemDto({
        id: 'del-2',
        deliveryDate: new Date('2026-03-20'),
        state: ProductDeliveryState.OnTheWay,
        stopNames: ['Brewery C'],
    }),
];

const mockDeliveryDetail = new ProductDeliveryDto({
    id: 'del-1',
    deliveryDate: new Date('2026-03-15'),
    state: ProductDeliveryState.InPlanning,
    vehicle: new VehicleInfoDto({ id: 'v1', name: 'Truck 1' }),
    drivers: [new DriverInfoDto({ id: 'd1', firstName: 'John', lastName: 'Doe' })],
    note: 'Test note',
    stops: [
        new ProductDeliveryStopDto({
            id: 'stop-1',
            brewery: new BreweryInfoDto({ id: 'b1', name: 'Brewery A' }),
            note: 'Stop note',
            products: [
                new ProductDeliveryItemDto({
                    productId: 'p1',
                    name: 'Pilsner',
                    quantity: 10,
                }),
            ],
        }),
    ],
});

describe('ProductDeliveriesView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCallWithDefault.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockFetchProductDeliveries.mockResolvedValue(mockDeliveries);
        mockGetProductDeliveryDetailEndpoint.mockResolvedValue(mockDeliveryDetail);
    });

    // --- Title & new button ---

    it('should render the page title', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.title')).toBeInTheDocument();
        });
    });

    it('should render the new delivery button', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /productDeliveries\.new/ })
            ).toBeInTheDocument();
        });
    });

    // --- Fetch on mount ---

    it('should fetch deliveries on mount', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(mockFetchProductDeliveries).toHaveBeenCalled();
        });
    });

    it('should select the first delivery on mount', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('selected-id')).toHaveTextContent('del-1');
        });
    });

    it('should fetch delivery detail for the first delivery on mount', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(mockGetProductDeliveryDetailEndpoint).toHaveBeenCalledWith('del-1');
        });
    });

    // --- Delivery select ---

    it('should render delivery select with deliveries', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('product-delivery-select')).toBeInTheDocument();
            expect(screen.getByText('Brewery A, Brewery B')).toBeInTheDocument();
            expect(screen.getByText('Brewery C')).toBeInTheDocument();
        });
    });

    it('should select a different delivery when clicked', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('Brewery C')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Brewery C'));

        await waitFor(() => {
            expect(screen.getByTestId('selected-id')).toHaveTextContent('del-2');
        });
    });

    // --- Detail view ---

    it('should render the product delivery detail view', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('product-delivery-detail-view')).toBeInTheDocument();
            expect(screen.getByTestId('product-delivery-detail-view')).toHaveTextContent(
                'has-delivery'
            );
        });
    });

    it('should render the detail section header', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.detailTitle')).toBeInTheDocument();
        });
    });

    // --- Loading state ---

    it('should show loading indicator initially', () => {
        // Make fetchProductDeliveries hang so loading stays true
        mockFetchProductDeliveries.mockReturnValue(new Promise(() => { }));

        render(<ProductDeliveriesView />);

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should hide loading indicator after deliveries load', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });
    });

    // --- Empty state ---

    it('should handle empty deliveries list', async () => {
        mockFetchProductDeliveries.mockResolvedValue([]);

        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('selected-id')).toHaveTextContent('none');
        });
    });

    // --- Create drawer ---

    it('should open create drawer when new button is clicked', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('Brewery A, Brewery B')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /productDeliveries\.new/ }));

        await waitFor(() => {
            expect(screen.getByTestId('create-product-delivery-view')).toBeInTheDocument();
        });
    });

    it('should close create drawer and reload deliveries on close', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('Brewery A, Brewery B')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /productDeliveries\.new/ }));

        await waitFor(() => {
            expect(screen.getByTestId('create-product-delivery-view')).toBeInTheDocument();
        });

        mockFetchProductDeliveries.mockClear();
        fireEvent.click(screen.getByText('mock-close'));

        await waitFor(() => {
            expect(mockFetchProductDeliveries).toHaveBeenCalled();
        });
    });

    it('should select newly created delivery after save', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('Brewery A, Brewery B')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /productDeliveries\.new/ }));

        await waitFor(() => {
            expect(screen.getByTestId('create-product-delivery-view')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('mock-save'));

        await waitFor(() => {
            expect(screen.getByTestId('selected-id')).toHaveTextContent('new-delivery-id');
        });
    });

    // --- Delete confirmation dialog ---

    it('should open delete confirmation dialog when delete icon clicked', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.detailTitle')).toBeInTheDocument();
        });

        // Click the delete icon button (trash icon in the section header area)
        const deleteButtons = screen
            .getAllByText('solar:trash-bin-trash-bold')
            .map((el) => el.closest('button')!);
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.deleteConfirm')).toBeInTheDocument();
        });
    });

    it('should close delete dialog on cancel', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.detailTitle')).toBeInTheDocument();
        });

        const deleteButtons = screen
            .getAllByText('solar:trash-bin-trash-bold')
            .map((el) => el.closest('button')!);
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.deleteConfirm')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

        await waitFor(() => {
            expect(screen.queryByText('productDeliveries.deleteConfirm')).not.toBeInTheDocument();
        });
    });

    it('should delete delivery and select the next one', async () => {
        mockDeleteProductDeliveryEndpoint.mockResolvedValue('ok');

        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.detailTitle')).toBeInTheDocument();
        });

        const deleteButtons = screen
            .getAllByText('solar:trash-bin-trash-bold')
            .map((el) => el.closest('button')!);
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.deleteConfirm')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith(
                'productDeliveries.deliveryDeleted',
                'success'
            );
            expect(screen.getByTestId('selected-id')).toHaveTextContent('del-2');
        });
    });

    // --- Reset confirmation dialog ---

    it('should open reset confirmation dialog when reset icon clicked with changes', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-change-delivery')).toBeInTheDocument();
        });

        // Make a change so hasDetailChanges becomes true
        fireEvent.click(screen.getByTestId('mock-change-delivery'));

        // Click reset button
        const resetButton = screen.getByText('solar:restart-bold').closest('button')!;
        fireEvent.click(resetButton);

        await waitFor(() => {
            expect(screen.getByText('common.resetConfirm')).toBeInTheDocument();
        });
    });

    it('should reset delivery to initial state on reset confirm', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-change-delivery')).toBeInTheDocument();
        });

        // Make a change
        fireEvent.click(screen.getByTestId('mock-change-delivery'));

        // Click reset
        const resetButton = screen.getByText('solar:restart-bold').closest('button')!;
        fireEvent.click(resetButton);

        await waitFor(() => {
            expect(screen.getByText('common.resetConfirm')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'common.reset' }));

        await waitFor(() => {
            expect(screen.queryByText('common.resetConfirm')).not.toBeInTheDocument();
        });
    });

    // --- Save button ---

    it('should disable save button when no changes', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.detailTitle')).toBeInTheDocument();
        });

        const saveButton = screen.getByText('solar:floppy-disk-bold').closest('button')!;
        expect(saveButton).toBeDisabled();
    });

    it('should enable save button when there are changes', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-change-delivery')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('mock-change-delivery'));

        const saveButton = screen.getByText('solar:floppy-disk-bold').closest('button')!;
        expect(saveButton).not.toBeDisabled();
    });

    it('should disable reset button when no changes', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByText('productDeliveries.detailTitle')).toBeInTheDocument();
        });

        const resetButton = screen.getByText('solar:restart-bold').closest('button')!;
        expect(resetButton).toBeDisabled();
    });

    // --- Pending changes dialog ---

    it('should show pending changes dialog when switching delivery with unsaved changes', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-change-delivery')).toBeInTheDocument();
        });

        // Make a change
        fireEvent.click(screen.getByTestId('mock-change-delivery'));

        // Try to switch delivery
        fireEvent.click(screen.getByText('Brewery C'));

        await waitFor(() => {
            expect(screen.getByText('common.pendingChangesConfirm')).toBeInTheDocument();
        });
    });

    it('should discard changes and switch delivery on discard', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-change-delivery')).toBeInTheDocument();
        });

        // Make a change
        fireEvent.click(screen.getByTestId('mock-change-delivery'));

        // Try to switch delivery
        fireEvent.click(screen.getByText('Brewery C'));

        await waitFor(() => {
            expect(screen.getByText('common.pendingChangesConfirm')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'common.discard' }));

        await waitFor(() => {
            expect(screen.getByTestId('selected-id')).toHaveTextContent('del-2');
        });
    });

    it('should show pending changes dialog when clicking new with unsaved changes', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-change-delivery')).toBeInTheDocument();
        });

        // Make a change
        fireEvent.click(screen.getByTestId('mock-change-delivery'));

        // Click new delivery button
        fireEvent.click(screen.getByRole('button', { name: /productDeliveries\.new/ }));

        await waitFor(() => {
            expect(screen.getByText('common.pendingChangesConfirm')).toBeInTheDocument();
        });
    });

    it('should open create drawer after discarding pending changes for new delivery', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-change-delivery')).toBeInTheDocument();
        });

        // Make a change
        fireEvent.click(screen.getByTestId('mock-change-delivery'));

        // Click new delivery button
        fireEvent.click(screen.getByRole('button', { name: /productDeliveries\.new/ }));

        await waitFor(() => {
            expect(screen.getByText('common.pendingChangesConfirm')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'common.discard' }));

        await waitFor(() => {
            expect(screen.getByTestId('create-product-delivery-view')).toBeInTheDocument();
        });
    });

    it('should not switch delivery when clicking the same delivery', async () => {
        render(<ProductDeliveriesView />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-change-delivery')).toBeInTheDocument();
        });

        // Make a change
        fireEvent.click(screen.getByTestId('mock-change-delivery'));

        // Click the already-selected delivery
        fireEvent.click(screen.getByText('Brewery A, Brewery B'));

        // Should not show pending changes dialog since it's the same delivery
        expect(screen.queryByText('common.pendingChangesConfirm')).not.toBeInTheDocument();
    });
});
