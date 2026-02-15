import type { ProductDeliveryState } from 'src/api/Client';

import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { DeliveryStateSelect } from './delivery-state-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockStates = [
    'InPlanning' as unknown as ProductDeliveryState,
    'OnTheWay' as unknown as ProductDeliveryState,
    'Finished' as unknown as ProductDeliveryState,
    'Cancelled' as unknown as ProductDeliveryState,
];

const mockOnSelect = vi.fn();

describe('DeliveryStateSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <DeliveryStateSelect
                selectedState={undefined}
                states={mockStates}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('productDeliveries.state')).toBeInTheDocument();
    });

    it('should render a chip with the translated selected state', () => {
        render(
            <DeliveryStateSelect
                selectedState={mockStates[0]}
                states={mockStates}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('deliveryState.InPlanning')).toBeInTheDocument();
    });

    it('should render all state options when opened', async () => {
        render(
            <DeliveryStateSelect
                selectedState={undefined}
                states={mockStates}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options).toHaveLength(4);
    });

    it('should show checked checkbox for the selected state', async () => {
        render(
            <DeliveryStateSelect
                selectedState={mockStates[1]}
                states={mockStates}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const checkboxes = within(listbox).getAllByRole('checkbox');
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
        expect(checkboxes[3]).not.toBeChecked();
    });

    it('should call onSelect with the state when selecting', async () => {
        render(
            <DeliveryStateSelect
                selectedState={undefined}
                states={mockStates}
                shouldValidate={false}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[2].click();

        expect(mockOnSelect).toHaveBeenCalledWith(mockStates[2]);
    });

    it('should show error state when shouldValidate is true and no state selected', () => {
        render(
            <DeliveryStateSelect
                selectedState={undefined}
                states={mockStates}
                shouldValidate
                onSelect={mockOnSelect}
            />
        );

        const label = screen.getByText('productDeliveries.state');
        expect(label).toHaveClass('Mui-error');
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <DeliveryStateSelect
                selectedState={undefined}
                states={mockStates}
                shouldValidate={false}
                onSelect={mockOnSelect}
                disabled
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-disabled', 'true');
    });
});
