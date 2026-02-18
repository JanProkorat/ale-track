import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { OutgoingShipmentsView } from './outgoing-shipments-view';
import {
     OutgoingShipmentState,
     OutgoingShipmentStopDto,
     OutgoingShipmentDetailDto,
     OutgoingShipmentListItemDto,
     OutgoingShipmentStopAddressKind,
} from '../../../api/Client';

import type { UpdateOutgoingShipmentDto } from '../../../api/Client';

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

// Mock react-router-dom
vi.mock('react-router-dom', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          useBlocker: () => ({ state: 'idle' }),
     };
});

// Mock Iconify
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
const mockFetchOutgoingShipments = vi.fn();
const mockGetOutgoingShipmentDetailEndpoint = vi.fn();
const mockDeleteOutgoingShipmentEndpoint = vi.fn();
const mockUpdateOutgoingShipmentEndpoint = vi.fn();
const mockFetOrdersForOutgoingShipments = vi.fn();
const mockFetchDrivers = vi.fn();
const mockFetchVehicles = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class MockAuthorizedClient {
          fetchOutgoingShipments = mockFetchOutgoingShipments;
          getOutgoingShipmentDetailEndpoint = mockGetOutgoingShipmentDetailEndpoint;
          deleteOutgoingShipmentEndpoint = mockDeleteOutgoingShipmentEndpoint;
          updateOutgoingShipmentEndpoint = mockUpdateOutgoingShipmentEndpoint;
          fetOrdersForOutgoingShipments = mockFetOrdersForOutgoingShipments;
          fetchDrivers = mockFetchDrivers;
          fetchVehicles = mockFetchVehicles;
     },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
     useSnackbar: () => ({
          showSnackbar: mockShowSnackbar,
     }),
}));

// Mock DashboardContent
vi.mock('../../../layouts/dashboard', () => ({
     DashboardContent: ({ children }: { children: React.ReactNode }) => (
          <div data-testid="dashboard-content">{children}</div>
     ),
}));

// Mock SectionHeader
vi.mock('../../../components/label/section-header', () => ({
     SectionHeader: ({ text, children }: { text: string; children: React.ReactNode }) => (
          <div data-testid="section-header">
               <span>{text}</span>
               {children}
          </div>
     ),
}));

// Mock heavy child components
vi.mock('../detail-view/outgoing-shipment-detail-view', () => ({
     OutgoingShipmentDetailView: ({
          shipment,
          onChange,
     }: {
          shipment: UpdateOutgoingShipmentDto | undefined;
          onChange: (s: unknown) => void;
     }) => (
          <div data-testid="outgoing-shipment-detail-view">
               {shipment ? 'has-shipment' : 'no-shipment'}
               <button data-testid="mock-change-shipment" onClick={() => onChange({ ...shipment, name: 'changed' })}>
                    change
               </button>
          </div>
     ),
}));

vi.mock('../detail-view/create-outgoing-shipment-view', () => ({
     CreateOutgoingShipmentView: ({ onClose, onSave }: { onClose: () => void; onSave: (id: string) => void }) => (
          <div data-testid="create-outgoing-shipment-view">
               <button onClick={onClose}>mock-close</button>
               <button onClick={() => onSave('new-shipment-id')}>mock-save</button>
          </div>
     ),
}));

vi.mock('../components/outgoing-shipment-select', () => ({
     OutgoingShipmentSelect: ({
          shipments,
          selectedShipmentId,
          onSelect,
     }: {
          shipments: OutgoingShipmentListItemDto[];
          selectedShipmentId: string | undefined;
          onSelect: (id: string) => void;
     }) => (
          <div data-testid="outgoing-shipment-select">
               <span data-testid="selected-id">{selectedShipmentId ?? 'none'}</span>
               {shipments.map((s) => (
                    <button key={s.id} onClick={() => onSelect(s.id!)}>
                         {s.name ?? s.id}
                    </button>
               ))}
          </div>
     ),
}));

// Mock dialogs
vi.mock('src/components/dialogs/delete-confirmation-dialog', () => ({
     DeleteConfirmationDialog: ({ open, onDelete }: { open: boolean; onDelete: () => void }) =>
          open ? (
               <div data-testid="delete-dialog">
                    <button onClick={onDelete}>confirm-delete</button>
               </div>
          ) : null,
}));

vi.mock('src/components/dialogs/reset-confirmation-dialog', () => ({
     ResetConfirmationDialog: ({ open, onReset }: { open: boolean; onReset: () => void }) =>
          open ? (
               <div data-testid="reset-dialog">
                    <button onClick={onReset}>confirm-reset</button>
               </div>
          ) : null,
}));

vi.mock('src/components/dialogs/pending-changes-confirmation-dialog', () => ({
     PendingChangesConfirmationDialog: ({
          open,
          onSave,
          onDiscard,
     }: {
          open: boolean;
          onSave: () => void;
          onDiscard: () => void;
     }) =>
          open ? (
               <div data-testid="pending-changes-dialog">
                    <button onClick={onSave}>save-changes</button>
                    <button onClick={onDiscard}>discard-changes</button>
               </div>
          ) : null,
}));

