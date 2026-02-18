import { it, vi, expect, describe, beforeEach } from 'vitest';

import { fireEvent, renderWithProviders } from 'src/test/test-utils';

import { OutgoingShipmentDetailView } from './outgoing-shipment-detail-view';
import {
     OutgoingShipmentState,
     ClientOrderShipmentDto,
     UpdateOutgoingShipmentDto,
     OutgoingShipmentStopAddressKind,
} from '../../../api/Client';

import type { DriverDto, VehicleDto, OutgoingShipmentOrderDto } from '../../../api/Client';

// Stable t reference
const mockT = (key: string) => key;

vi.mock('react-i18next', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          useTranslation: () => ({ t: mockT }),
     };
});

// Mock mapEnumValue to return the raw value
vi.mock('src/utils/format-enum-value', () => ({
     mapEnumValue: (_enumObj: unknown, value: unknown) => value,
}));

// Mock child components
vi.mock('../components/shipment-state-select', () => ({
     ShipmentStateSelect: ({
          selectedState,
          onSelect,
     }: {
          selectedState: OutgoingShipmentState;
          onSelect: (s: OutgoingShipmentState) => void;
     }) => (
          <div data-testid="shipment-state-select">
               <span data-testid="current-state">{selectedState}</span>
               <button onClick={() => onSelect(OutgoingShipmentState.Loaded)}>set-loaded</button>
          </div>
     ),
}));

vi.mock('../components/shipment-delivery-date-picker', () => ({
     ShipmentDeliveryDatePicker: ({
          selectedDeliveryDate,
          onDatePicked,
     }: {
          selectedDeliveryDate: Date | undefined;
          onDatePicked: (d: Date | null) => void;
     }) => (
          <div data-testid="shipment-date-picker">
               <span>{selectedDeliveryDate?.toISOString() ?? 'no-date'}</span>
               <button onClick={() => onDatePicked(new Date('2026-04-01'))}>set-date</button>
          </div>
     ),
}));

vi.mock('../components/shipment-drivers-select', () => ({
     ShipmentDriversSelect: ({
          selectedDriverIds,
          onSelect,
     }: {
          selectedDriverIds: string[];
          onSelect: (ids: string[]) => void;
     }) => (
          <div data-testid="shipment-drivers-select">
               <span data-testid="driver-ids">{selectedDriverIds.join(',')}</span>
               <button onClick={() => onSelect(['d1', 'd2'])}>set-drivers</button>
          </div>
     ),
}));

vi.mock('../components/shipment-vehicle-select', () => ({
     ShipmentVehicleSelect: ({
          selectedVehicleId,
          onSelect,
     }: {
          selectedVehicleId: string | undefined;
          onSelect: (id: string | undefined, w: number | undefined) => void;
     }) => (
          <div data-testid="shipment-vehicle-select">
               <span data-testid="vehicle-id">{selectedVehicleId ?? 'none'}</span>
               <button onClick={() => onSelect('v2', 5000)}>set-vehicle</button>
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
               <button onClick={() => onNameChange('New Name')}>set-name</button>
          </div>
     ),
}));

vi.mock('../components/orders-select', () => ({
     OrdersSelect: ({ onSelect }: { onSelect: (orders: [string, number][]) => void }) => (
          <div data-testid="orders-select">
               <button
                    onClick={() =>
                         onSelect([
                              ['ord-1', 100],
                              ['ord-2', 200],
                         ])
                    }
               >
                    set-orders
               </button>
          </div>
     ),
}));

vi.mock('../components/weight-info-box', () => ({
     WeightInfoBox: ({
          currentWeight,
          maxWeight,
     }: {
          currentWeight: number | undefined;
          maxWeight: number | undefined;
     }) => (
          <div data-testid="weight-info-box">
               {currentWeight ?? 'n/a'}/{maxWeight ?? 'n/a'}
          </div>
     ),
}));

vi.mock('../components/shipment-route-planner', () => ({
     ShipmentRoutePlanner: () => <div data-testid="shipment-route-planner" />,
}));

// --- Test data ---

const mockDrivers: DriverDto[] = [];
const mockVehicles: VehicleDto[] = [
     { id: 'v1', maxWeight: 3000 } as VehicleDto,
     { id: 'v2', maxWeight: 5000 } as VehicleDto,
];
const mockOrders: OutgoingShipmentOrderDto[] = [];

const createShipment = (overrides?: Partial<UpdateOutgoingShipmentDto>) =>
     new UpdateOutgoingShipmentDto({
          name: 'Test Shipment',
          deliveryDate: new Date('2026-03-15'),
          state: OutgoingShipmentState.Created,
          vehicleId: 'v1',
          driverIds: ['d1'],
          clientOrderShipments: [
               new ClientOrderShipmentDto({
                    clientOrderId: 'ord-1',
                    order: 1,
                    selectedAddressKind: OutgoingShipmentStopAddressKind.Official,
               }),
          ],
          ...overrides,
     });

