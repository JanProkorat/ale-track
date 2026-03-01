import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { CreateOutgoingShipmentView } from './create-outgoing-shipment-view';

import type { DriverDto, VehicleDto } from '../../../api/Client';

// CSS variables theme
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
const mockFetOrdersForOutgoingShipments = vi.fn();
const mockCreateOutgoingShipmentEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class MockAuthorizedClient {
          fetOrdersForOutgoingShipments = mockFetOrdersForOutgoingShipments;
          createOutgoingShipmentEndpoint = mockCreateOutgoingShipmentEndpoint;
     },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
     useSnackbar: () => ({
          showSnackbar: mockShowSnackbar,
     }),
}));

// Mock DrawerLayout
vi.mock('../../../layouts/components/drawer-layout', () => ({
     DrawerLayout: ({
          title,
          children,
          onClose,
          onSaveAndClose,
     }: {
          title: string;
          children: React.ReactNode;
          onClose: () => void;
          onSaveAndClose: () => void;
     }) => (
          <div data-testid="drawer-layout">
               <span data-testid="drawer-title">{title}</span>
               <button data-testid="drawer-close" onClick={onClose}>
                    close
               </button>
               <button data-testid="drawer-save" onClick={onSaveAndClose}>
                    save
               </button>
               {children}
          </div>
     ),
}));

// Mock child components
vi.mock('../components/shipment-delivery-date-picker', () => ({
     ShipmentDeliveryDatePicker: ({ onDatePicked }: { onDatePicked: (d: Date | null) => void }) => (
          <div data-testid="shipment-date-picker">
               <button onClick={() => onDatePicked(new Date('2026-04-01'))}>set-date</button>
          </div>
     ),
}));

vi.mock('../components/shipment-drivers-select', () => ({
     ShipmentDriversSelect: ({ onSelect }: { onSelect: (ids: string[]) => void }) => (
          <div data-testid="shipment-drivers-select">
               <button onClick={() => onSelect(['d1'])}>set-drivers</button>
          </div>
     ),
}));

vi.mock('../components/shipment-vehicle-select', () => ({
     ShipmentVehicleSelect: ({ onSelect }: { onSelect: (id: string | undefined, w: number | undefined) => void }) => (
          <div data-testid="shipment-vehicle-select">
               <button onClick={() => onSelect('v1', 3000)}>set-vehicle</button>
          </div>
     ),
}));

vi.mock('../components/shipment-name-input', () => ({
     ShipmentNameInput: ({
          shipmentName,
          onNameChange,
     }: {
          shipmentName: string;
          onNameChange: (n: string) => void;
     }) => (
          <div data-testid="shipment-name-input">
               <span data-testid="shipment-name">{shipmentName}</span>
               <button onClick={() => onNameChange('My Shipment')}>set-name</button>
          </div>
     ),
}));

vi.mock('../components/orders-select', () => ({
     OrdersSelect: ({ onSelect }: { onSelect: (orders: [string, number][]) => void }) => (
          <div data-testid="orders-select">
               <button onClick={() => onSelect([['ord-1', 100]])}>set-orders</button>
          </div>
     ),
}));

vi.mock('../components/weight-info-box', () => ({
     WeightInfoBox: () => <div data-testid="weight-info-box" />,
}));

vi.mock('../components/shipment-route-planner', () => ({
     ShipmentRoutePlanner: () => <div data-testid="shipment-route-planner" />,
}));

// --- Test data ---
const mockDrivers: DriverDto[] = [];
const mockVehicles: VehicleDto[] = [];

// --- Tests ---

describe('CreateOutgoingShipmentView', () => {
     const mockOnClose = vi.fn();
     const mockOnSave = vi.fn<(id: string) => void>();

     beforeEach(() => {
          vi.clearAllMocks();
          mockExecuteApiCallWithDefault.mockImplementation((fn: () => Promise<unknown>) => fn());
          mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
          mockFetOrdersForOutgoingShipments.mockResolvedValue([]);
     });

     function renderView() {
          return render(
               <CreateOutgoingShipmentView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    width={1200}
                    onClose={mockOnClose}
                    onSave={mockOnSave}
               />
          );
     }

     it('renders the drawer with correct title', async () => {
          renderView();

          await waitFor(() => {
               expect(screen.getByTestId('drawer-title')).toHaveTextContent('outgoingShipments.new');
          });
     });

     it('renders all form components', async () => {
          renderView();

          await waitFor(() => {
               expect(screen.getByTestId('shipment-date-picker')).toBeInTheDocument();
               expect(screen.getByTestId('shipment-drivers-select')).toBeInTheDocument();
               expect(screen.getByTestId('shipment-vehicle-select')).toBeInTheDocument();
               expect(screen.getByTestId('shipment-name-input')).toBeInTheDocument();
               expect(screen.getByTestId('orders-select')).toBeInTheDocument();
               expect(screen.getByTestId('weight-info-box')).toBeInTheDocument();
               expect(screen.getByTestId('shipment-route-planner')).toBeInTheDocument();
          });
     });

     it('fetches orders on mount', async () => {
          renderView();

          await waitFor(() => {
               expect(mockFetOrdersForOutgoingShipments).toHaveBeenCalledWith(null, {});
          });
     });

     it('calls onClose when close button is clicked', async () => {
          renderView();

          await waitFor(() => {
               expect(screen.getByTestId('drawer-close')).toBeInTheDocument();
          });

          fireEvent.click(screen.getByTestId('drawer-close'));

          expect(mockOnClose).toHaveBeenCalledTimes(1);
     });

     it('shows validation error when saving with empty name', async () => {
          renderView();

          await waitFor(() => {
               expect(screen.getByTestId('drawer-save')).toBeInTheDocument();
          });

          fireEvent.click(screen.getByTestId('drawer-save'));

          await waitFor(() => {
               expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
          });
     });

     it('creates shipment and calls onSave on successful save', async () => {
          mockCreateOutgoingShipmentEndpoint.mockResolvedValue('new-id-123');

          renderView();

          await waitFor(() => {
               expect(screen.getByTestId('shipment-name-input')).toBeInTheDocument();
          });

          // Set a name first
          fireEvent.click(screen.getByText('set-name'));

          // Now save
          fireEvent.click(screen.getByTestId('drawer-save'));

          await waitFor(() => {
               expect(mockCreateOutgoingShipmentEndpoint).toHaveBeenCalled();
               expect(mockOnSave).toHaveBeenCalledWith('new-id-123');
          });
     });

     it('starts with an empty shipment name', async () => {
          renderView();

          await waitFor(() => {
               expect(screen.getByTestId('shipment-name')).toHaveTextContent('');
          });
     });
});
