import React from 'react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, renderWithProviders } from 'src/test/test-utils';
import { ReminderType, ReminderDetailDto, ReminderRecurrenceType } from 'src/api/Client';

import { UpdateReminderView } from './update-reminder-view';

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
function renderView(ui: React.ReactElement) {
     return renderWithProviders(ui, { theme: cssVarsTheme });
}

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

vi.mock('minimal-shared/utils', () => ({
     varAlpha: () => 'rgba(0,0,0,0.16)',
}));

const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
     useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

const mockExecuteApiCall = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
     useApiCall: () => ({
          executeApiCall: mockExecuteApiCall,
     }),
}));

vi.mock('../../../utils/format-enum-value', () => ({
     mapEnumValue: <T,>(_enumType: Record<string, unknown>, value: T | string | undefined): T | undefined => {
          if (value === undefined) return undefined;
          if (typeof value === 'number') return value as T;
          const numericValue = (_enumType as Record<string, number>)[value as string];
          return numericValue !== undefined ? (numericValue as T) : undefined;
     },
}));

const mockGetReminderDetail = vi.fn();
const mockUpdateBreweryReminder = vi.fn();
const mockUpdateClientReminder = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class {
          getReminderDetailEndpoint = mockGetReminderDetail;
          updateBreweryReminderEndpoint = mockUpdateBreweryReminder;
          updateClientReminderEndpoint = mockUpdateClientReminder;
     },
}));

vi.mock('./components/days-of-week-picker', () => ({
     DaysOfWeekPicker: () => <div data-testid="days-of-week-picker" />,
}));

vi.mock('./components/days-of-month-picker', () => ({
     DaysOfMonthPicker: () => <div data-testid="days-of-month-picker" />,
}));

vi.mock('./components/reminder-date-picker', () => ({
     ReminderDatePicker: ({ label }: { label: string }) => <div data-testid="reminder-date-picker">{label}</div>,
}));

const mockOnClose = vi.fn();

function createMockDetail(overrides: Partial<ReminderDetailDto> = {}): ReminderDetailDto {
     return new ReminderDetailDto({
          id: 'r1',
          name: 'Test Reminder',
          description: 'Test Description',
          type: ReminderType.OneTimeEvent,
          occurrenceDate: new Date(2025, 5, 15),
          numberOfDaysToRemindBefore: 3,
          recurrenceType: undefined,
          daysOfWeek: [],
          daysOfMonth: [],
          activeUntil: undefined,
          ...overrides,
     });
}

describe('UpdateReminderView', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
     });

     it('should render loading state initially', () => {
          mockGetReminderDetail.mockReturnValue(new Promise(() => {}));

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          expect(screen.getByText('reminders.detailTitle')).toBeInTheDocument();
          expect(screen.getByRole('progressbar')).toBeInTheDocument();
     });

     it('should fetch and display reminder detail', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail());

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.name')).toHaveValue('Test Reminder');
          });

          expect(screen.getByLabelText('reminders.description')).toHaveValue('Test Description');
     });

     it('should render close and save buttons', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail());

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.name')).toHaveValue('Test Reminder');
          });

          expect(screen.getByText('common.close')).toBeInTheDocument();
          expect(screen.getByText('common.saveAndClose')).toBeInTheDocument();
     });

     it('should call onClose with false when close button is clicked', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail());

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.name')).toHaveValue('Test Reminder');
          });

          screen.getByText('common.close').click();

          expect(mockOnClose).toHaveBeenCalledWith(false);
     });

     it('should show validation error when saving with empty name', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail({ name: '' }));

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.name')).toHaveValue('');
          });

          screen.getByText('common.saveAndClose').click();

          await waitFor(() => {
               expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
          });
     });

     it('should call brewery API when parentType is brewery', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail());
          mockUpdateBreweryReminder.mockResolvedValue('ok');

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.name')).toHaveValue('Test Reminder');
          });

          screen.getByText('common.saveAndClose').click();

          await waitFor(() => {
               expect(mockUpdateBreweryReminder).toHaveBeenCalledWith('r1', expect.any(Object));
          });
     });

     it('should call client API when parentType is client', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail());
          mockUpdateClientReminder.mockResolvedValue('ok');

          renderView(<UpdateReminderView reminderId="r1" parentType="client" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.name')).toHaveValue('Test Reminder');
          });

          screen.getByText('common.saveAndClose').click();

          await waitFor(() => {
               expect(mockUpdateClientReminder).toHaveBeenCalledWith('r1', expect.any(Object));
          });
     });

     it('should call onClose with true after successful save', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail());
          mockUpdateBreweryReminder.mockResolvedValue('ok');

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.name')).toHaveValue('Test Reminder');
          });

          screen.getByText('common.saveAndClose').click();

          await waitFor(() => {
               expect(mockOnClose).toHaveBeenCalledWith(true);
          });
     });

     it('should not call onClose when save has error', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail());
          mockExecuteApiCall.mockImplementation((_fn: unknown, _default: unknown, opts?: { onError: () => void }) => {
               opts?.onError();
               return Promise.resolve(undefined);
          });

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.name')).toHaveValue('Test Reminder');
          });

          screen.getByText('common.saveAndClose').click();

          await waitFor(() => {
               expect(mockOnClose).not.toHaveBeenCalledWith(true);
          });
     });

     it('should show snackbar error when fetch fails', async () => {
          mockGetReminderDetail.mockRejectedValue(new Error('fail'));

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(mockShowSnackbar).toHaveBeenCalledWith('reminders.loadDetailError', 'error');
          });
     });

     it('should update description field', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail());

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByLabelText('reminders.description')).toHaveValue('Test Description');
          });

          fireEvent.change(screen.getByLabelText('reminders.description'), {
               target: { value: 'Updated Description' },
          });

          expect(screen.getByLabelText('reminders.description')).toHaveValue('Updated Description');
     });

     it('should render date picker for OneTimeEvent type', async () => {
          mockGetReminderDetail.mockResolvedValue(createMockDetail({ type: ReminderType.OneTimeEvent }));

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByText('reminders.occurrenceDate')).toBeInTheDocument();
          });
     });

     it('should render recurrence controls for Regular type', async () => {
          mockGetReminderDetail.mockResolvedValue(
               createMockDetail({
                    type: ReminderType.Regular,
                    recurrenceType: ReminderRecurrenceType.Weekly,
                    daysOfWeek: [1],
                    activeUntil: new Date(2025, 11, 31),
               })
          );

          renderView(<UpdateReminderView reminderId="r1" parentType="brewery" onClose={mockOnClose} />);

          await waitFor(() => {
               expect(screen.getByText('reminders.displaySettings')).toBeInTheDocument();
          });

          expect(screen.getByText('reminders.activeUntilDate')).toBeInTheDocument();
          expect(screen.getByTestId('days-of-week-picker')).toBeInTheDocument();
     });
});
