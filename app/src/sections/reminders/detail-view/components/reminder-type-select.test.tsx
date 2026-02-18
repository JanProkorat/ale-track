import { it, vi, expect, describe, beforeEach } from 'vitest';

import { ReminderType } from 'src/api/Client';
import { screen, render, within, fireEvent } from 'src/test/test-utils';

import { ReminderTypeSelect } from './reminder-type-select';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../../../utils/format-enum-value', () => ({
     mapEnumValue: <T,>(enumType: Record<string, unknown>, value: T | string | undefined): T | undefined => {
          if (value === undefined) return undefined;
          if (typeof value === 'number') return value as T;
          const numericValue = (enumType as Record<string, number>)[value as string];
          return numericValue !== undefined ? (numericValue as T) : undefined;
     },
}));

const mockOnSelect = vi.fn();

describe('ReminderTypeSelect', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render the label', () => {
          render(<ReminderTypeSelect selectedType={undefined} errors={{}} onSelect={mockOnSelect} />);

          expect(screen.getByText('reminders.type')).toBeInTheDocument();
     });

     it('should render a chip with the selected type', () => {
          render(<ReminderTypeSelect selectedType={ReminderType.OneTimeEvent} errors={{}} onSelect={mockOnSelect} />);

          expect(screen.getByText('reminderType.OneTimeEvent')).toBeInTheDocument();
     });

     it('should render all type options when opened', async () => {
          render(<ReminderTypeSelect selectedType={undefined} errors={{}} onSelect={mockOnSelect} />);

          const selectButton = screen.getByRole('combobox');
          fireEvent.mouseDown(selectButton);

          const listbox = await screen.findByRole('listbox');
          const options = within(listbox).getAllByRole('option');
          expect(options.length).toBeGreaterThan(0);
     });

     it('should call onSelect when an option is clicked', async () => {
          render(<ReminderTypeSelect selectedType={undefined} errors={{}} onSelect={mockOnSelect} />);

          const selectButton = screen.getByRole('combobox');
          fireEvent.mouseDown(selectButton);

          const listbox = await screen.findByRole('listbox');
          const options = within(listbox).getAllByRole('option');
          options[0].click();

          expect(mockOnSelect).toHaveBeenCalled();
     });

     it('should show error state when errors.type is set', () => {
          render(<ReminderTypeSelect selectedType={undefined} errors={{ type: 'Required' }} onSelect={mockOnSelect} />);

          const label = screen.getByText('reminders.type');
          expect(label).toHaveClass('Mui-error');
     });

     it('should be disabled when disabled prop is true', () => {
          render(<ReminderTypeSelect selectedType={undefined} errors={{}} onSelect={mockOnSelect} disabled />);

          const select = screen.getByRole('combobox');
          expect(select).toHaveAttribute('aria-disabled', 'true');
     });
});
