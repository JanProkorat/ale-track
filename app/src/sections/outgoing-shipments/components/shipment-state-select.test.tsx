import type { OutgoingShipmentState } from 'src/api/Client';

import { fireEvent } from '@testing-library/react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, within } from 'src/test/test-utils';

import { ShipmentStateSelect } from './shipment-state-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockOnSelect = vi.fn();

describe('ShipmentStateSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <ShipmentStateSelect
                selectedState={'Created' as unknown as OutgoingShipmentState}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('productDeliveries.state')).toBeInTheDocument();
    });

    it('should render a chip with the selected state translation', () => {
        render(
            <ShipmentStateSelect
                selectedState={'Created' as unknown as OutgoingShipmentState}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('outgoingShipmentState.Created')).toBeInTheDocument();
    });

    it('should render all state options when opened', async () => {
        render(
            <ShipmentStateSelect
                selectedState={'Created' as unknown as OutgoingShipmentState}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');

        // OutgoingShipmentState has 5 string keys: Created, Loaded, InTransit, Delivered, Cancelled
        expect(options.length).toBe(5);
    });

    it('should show the selected state as checked', async () => {
        render(
            <ShipmentStateSelect
                selectedState={'Loaded' as unknown as OutgoingShipmentState}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const checkboxes = within(listbox).getAllByRole('checkbox');
        // "Loaded" is at index 1 (Created=0, Loaded=1, InTransit=2, Delivered=3, Cancelled=4)
        expect(checkboxes[1]).toBeChecked();
    });

    it('should call onSelect when an option is clicked', async () => {
        render(
            <ShipmentStateSelect
                selectedState={'Created' as unknown as OutgoingShipmentState}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[2].click(); // InTransit

        expect(mockOnSelect).toHaveBeenCalledWith('InTransit');
    });
});
