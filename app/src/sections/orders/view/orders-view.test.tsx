import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { OrdersView } from './orders-view';
import { PlanningState, OrderListItemDto } from '../../../api/Client';

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

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          useParams: () => ({}),
          useNavigate: () => mockNavigate,
          useBlocker: () => ({ state: 'idle' }),
     };
});

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
const mockFetchOrders = vi.fn();
const mockGetOrderDetailEndpoint = vi.fn();
const mockDeleteOrderEndpoint = vi.fn();
const mockUpdateOrderEndpoint = vi.fn();
const mockCreateOrderEndpoint = vi.fn();
const mockFetchProductsWithClientHistory = vi.fn();
const mockFetchClients = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class MockAuthorizedClient {
          fetchOrders = mockFetchOrders;
          getOrderDetailEndpoint = mockGetOrderDetailEndpoint;
          deleteOrderEndpoint = mockDeleteOrderEndpoint;
          updateOrderEndpoint = mockUpdateOrderEndpoint;
          createOrderEndpoint = mockCreateOrderEndpoint;
          fetchProductsWithClientHistory = mockFetchProductsWithClientHistory;
          fetchClients = mockFetchClients;
     },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
     useSnackbar: () => ({
          showSnackbar: mockShowSnackbar,
     }),
}));

// Mock minimal-shared/utils (partial)
vi.mock('minimal-shared/utils', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          varAlpha: () => 'rgba(0,0,0,0.16)',
     };
});

// Mock heavy child components
vi.mock('../detail-view/order-detail-view', () => ({
     OrderDetailView: ({ id }: { id?: string }) => <div data-testid="order-detail-view">{id ?? 'no-id'}</div>,
}));

vi.mock('../detail-view/create-order-view', () => ({
     CreateOrderView: ({ onClose, onSave }: { onClose: () => void; onSave: (id: string) => void }) => (
          <div data-testid="create-order-view">
               <button onClick={onClose}>mock-close</button>
               <button onClick={() => onSave('new-order-id')}>mock-save</button>
          </div>
     ),
}));

// PlanningStateTab lives at ../components/planning-state-tab
vi.mock('../components/planning-state-tab', () => ({
     PlanningStateTab: ({ onPlanningStateChange }: { onPlanningStateChange: (state: number) => void }) => (
          <div data-testid="planning-state-tab">
               <button onClick={() => onPlanningStateChange(0)}>PlanningState.Active</button>
               <button onClick={() => onPlanningStateChange(1)}>PlanningState.Finished</button>
               <button onClick={() => onPlanningStateChange(2)}>PlanningState.Cancelled</button>
          </div>
     ),
}));

// --- Test data ---
const mockOrders: OrderListItemDto[] = [
     new OrderListItemDto({
          id: 'order-1',
          clientName: 'Test Client A',
          requiredDeliveryDate: new Date('2026-03-15'),
          planningState: PlanningState.Active,
     }),
     new OrderListItemDto({
          id: 'order-2',
          clientName: 'Test Client B',
          requiredDeliveryDate: new Date('2026-03-20'),
          planningState: PlanningState.Active,
     }),
];

describe('OrdersView', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mockExecuteApiCallWithDefault.mockImplementation((fn: () => Promise<unknown>) => fn());
          mockFetchOrders.mockResolvedValue(mockOrders);
     });

     // --- Title & new button ---

     it('should render the page title', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByText('orders.title')).toBeInTheDocument();
          });
     });

     it('should render the new order button', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: 'orders.new' })).toBeInTheDocument();
          });
     });

     // --- Fetch on mount ---

     it('should fetch orders on mount', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(mockFetchOrders).toHaveBeenCalled();
          });
     });

     it('should navigate to the first order when no orderId param', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(mockNavigate).toHaveBeenCalledWith('/orders/order-1', { replace: true });
          });
     });

     // --- Display orders in table ---

     it('should display order rows in the table', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByText('Test Client A')).toBeInTheDocument();
               expect(screen.getByText('Test Client B')).toBeInTheDocument();
          });
     });

     // --- Empty state ---

     it('should show empty state when no orders', async () => {
          mockFetchOrders.mockResolvedValue([]);

          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByText('table.noDataTitle')).toBeInTheDocument();
          });
     });

     // --- Create drawer ---

     it('should open create drawer when new button is clicked', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByText('Test Client A')).toBeInTheDocument();
          });

          fireEvent.click(screen.getByRole('button', { name: 'orders.new' }));

          await waitFor(() => {
               expect(screen.getByTestId('create-order-view')).toBeInTheDocument();
          });
     });

     // --- Planning state tabs ---

     it('should render planning state tabs', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByText('PlanningState.Active')).toBeInTheDocument();
               expect(screen.getByText('PlanningState.Finished')).toBeInTheDocument();
               expect(screen.getByText('PlanningState.Cancelled')).toBeInTheDocument();
          });
     });

     // --- Filter toolbar ---

     it('should render the client name filter', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByPlaceholderText('orders.clientName...')).toBeInTheDocument();
          });
     });

     it('should refetch orders when filter changes', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(mockFetchOrders).toHaveBeenCalledTimes(1);
          });

          fireEvent.change(screen.getByPlaceholderText('orders.clientName...'), {
               target: { value: 'Test' },
          });

          await waitFor(() => {
               expect(mockFetchOrders).toHaveBeenCalledTimes(2);
          });
     });

     // --- Detail view rendering ---

     it('should render order detail view component', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByTestId('order-detail-view')).toBeInTheDocument();
          });
     });

     // --- Table headers ---

     it('should render table column headers', async () => {
          render(<OrdersView />);

          await waitFor(() => {
               expect(screen.getByText('orders.clientName')).toBeInTheDocument();
               expect(screen.getByText('orders.requiredDeliveryDate')).toBeInTheDocument();
          });
     });
});