// --- Tests ---

describe('OutgoingShipmentDetailView', () => {
     let mockOnChange: ReturnType<typeof vi.fn<(s: UpdateOutgoingShipmentDto) => void>>;

     beforeEach(() => {
          vi.clearAllMocks();
          mockOnChange = vi.fn<(s: UpdateOutgoingShipmentDto) => void>();
     });

     it('renders all child components', () => {
          const shipment = createShipment();

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          expect(document.querySelector('[data-testid="shipment-state-select"]')).toBeInTheDocument();
          expect(document.querySelector('[data-testid="shipment-date-picker"]')).toBeInTheDocument();
          expect(document.querySelector('[data-testid="shipment-drivers-select"]')).toBeInTheDocument();
          expect(document.querySelector('[data-testid="shipment-vehicle-select"]')).toBeInTheDocument();
          expect(document.querySelector('[data-testid="shipment-name-input"]')).toBeInTheDocument();
          expect(document.querySelector('[data-testid="orders-select"]')).toBeInTheDocument();
          expect(document.querySelector('[data-testid="weight-info-box"]')).toBeInTheDocument();
          expect(document.querySelector('[data-testid="shipment-route-planner"]')).toBeInTheDocument();
     });

     it('displays the current shipment name', () => {
          const shipment = createShipment({ name: 'My Shipment' });

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          expect(document.querySelector('[data-testid="shipment-name"]')).toHaveTextContent('My Shipment');
     });

     it('calls onChange with new drivers when drivers are selected', () => {
          const shipment = createShipment();

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          fireEvent.click(document.querySelector('[data-testid="shipment-drivers-select"] button')!);

          expect(mockOnChange).toHaveBeenCalledTimes(1);
          const updatedShipment = mockOnChange.mock.calls[0][0] as UpdateOutgoingShipmentDto;
          expect(updatedShipment.driverIds).toEqual(['d1', 'd2']);
     });

     it('calls onChange with new state when state is changed', () => {
          const shipment = createShipment();

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          fireEvent.click(document.querySelector('[data-testid="shipment-state-select"] button')!);

          expect(mockOnChange).toHaveBeenCalledTimes(1);
          const updatedShipment = mockOnChange.mock.calls[0][0] as UpdateOutgoingShipmentDto;
          expect(updatedShipment.state).toBe(OutgoingShipmentState.Loaded);
     });

     it('calls onChange with new delivery date', () => {
          const shipment = createShipment();

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          fireEvent.click(document.querySelector('[data-testid="shipment-date-picker"] button')!);

          expect(mockOnChange).toHaveBeenCalledTimes(1);
          const updatedShipment = mockOnChange.mock.calls[0][0] as UpdateOutgoingShipmentDto;
          expect(updatedShipment.deliveryDate).toEqual(new Date('2026-04-01'));
     });

     it('calls onChange with new name when name is changed', () => {
          const shipment = createShipment();

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          fireEvent.click(document.querySelector('[data-testid="shipment-name-input"] button')!);

          expect(mockOnChange).toHaveBeenCalledTimes(1);
          const updatedShipment = mockOnChange.mock.calls[0][0] as UpdateOutgoingShipmentDto;
          expect(updatedShipment.name).toBe('New Name');
     });

     it('calls onChange with new vehicle when vehicle is selected', () => {
          const shipment = createShipment();

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          fireEvent.click(document.querySelector('[data-testid="shipment-vehicle-select"] button')!);

          expect(mockOnChange).toHaveBeenCalledTimes(1);
          const updatedShipment = mockOnChange.mock.calls[0][0] as UpdateOutgoingShipmentDto;
          expect(updatedShipment.vehicleId).toBe('v2');
     });

     it('calls onChange with selected orders', () => {
          const shipment = createShipment();

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          fireEvent.click(document.querySelector('[data-testid="orders-select"] button')!);

          expect(mockOnChange).toHaveBeenCalledTimes(1);
          const updatedShipment = mockOnChange.mock.calls[0][0] as UpdateOutgoingShipmentDto;
          expect(updatedShipment.clientOrderShipments).toHaveLength(2);
          expect(updatedShipment.clientOrderShipments[0].clientOrderId).toBe('ord-1');
          expect(updatedShipment.clientOrderShipments[1].clientOrderId).toBe('ord-2');
     });

     it('displays current vehicle and driver ids', () => {
          const shipment = createShipment({ vehicleId: 'v1', driverIds: ['d1'] });

          renderWithProviders(
               <OutgoingShipmentDetailView
                    drivers={mockDrivers}
                    vehicles={mockVehicles}
                    orders={mockOrders}
                    shipment={shipment}
                    errors={{}}
                    changesMade={false}
                    onChange={mockOnChange}
               />
          );

          expect(document.querySelector('[data-testid="vehicle-id"]')).toHaveTextContent('v1');
          expect(document.querySelector('[data-testid="driver-ids"]')).toHaveTextContent('d1');
     });
});
