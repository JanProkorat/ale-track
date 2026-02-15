import { it, vi, expect, describe, beforeEach } from 'vitest';

import { ReminderType } from 'src/api/Client';
import { screen, render, waitFor, fireEvent } from 'src/test/test-utils';

import CreateReminderView from './create-reminder-view';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

const mockTriggerRefresh = vi.fn();
vi.mock('../../../providers/EntityStatsContext', () => ({
    useEntityStatsRefresh: () => ({ triggerRefresh: mockTriggerRefresh }),
}));

const mockCreateBreweryReminder = vi.fn();
const mockCreateClientReminder = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class {
        createBreweryReminderEndpoint = mockCreateBreweryReminder;
        createClientReminderEndpoint = mockCreateClientReminder;
    },
}));

vi.mock('./components/days-of-week-picker', () => ({
    DaysOfWeekPicker: ({ onDaysOfWeekPicked }: { onDaysOfWeekPicked: (d: number[]) => void }) => (
        <div data-testid="days-of-week-picker">
            <button onClick={() => onDaysOfWeekPicked([1, 5])}>pickDaysOfWeek</button>
        </div>
    ),
}));

vi.mock('./components/days-of-month-picker', () => ({
    DaysOfMonthPicker: ({ onDaysOfMonthPicked }: { onDaysOfMonthPicked: (d: number[]) => void }) => (
        <div data-testid="days-of-month-picker">
            <button onClick={() => onDaysOfMonthPicked([1, 15])}>pickDaysOfMonth</button>
        </div>
    ),
}));

vi.mock('./components/reminder-date-picker', () => ({
    ReminderDatePicker: ({ label }: { label: string }) => <div data-testid="reminder-date-picker">{label}</div>,
}));

const mockOnClose = vi.fn();

describe('CreateReminderView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the drawer title', () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('reminders.detailTitle')).toBeInTheDocument();
    });

    it('should render close and save buttons from DrawerLayout', () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('common.close')).toBeInTheDocument();
        expect(screen.getByText('common.saveAndClose')).toBeInTheDocument();
    });

    it('should render name input', () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        expect(screen.getAllByText('reminders.name').length).toBeGreaterThan(0);
    });

    it('should render description textarea', () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        expect(screen.getAllByText('reminders.description').length).toBeGreaterThan(0);
    });

    it('should render date picker for OneTimeEvent type', () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('reminders.occurrenceDate')).toBeInTheDocument();
    });

    it('should render recurrence controls for Regular type', () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.Regular}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('reminders.displaySettings')).toBeInTheDocument();
        expect(screen.getByText('reminders.activeUntilDate')).toBeInTheDocument();
    });

    it('should call onClose with false when close button is clicked', () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        screen.getByText('common.close').click();

        expect(mockOnClose).toHaveBeenCalledWith(false);
    });

    it('should show validation error when saving with empty name', async () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });
    });

    it('should call brewery API when parentType is brewery', async () => {
        mockCreateBreweryReminder.mockResolvedValue('new-id');

        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        // Fill in name
        const nameInput = screen.getByLabelText('reminders.name');
        fireEvent.change(nameInput, { target: { value: 'Test Reminder' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockCreateBreweryReminder).toHaveBeenCalledWith('p1', expect.any(Object));
        });
    });

    it('should call client API when parentType is client', async () => {
        mockCreateClientReminder.mockResolvedValue('new-id');

        render(
            <CreateReminderView
                parentId="c1"
                parentType="client"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        const nameInput = screen.getByLabelText('reminders.name');
        fireEvent.change(nameInput, { target: { value: 'Test Reminder' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockCreateClientReminder).toHaveBeenCalledWith('c1', expect.any(Object));
        });
    });

    it('should call onClose with true after successful save', async () => {
        mockCreateBreweryReminder.mockResolvedValue('new-id');

        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        const nameInput = screen.getByLabelText('reminders.name');
        fireEvent.change(nameInput, { target: { value: 'Test Reminder' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalledWith(true);
        });
    });

    it('should trigger entity stats refresh after successful save', async () => {
        mockCreateBreweryReminder.mockResolvedValue('new-id');

        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        const nameInput = screen.getByLabelText('reminders.name');
        fireEvent.change(nameInput, { target: { value: 'Test Reminder' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockTriggerRefresh).toHaveBeenCalled();
        });
    });

    it('should show error snackbar when save fails', async () => {
        mockCreateBreweryReminder.mockRejectedValue(new Error('fail'));

        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        const nameInput = screen.getByLabelText('reminders.name');
        fireEvent.change(nameInput, { target: { value: 'Test Reminder' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.saveError', 'error');
        });
    });

    it('should update description field', () => {
        render(
            <CreateReminderView
                parentId="p1"
                parentType="brewery"
                selectedType={ReminderType.OneTimeEvent}
                onClose={mockOnClose}
            />
        );

        const descInput = screen.getByLabelText('reminders.description');
        fireEvent.change(descInput, { target: { value: 'My description' } });

        expect(descInput).toHaveValue('My description');
    });
});
