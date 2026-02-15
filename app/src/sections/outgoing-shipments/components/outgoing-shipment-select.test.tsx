import { it, vi, expect, describe, beforeEach } from 'vitest';

import { OutgoingShipmentListItemDto } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { OutgoingShipmentSelect } from './outgoing-shipment-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../../locales/formatDate', () => ({
    formatDate: (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
})); const mockShipments: OutgoingShipmentListItemDto[] = [
    new OutgoingShipmentListItemDto({
        id: 's1',
        name: 'Shipment Alpha',
        deliveryDate: new Date(2025, 5, 15),
        state: 'Created' as any,
    }),
    new OutgoingShipmentListItemDto({
        id: 's2',
        name: 'Shipment Beta',
        deliveryDate: new Date(2025, 6, 20),
        state: 'InTransit' as any,
    }),
];

const mockOnSelect = vi.fn();

describe('OutgoingShipmentSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <OutgoingShipmentSelect
                shipments={mockShipments}
                selectedShipmentId={undefined}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('outgoingShipments.title')).toBeInTheDocument();
    });

    it('should render a chip with selected shipment name and date', () => {
        render(
            <OutgoingShipmentSelect
                shipments={mockShipments}
                selectedShipmentId="s1"
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('Shipment Alpha - 2025-06-15')).toBeInTheDocument();
    });

    it('should render all shipment options when opened', async () => {
        render(
            <OutgoingShipmentSelect
                shipments={mockShipments}
                selectedShipmentId={undefined}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');

        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options).toHaveLength(2);
    });

    it('should show state chip for each option', async () => {
        render(
            <OutgoingShipmentSelect
                shipments={mockShipments}
                selectedShipmentId={undefined}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');

        fireEvent.mouseDown(selectButton);

        await screen.findByRole('listbox');
        expect(screen.getByText('outgoingShipmentState.Created')).toBeInTheDocument();
        expect(screen.getByText('outgoingShipmentState.InTransit')).toBeInTheDocument();
    });

    it('should show checked checkbox for the selected shipment', async () => {
        render(
            <OutgoingShipmentSelect
                shipments={mockShipments}
                selectedShipmentId="s1"
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

    it('should call onSelect when a shipment is clicked', async () => {
        render(
            <OutgoingShipmentSelect
                shipments={mockShipments}
                selectedShipmentId={undefined}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');

        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[1].click();

        expect(mockOnSelect).toHaveBeenCalledWith('s2');
    });

    it('should show empty message when no shipments available', async () => {
        render(
            <OutgoingShipmentSelect
                shipments={[]}
                selectedShipmentId={undefined}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');

        fireEvent.mouseDown(selectButton);

        await screen.findByRole('listbox');
        expect(screen.getByText('outgoingShipments.noShipmentsToDisplay')).toBeInTheDocument();
    });
});