// --- Test data ---

const mockShipments: OutgoingShipmentListItemDto[] = [
     new OutgoingShipmentListItemDto({
          id: 'ship-1',
          name: 'Shipment Alpha',
          deliveryDate: new Date('2026-03-15'),
          state: OutgoingShipmentState.Created,
     }),
     new OutgoingShipmentListItemDto({
          id: 'ship-2',
          name: 'Shipment Beta',
          deliveryDate: new Date('2026-03-20'),
          state: OutgoingShipmentState.Loaded,
     }),
];

const mockShipmentDetail = new OutgoingShipmentDetailDto({
     id: 'ship-1',
     name: 'Shipment Alpha',
     deliveryDate: new Date('2026-03-15'),
     state: OutgoingShipmentState.Created,
     vehicleId: 'v1',
     driverIds: ['d1'],
     stops: [
          new OutgoingShipmentStopDto({
               order: 1,
               orderId: 'order-1',
               selectedAddressKind: OutgoingShipmentStopAddressKind.Official,
          }),
     ],
});

// --- Tests ---

describe('OutgoingShipmentsView', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mockExecuteApiCallWithDefault.mockImplementation((fn: () => Promise<unknown>) => fn());
          mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
          mockFetchOutgoingShipments.mockResolvedValue(mockShipments);
          mockGetOutgoingShipmentDetailEndpoint.mockResolvedValue(mockShipmentDetail);
          mockFetOrdersForOutgoingShipments.mockResolvedValue([]);
          mockFetchDrivers.mockResolvedValue([]);
          mockFetchVehicles.mockResolvedValue([]);
     });

     it('renders the page title', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(screen.getByText('outgoingShipments.title')).toBeInTheDocument();
          });
     });

     it('renders the new shipment button', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: /outgoingShipments\.new/ })).toBeInTheDocument();
          });
     });

     it('fetches shipments on mount', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(mockFetchOutgoingShipments).toHaveBeenCalled();
          });
     });

     it('selects the first shipment on mount', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(screen.getByTestId('selected-id')).toHaveTextContent('ship-1');
          });
     });

     it('fetches shipment detail for the first shipment on mount', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(mockGetOutgoingShipmentDetailEndpoint).toHaveBeenCalledWith('ship-1');
          });
     });

     it('renders detail view when a shipment is selected', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(screen.getByTestId('outgoing-shipment-detail-view')).toHaveTextContent('has-shipment');
          });
     });

     it('shows empty state message when no shipments', async () => {
          mockFetchOutgoingShipments.mockResolvedValue([]);

          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(screen.getByText('outgoingShipments.noShipmentsToDisplay')).toBeInTheDocument();
          });
     });

     it('loads detail when selecting a different shipment', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(screen.getByText('Shipment Beta')).toBeInTheDocument();
          });

          fireEvent.click(screen.getByText('Shipment Beta'));

          await waitFor(() => {
               expect(screen.getByTestId('selected-id')).toHaveTextContent('ship-2');
          });
     });

     it('opens create drawer when new button is clicked', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: /outgoingShipments\.new/ })).toBeInTheDocument();
          });

          fireEvent.click(screen.getByRole('button', { name: /outgoingShipments\.new/ }));

          await waitFor(() => {
               expect(screen.getByTestId('create-outgoing-shipment-view')).toBeInTheDocument();
          });
     });

     it('fetches drivers and vehicles on mount', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(mockFetchDrivers).toHaveBeenCalled();
               expect(mockFetchVehicles).toHaveBeenCalled();
          });
     });

     it('fetches orders for the selected shipment', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(mockFetOrdersForOutgoingShipments).toHaveBeenCalledWith('ship-1', {});
          });
     });

     it('handles shipment creation from create drawer', async () => {
          render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: /outgoingShipments\.new/ })).toBeInTheDocument();
          });

          // Open create drawer
          fireEvent.click(screen.getByRole('button', { name: /outgoingShipments\.new/ }));

          await waitFor(() => {
               expect(screen.getByTestId('create-outgoing-shipment-view')).toBeInTheDocument();
          });

          // Click mock save
          fireEvent.click(screen.getByText('mock-save'));

          await waitFor(() => {
               expect(screen.getByTestId('selected-id')).toHaveTextContent('new-shipment-id');
          });
     });

     it('shows loading indicator during initial load', async () => {
          // Make the fetch never resolve to keep loading state
          mockFetchOutgoingShipments.mockReturnValue(new Promise(() => {}));

          const { container } = render(<OutgoingShipmentsView />);

          await waitFor(() => {
               expect(container.querySelector('[role="progressbar"]')).toBeInTheDocument();
          });
     });
});
