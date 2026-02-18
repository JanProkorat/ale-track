import dayjs from 'dayjs';
import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import { screen, render as baseRender } from 'src/test/test-utils';

import { DriverAvailabilityDto } from '../../../api/Client';
import { DriverAvailabilityEditor } from './driver-availability-editor';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) =>
     baseRender(<LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>, {
          theme: testTheme,
     });

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

const mockOnChange = vi.fn();

// --- Test data ---
const createSlot = (from: Date, until: Date): DriverAvailabilityDto => new DriverAvailabilityDto({ from, until });

// Freeze time to a fixed date for deterministic tests
const FIXED_DATE = '2024-01-15T12:00:00.000Z';
const tomorrow = dayjs('2024-01-16').startOf('day');
const slot1 = createSlot(tomorrow.hour(8).toDate(), tomorrow.hour(16).toDate());
const slot2 = createSlot(tomorrow.add(1, 'day').hour(9).toDate(), tomorrow.add(1, 'day').hour(17).toDate());

describe('DriverAvailabilityEditor', () => {
     beforeEach(() => {
          vi.setSystemTime(new Date(FIXED_DATE));
          vi.clearAllMocks();
     });

     afterEach(() => {
          vi.useRealTimers();
     });

     // --- Empty state ---
     it('should render title and date picker when no dates available', () => {
          render(<DriverAvailabilityEditor availableDates={[]} onChange={mockOnChange} />);

          expect(screen.getByText('drivers.available')).toBeInTheDocument();
          expect(screen.getByPlaceholderText('common.selectDate')).toBeInTheDocument();
     });

     // --- Display existing slots ---
     it('should display existing availability slots', () => {
          render(<DriverAvailabilityEditor availableDates={[slot1]} onChange={mockOnChange} />);

          // Should display the formatted date
          expect(screen.getByText(tomorrow.format('DD. MM. YYYY'))).toBeInTheDocument();
          // Should have from/until time pickers (label appears in both label and legend)
          expect(screen.getAllByText('common.from').length).toBeGreaterThanOrEqual(1);
          expect(screen.getAllByText('common.until').length).toBeGreaterThanOrEqual(1);
     });

     // --- Multiple slots ---
     it('should display multiple availability slots', () => {
          render(<DriverAvailabilityEditor availableDates={[slot1, slot2]} onChange={mockOnChange} />);

          expect(screen.getByText(tomorrow.format('DD. MM. YYYY'))).toBeInTheDocument();
          expect(screen.getByText(tomorrow.add(1, 'day').format('DD. MM. YYYY'))).toBeInTheDocument();
     });

     // --- Remove slot ---
     it('should render a delete button for each slot', () => {
          render(<DriverAvailabilityEditor availableDates={[slot1, slot2]} onChange={mockOnChange} />);

          // Each slot has a delete icon button inside a ListItem secondaryAction container
          const deleteButtons = document.querySelectorAll('.MuiListItemSecondaryAction-root .MuiIconButton-root');
          expect(deleteButtons.length).toBe(2);
     });

     // --- Overlapping detection ---
     it('should highlight overlapping slots', () => {
          const overlappingSlot1 = createSlot(tomorrow.hour(8).toDate(), tomorrow.hour(14).toDate());
          const overlappingSlot2 = createSlot(tomorrow.hour(12).toDate(), tomorrow.hour(18).toDate());

          render(
               <DriverAvailabilityEditor
                    availableDates={[overlappingSlot1, overlappingSlot2]}
                    onChange={mockOnChange}
               />
          );

          // Overlapping intervals should show the error helper text
          const errorTexts = screen.getAllByText('common.overlappingIntervals');
          expect(errorTexts.length).toBe(2);
     });

     // --- No overlap when slots don't overlap ---
     it('should not show overlap warning for non-overlapping slots', () => {
          render(<DriverAvailabilityEditor availableDates={[slot1, slot2]} onChange={mockOnChange} />);

          expect(screen.queryByText('common.overlappingIntervals')).not.toBeInTheDocument();
     });

     // --- Date picker placeholder ---
     it('should render a date picker input with placeholder', () => {
          render(<DriverAvailabilityEditor availableDates={[]} onChange={mockOnChange} />);

          const input = screen.getByPlaceholderText('common.selectDate');
          expect(input).toBeInTheDocument();
     });
});
