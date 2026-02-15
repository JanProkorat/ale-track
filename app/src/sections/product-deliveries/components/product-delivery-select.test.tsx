import { it, vi, expect, describe, beforeEach } from 'vitest';

import { ProductDeliveryListItemDto } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { ProductDeliverySelect } from './product-delivery-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../../locales/formatDate', () => ({
    formatDate: (date: Date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    },
}));

const mockDeliveries: ProductDeliveryListItemDto[] = [
    new ProductDeliveryListItemDto({
        id: 'del1',
        deliveryDate: new Date(2025, 5, 15),
        state: 'InPlanning' as any,
        stopNames: ['Brewery A', 'Brewery B'],
    }),
    new ProductDeliveryListItemDto({
        id: 'del2',
        deliveryDate: new Date(2025, 5, 20),
        state: 'OnTheWay' as any,
        stopNames: ['Brewery C'],
    }),
];

const mockOnSelect = vi.fn();

describe('ProductDeliverySelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <ProductDeliverySelect
                deliveries={mockDeliveries}
                selectedDeliveryId={undefined}
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('productDeliveries.title')).toBeInTheDocument();
    });

    it('should render a chip with date and stop names for selected delivery', () => {
        render(
            <ProductDeliverySelect
                deliveries={mockDeliveries}
                selectedDeliveryId="del1"
                onSelect={mockOnSelect}
            />
        );

        expect(screen.getByText('15.06.2025 - Brewery A, Brewery B')).toBeInTheDocument();
    });

    it('should render all delivery options when opened', async () => {
        render(
            <ProductDeliverySelect
                deliveries={mockDeliveries}
                selectedDeliveryId={undefined}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options).toHaveLength(2);
    });

    it('should show state chip for each delivery option', async () => {
        render(
            <ProductDeliverySelect
                deliveries={mockDeliveries}
                selectedDeliveryId={undefined}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        await screen.findByRole('listbox');
        expect(screen.getByText('deliveryState.InPlanning')).toBeInTheDocument();
        expect(screen.getByText('deliveryState.OnTheWay')).toBeInTheDocument();
    });

    it('should show checked checkbox for the selected delivery', async () => {
        render(
            <ProductDeliverySelect
                deliveries={mockDeliveries}
                selectedDeliveryId="del1"
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

    it('should call onSelect with delivery id when clicking an option', async () => {
        render(
            <ProductDeliverySelect
                deliveries={mockDeliveries}
                selectedDeliveryId={undefined}
                onSelect={mockOnSelect}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[1].click();

        expect(mockOnSelect).toHaveBeenCalledWith('del2');
    });
});
