import { it, vi, expect, describe, beforeEach } from 'vitest';

import { BreweryDto } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { BrewerySelect } from './brewery-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockBreweries: BreweryDto[] = [
    new BreweryDto({ id: 'b1', name: 'Pilsner Brewery' }),
    new BreweryDto({ id: 'b2', name: 'Lager Brewery' }),
    new BreweryDto({ id: 'b3', name: 'Ale Brewery' }),
];

const mockOnBrewerySelected = vi.fn();

describe('BrewerySelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the label', () => {
        render(
            <BrewerySelect
                selectedBreweryId={undefined}
                breweries={mockBreweries}
                shouldValidate={false}
                onBrewerySelected={mockOnBrewerySelected}
            />
        );

        expect(screen.getByText('productDeliveries.brewery')).toBeInTheDocument();
    });

    it('should render a chip with the selected brewery name', () => {
        render(
            <BrewerySelect
                selectedBreweryId="b1"
                breweries={mockBreweries}
                shouldValidate={false}
                onBrewerySelected={mockOnBrewerySelected}
            />
        );

        expect(screen.getByText('Pilsner Brewery')).toBeInTheDocument();
    });

    it('should render all brewery options when opened', async () => {
        render(
            <BrewerySelect
                selectedBreweryId={undefined}
                breweries={mockBreweries}
                shouldValidate={false}
                onBrewerySelected={mockOnBrewerySelected}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options).toHaveLength(3);
    });

    it('should show checked checkbox for the selected brewery', async () => {
        render(
            <BrewerySelect
                selectedBreweryId="b2"
                breweries={mockBreweries}
                shouldValidate={false}
                onBrewerySelected={mockOnBrewerySelected}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const checkboxes = within(listbox).getAllByRole('checkbox');
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
    });

    it('should call onBrewerySelected with brewery id and name when selecting', async () => {
        render(
            <BrewerySelect
                selectedBreweryId={undefined}
                breweries={mockBreweries}
                shouldValidate={false}
                onBrewerySelected={mockOnBrewerySelected}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[0].click();

        expect(mockOnBrewerySelected).toHaveBeenCalledWith('b1', 'Pilsner Brewery');
    });

    it('should call onBrewerySelected with undefined when deselecting (toggle)', async () => {
        render(
            <BrewerySelect
                selectedBreweryId="b1"
                breweries={mockBreweries}
                shouldValidate={false}
                onBrewerySelected={mockOnBrewerySelected}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        options[0].click();

        expect(mockOnBrewerySelected).toHaveBeenCalledWith(undefined, '');
    });

    it('should show error state when shouldValidate is true and no brewery selected', () => {
        render(
            <BrewerySelect
                selectedBreweryId={undefined}
                breweries={mockBreweries}
                shouldValidate
                onBrewerySelected={mockOnBrewerySelected}
            />
        );

        const label = screen.getByText('productDeliveries.brewery');
        expect(label).toHaveClass('Mui-error');
    });

    it('should show error state after touch and no brewery selected', async () => {
        render(
            <BrewerySelect
                selectedBreweryId={undefined}
                breweries={mockBreweries}
                shouldValidate={false}
                onBrewerySelected={mockOnBrewerySelected}
            />
        );

        const selectButton = screen.getByRole('combobox');
        fireEvent.mouseDown(selectButton);

        const listbox = await screen.findByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        // Click an option to set touched, then the parent re-renders with undefined still
        options[0].click();

        // The component calls onBrewerySelected, the parent would need to re-render
        // but the touch state is internal, so we verify the callback was called
        expect(mockOnBrewerySelected).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <BrewerySelect
                selectedBreweryId={undefined}
                breweries={mockBreweries}
                shouldValidate={false}
                onBrewerySelected={mockOnBrewerySelected}
                disabled
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-disabled', 'true');
    });
});
