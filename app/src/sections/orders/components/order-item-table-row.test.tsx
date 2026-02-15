import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, fireEvent, render as baseRender } from 'src/test/test-utils';

import { OrderItemTableRow } from './order-item-table-row';
import { ProductKind, ProductType, ProductListItemDto, OrderItemReminderState } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) =>
    baseRender(
        <table>
            <tbody>{ui}</tbody>
        </table>,
        { theme: testTheme }
    );

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

// Mock Iconify
vi.mock('../../../components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`}>{icon}</span>,
}));

const mockOnDeleteClick = vi.fn();
const mockOnQuantityChange = vi.fn();
const mockOnReminderStateChanged = vi.fn();

const mockProduct = new ProductListItemDto({
    id: 'p1',
    name: 'Pilsner Urquell',
    kind: ProductKind.Keg,
    type: ProductType.PaleLager,
    packageSize: 50,
    weight: 55,
    priceWithVat: 1200,
    priceForUnitWithVat: 24,
});

const defaultProps = {
    row: mockProduct,
    quantity: 10,
    reminderState: null as OrderItemReminderState | null,
    onDeleteClick: mockOnDeleteClick,
    onQuantityChange: mockOnQuantityChange,
    onReminderStateChanged: mockOnReminderStateChanged,
};

describe('OrderItemTableRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the product name', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        expect(screen.getByText('Pilsner Urquell')).toBeInTheDocument();
    });

    it('should render the product kind as a chip', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        expect(screen.getByText(`productKind.${ProductKind.Keg}`)).toBeInTheDocument();
    });

    it('should render the product type as a chip', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        expect(screen.getByText(`productType.${ProductType.PaleLager}`)).toBeInTheDocument();
    });

    it('should render the package size', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        expect(screen.getByText('50 L')).toBeInTheDocument();
    });

    it('should render the weight', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        expect(screen.getByText('55 Kg')).toBeInTheDocument();
    });

    it('should render the price with VAT', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        expect(screen.getByText('1200 Kč')).toBeInTheDocument();
    });

    it('should render the price per unit with VAT', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        expect(screen.getByText('24 Kč')).toBeInTheDocument();
    });

    it('should render the quantity in a text field', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        const quantityInput = screen.getByDisplayValue('10');
        expect(quantityInput).toBeInTheDocument();
    });

    it('should call onQuantityChange when quantity is changed', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        const quantityInput = screen.getByDisplayValue('10');
        fireEvent.change(quantityInput, { target: { value: '20' } });

        expect(mockOnQuantityChange).toHaveBeenCalledWith(20);
    });

    it('should call onQuantityChange with undefined when quantity is cleared', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        const quantityInput = screen.getByDisplayValue('10');
        fireEvent.change(quantityInput, { target: { value: '' } });

        expect(mockOnQuantityChange).toHaveBeenCalledWith(undefined);
    });

    it('should render a checkbox', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThanOrEqual(1);
    });

    it('should call onDeleteClick when delete button is clicked', () => {
        render(<OrderItemTableRow {...defaultProps} />);

        const trashIcons = screen.getAllByTestId('icon-solar:trash-bin-trash-bold');
        // The first trash icon is the delete button (not inside a menu)
        const deleteButton = trashIcons[0].closest('button')!;
        fireEvent.click(deleteButton);

        expect(mockOnDeleteClick).toHaveBeenCalled();
    });

    it('should disable delete button when disabled is true', () => {
        render(<OrderItemTableRow {...defaultProps} disabled />);

        const trashIcons = screen.getAllByTestId('icon-solar:trash-bin-trash-bold');
        const deleteButton = trashIcons[0].closest('button')!;
        expect(deleteButton).toBeDisabled();
    });

    it('should disable quantity input when disabled is true', () => {
        render(<OrderItemTableRow {...defaultProps} disabled />);

        const quantityInput = screen.getByDisplayValue('10');
        expect(quantityInput).toBeDisabled();
    });

    // Reminder state tests
    it('should show add reminder icon when reminderState is null', () => {
        render(<OrderItemTableRow {...defaultProps} reminderState={null} />);

        // MUI Tooltip renders aria-label on the button
        expect(screen.getByLabelText('reminders.addOrderItemReminder')).toBeInTheDocument();
    });

    it('should call onReminderStateChanged with Added when add reminder is clicked', () => {
        render(<OrderItemTableRow {...defaultProps} reminderState={null} />);

        const addButton = screen.getByLabelText('reminders.addOrderItemReminder');
        fireEvent.click(addButton);

        expect(mockOnReminderStateChanged).toHaveBeenCalledWith(OrderItemReminderState.Added);
    });

    it('should show active reminder icon when reminderState is Added', () => {
        render(
            <OrderItemTableRow {...defaultProps} reminderState={OrderItemReminderState.Added} />
        );

        expect(screen.getByLabelText('reminders.editOrderItemReminder')).toBeInTheDocument();
    });

    it('should show menu with resolve and delete options when active reminder is clicked', () => {
        render(
            <OrderItemTableRow {...defaultProps} reminderState={OrderItemReminderState.Added} />
        );

        const activeButton = screen.getByLabelText('reminders.editOrderItemReminder');
        fireEvent.click(activeButton);

        expect(screen.getByText('reminders.setResolved')).toBeInTheDocument();
        expect(screen.getByText('common.delete')).toBeInTheDocument();
    });

    it('should call onReminderStateChanged with Resolved when resolve menu item is clicked', () => {
        render(
            <OrderItemTableRow {...defaultProps} reminderState={OrderItemReminderState.Added} />
        );

        const activeButton = screen.getByLabelText('reminders.editOrderItemReminder');
        fireEvent.click(activeButton);

        const resolveItem = screen.getByText('reminders.setResolved');
        fireEvent.click(resolveItem);

        expect(mockOnReminderStateChanged).toHaveBeenCalledWith(OrderItemReminderState.Resolved);
    });

    it('should call onReminderStateChanged with null when delete reminder menu item is clicked', () => {
        render(
            <OrderItemTableRow {...defaultProps} reminderState={OrderItemReminderState.Added} />
        );

        const activeButton = screen.getByLabelText('reminders.editOrderItemReminder');
        fireEvent.click(activeButton);

        const deleteItem = screen.getByText('common.delete');
        fireEvent.click(deleteItem);

        expect(mockOnReminderStateChanged).toHaveBeenCalledWith(null);
    });
});
