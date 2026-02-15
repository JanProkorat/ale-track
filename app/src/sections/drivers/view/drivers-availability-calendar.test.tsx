import dayjs from 'dayjs';
import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { DriverAvailabilityListItemDto } from '../../../api/Client';
import { DriversAvailabilityCalendar } from './drivers-availability-calendar';

import type { DriversProps } from '../drivers-table-row';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

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

// --- Test data ---
const today = dayjs();
const currentMonthDate = today.startOf('month').add(14, 'day'); // 15th of this month

const driverWithAvailability: DriversProps = {
    id: 'driver-1',
    firstName: 'Jan',
    lastName: 'Novák',
    color: '#ff0000',
    availableDates: [
        new DriverAvailabilityListItemDto({
            from: currentMonthDate.hour(8).toDate(),
            until: currentMonthDate.hour(16).toDate(),
        }),
    ],
};

const driverWithMultiDayAvailability: DriversProps = {
    id: 'driver-2',
    firstName: 'Petr',
    lastName: 'Svoboda',
    color: '#00ff00',
    availableDates: [
        new DriverAvailabilityListItemDto({
            from: currentMonthDate.hour(9).toDate(),
            until: currentMonthDate.add(2, 'day').hour(17).toDate(),
        }),
    ],
};

describe('DriversAvailabilityCalendar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Month header ---
    it('should render the current month and year in header', () => {
        render(<DriversAvailabilityCalendar drivers={[]} />);

        const monthKey = `months.${today.format('MMMM').toLowerCase()}`;
        const year = today.format('YYYY');
        expect(screen.getByText(`${monthKey} ${year}`)).toBeInTheDocument();
    });

    // --- Day of week labels ---
    it('should render day-of-week labels', () => {
        render(<DriversAvailabilityCalendar drivers={[]} />);

        // Czech day abbreviations: P, Ú, S, Č, P, S, N
        const labels = ['P', 'Ú', 'S', 'Č', 'N'];
        labels.forEach((label) => {
            expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
        });
    });

    // --- Navigation buttons ---
    it('should navigate to the previous month', async () => {
        const user = userEvent.setup();
        render(<DriversAvailabilityCalendar drivers={[]} />);

        const prevMonth = today.subtract(1, 'month');
        const prevMonthKey = `months.${prevMonth.format('MMMM').toLowerCase()}`;

        // Click the left chevron (prev month)
        const buttons = document.querySelectorAll('.MuiIconButton-root');
        await user.click(buttons[0] as HTMLElement);

        expect(
            screen.getByText(`${prevMonthKey} ${prevMonth.format('YYYY')}`)
        ).toBeInTheDocument();
    });

    it('should navigate to the next month', async () => {
        const user = userEvent.setup();
        render(<DriversAvailabilityCalendar drivers={[]} />);

        const nextMonth = today.add(1, 'month');
        const nextMonthKey = `months.${nextMonth.format('MMMM').toLowerCase()}`;

        // Click the right chevron (next month)
        const buttons = document.querySelectorAll('.MuiIconButton-root');
        await user.click(buttons[1] as HTMLElement);

        expect(
            screen.getByText(`${nextMonthKey} ${nextMonth.format('YYYY')}`)
        ).toBeInTheDocument();
    });

    // --- Driver availability shown on calendar ---
    it('should display driver name button on available date', () => {
        render(<DriversAvailabilityCalendar drivers={[driverWithAvailability]} />);

        // Driver's first name should appear as a button on their available day
        expect(screen.getByRole('button', { name: 'Jan' })).toBeInTheDocument();
    });

    // --- Multi-day availability ---
    it('should display driver on multiple days for multi-day availability', () => {
        render(<DriversAvailabilityCalendar drivers={[driverWithMultiDayAvailability]} />);

        // Petr's availability spans 3 days, so his name should appear multiple times
        const buttons = screen.getAllByRole('button', { name: 'Petr' });
        expect(buttons.length).toBe(3);
    });

    // --- No drivers when empty ---
    it('should not display any driver buttons when drivers list is empty', () => {
        render(<DriversAvailabilityCalendar drivers={[]} />);

        expect(screen.queryByRole('button', { name: 'Jan' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Petr' })).not.toBeInTheDocument();
    });

    // --- Popover on driver click ---
    it('should show popover with driver info when driver button is clicked', async () => {
        const user = userEvent.setup();
        render(<DriversAvailabilityCalendar drivers={[driverWithAvailability]} />);

        await user.click(screen.getByRole('button', { name: 'Jan' }));

        await waitFor(() => {
            // Popover shows full name
            expect(screen.getByText('Jan Novák')).toBeInTheDocument();
            // Popover shows "drivers.available" label
            expect(screen.getByText('drivers.available')).toBeInTheDocument();
            // Popover shows time interval
            expect(screen.getByText('08:00 – 16:00')).toBeInTheDocument();
        });
    });

    // --- Multiple drivers on same day ---
    it('should display multiple drivers on the same date', () => {
        const driver2SameDay: DriversProps = {
            id: 'driver-3',
            firstName: 'Karel',
            lastName: 'Dvořák',
            color: '#0000ff',
            availableDates: [
                new DriverAvailabilityListItemDto({
                    from: currentMonthDate.hour(10).toDate(),
                    until: currentMonthDate.hour(18).toDate(),
                }),
            ],
        };

        render(
            <DriversAvailabilityCalendar
                drivers={[driverWithAvailability, driver2SameDay]}
            />
        );

        expect(screen.getByRole('button', { name: 'Jan' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Karel' })).toBeInTheDocument();
    });

    // --- Calendar renders day numbers ---
    it('should render day numbers for the current month', () => {
        render(<DriversAvailabilityCalendar drivers={[]} />);

        // The 1st and last day of current month should be visible
        // "1" may appear twice (current + adjacent month), so use getAllByText
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
        const lastDay = today.endOf('month').date().toString();
        expect(screen.getAllByText(lastDay).length).toBeGreaterThanOrEqual(1);
    });
});
