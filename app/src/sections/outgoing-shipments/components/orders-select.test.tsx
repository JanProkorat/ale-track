import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, within, fireEvent } from 'src/test/test-utils';
import {
     ProductKind,
     ProductType,
     ClientOrderShipmentDto,
     UnassignedOrderItemDto,
     OutgoingShipmentOrderDto,
} from 'src/api/Client';

import { OrdersSelect } from './orders-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

vi.mock('src/components/iconify', () => ({
     Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

vi.mock('../../../locales/formatDate', () => ({
     formatDate: (date: Date) =>
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
}));
const mockItems: UnassignedOrderItemDto[] = [
     new UnassignedOrderItemDto({
          productId: 'p1',
          productName: 'Pilsner',
          quantity: 10,
          kind: ProductKind.Keg,
          type: ProductType.PaleLager,
          packageSize: 50,
          weight: 5,
     }),
     new UnassignedOrderItemDto({
          productId: 'p2',
          productName: 'IPA',
          quantity: 5,
          kind: ProductKind.Bottle,
          type: ProductType.PaleLager,
          packageSize: 0.5,
          weight: 2,
     }),
];

const mockOrders: OutgoingShipmentOrderDto[] = [
     new OutgoingShipmentOrderDto({
          id: 'o1',
          clientName: 'Client A',
          requiredDeliveryDate: new Date(2025, 5, 15),
          items: mockItems,
     }),
     new OutgoingShipmentOrderDto({
          id: 'o2',
          clientName: 'Client B',
          requiredDeliveryDate: new Date(2025, 6, 20),
          items: [],
     }),
];

const mockOnSelect = vi.fn();

describe('OrdersSelect', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render the label', () => {
          render(
               <OrdersSelect orders={mockOrders} selectedOrders={[]} shouldValidate={false} onSelect={mockOnSelect} />
          );

          expect(screen.getByText('outgoingShipments.orders')).toBeInTheDocument();
     });

     it('should render chips for selected orders', () => {
          const selectedOrders = [
               new ClientOrderShipmentDto({ clientOrderId: 'o1', order: 0, selectedAddressKind: 0 as any }),
          ];

          render(
               <OrdersSelect
                    orders={mockOrders}
                    selectedOrders={selectedOrders}
                    shouldValidate={false}
                    onSelect={mockOnSelect}
               />
          );

          expect(screen.getByText('Client A - 2025-06-15')).toBeInTheDocument();
     });

     it('should render all order options when opened', async () => {
          render(
               <OrdersSelect orders={mockOrders} selectedOrders={[]} shouldValidate={false} onSelect={mockOnSelect} />
          );

          const selectButton = screen.getByRole('combobox');

          fireEvent.mouseDown(selectButton);

          const listbox = await screen.findByRole('listbox');
          const options = within(listbox).getAllByRole('option');
          expect(options).toHaveLength(2);
     });

     it('should show checked checkbox for selected orders', async () => {
          const selectedOrders = [
               new ClientOrderShipmentDto({ clientOrderId: 'o1', order: 0, selectedAddressKind: 0 as any }),
          ];

          render(
               <OrdersSelect
                    orders={mockOrders}
                    selectedOrders={selectedOrders}
                    shouldValidate={false}
                    onSelect={mockOnSelect}
               />
          );

          const selectButton = screen.getByRole('combobox');

          fireEvent.mouseDown(selectButton);

          const listbox = await screen.findByRole('listbox');
          const checkboxes = within(listbox).getAllByRole('checkbox');
          expect(checkboxes[0]).toBeChecked();
          expect(checkboxes[1]).not.toBeChecked();
     });

     it('should display order items when details are expanded', async () => {
          render(
               <OrdersSelect orders={mockOrders} selectedOrders={[]} shouldValidate={false} onSelect={mockOnSelect} />
          );

          const selectButton = screen.getByRole('combobox');

          fireEvent.mouseDown(selectButton);

          await screen.findByRole('listbox');

          // Details are expanded by default via useEffect
          expect(screen.getByText(/Pilsner/)).toBeInTheDocument();
     });

     it('should show error state when shouldValidate is true and no orders selected', () => {
          render(<OrdersSelect orders={mockOrders} selectedOrders={[]} shouldValidate onSelect={mockOnSelect} />);

          const label = screen.getByText('outgoingShipments.orders');
          expect(label).toHaveClass('Mui-error');
     });

     it('should not show error state when shouldValidate is false', () => {
          render(
               <OrdersSelect orders={mockOrders} selectedOrders={[]} shouldValidate={false} onSelect={mockOnSelect} />
          );

          const label = screen.getByText('outgoingShipments.orders');
          expect(label).not.toHaveClass('Mui-error');
     });

     it('should be disabled when disabled prop is true', () => {
          render(
               <OrdersSelect
                    orders={mockOrders}
                    selectedOrders={[]}
                    shouldValidate={false}
                    onSelect={mockOnSelect}
                    disabled
               />
          );

          const select = screen.getByRole('combobox');
          expect(select).toHaveAttribute('aria-disabled', 'true');
     });
});
