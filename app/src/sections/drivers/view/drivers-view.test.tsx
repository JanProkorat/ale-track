import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { DriversView } from './drivers-view';

import type { DriverListItemDto, DriverAvailabilityListItemDto } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference to prevent useCallback dependency changes
const mockT = (key: string) => key;

// Mock react-i18next (partial to preserve initReactI18next)
vi.mock('react-i18next', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          useTranslation: () => ({ t: mockT }),
     };
});

// Mock useApiCall
const mockExecuteApiCall = vi.fn();
const mockExecuteApiCallWithDefault = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
     useApiCall: () => ({
          executeApiCall: mockExecuteApiCall,
          executeApiCallWithDefault: mockExecuteApiCallWithDefault,
     }),
}));

// Mock AuthorizedClient
const mockFetchDrivers = vi.fn();
const mockDeleteDriverEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class MockAuthorizedClient {
          fetchDrivers = mockFetchDrivers;
          deleteDriverEndpoint = mockDeleteDriverEndpoint;
          getDriverDetailEndpoint = vi.fn();
          createDriverEndpoint = vi.fn();
          updateDriverEndpoint = vi.fn();
     },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
     useSnackbar: () => ({
          showSnackbar: mockShowSnackbar,
     }),
}));

// Mock EntityStatsContext
const mockTriggerRefresh = vi.fn();
vi.mock('../../../providers/EntityStatsContext', () => ({
     useEntityStatsRefresh: () => ({
          triggerRefresh: mockTriggerRefresh,
     }),
}));

// Mock minimal-shared/utils (partial)
vi.mock('minimal-shared/utils', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          varAlpha: () => 'rgba(0,0,0,0.16)',
     };
});

// Mock DashboardContent
vi.mock('../../../layouts/dashboard', () => ({
     DashboardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock DriverDetailView (heavy child – tested separately)
vi.mock('../detail-view/driver-detail-view', () => ({
     DriverDetailView: (props: Record<string, unknown>) => (
          <div data-testid="driver-detail-view">{`Detail for ${props.id}`}</div>
     ),
}));

// Mock DriversAvailabilityCalendar (heavy child – tested separately)
vi.mock('./drivers-availability-calendar', () => ({
     DriversAvailabilityCalendar: () => <div data-testid="drivers-availability-calendar">Calendar</div>,
}));

// --- Test data ---
const mockDriverList: DriverListItemDto[] = [
     {
          id: 'driver-1',
          firstName: 'Jan',
          lastName: 'Novák',
          color: '#ff0000',
          availableDates: [] as DriverAvailabilityListItemDto[],
     } as DriverListItemDto,
     {
          id: 'driver-2',
          firstName: 'Petr',
          lastName: 'Svoboda',
          color: '#00ff00',
          availableDates: [] as DriverAvailabilityListItemDto[],
     } as DriverListItemDto,
];

describe('DriversView', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mockExecuteApiCallWithDefault.mockImplementation((apiCall: () => Promise<unknown>, defaultValue: unknown) =>
               apiCall().catch(() => defaultValue)
          );
          mockFetchDrivers.mockResolvedValue(mockDriverList);
     });

     // --- Title and new button ---
     it('should render the title and "new" button', async () => {
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('drivers.title')).toBeInTheDocument();
               expect(screen.getByRole('button', { name: /drivers\.new/i })).toBeInTheDocument();
          });
     });

     // --- Driver list in table ---
     it('should display drivers in the table', async () => {
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('Jan')).toBeInTheDocument();
               expect(screen.getByText('Novák')).toBeInTheDocument();
               expect(screen.getByText('Petr')).toBeInTheDocument();
               expect(screen.getByText('Svoboda')).toBeInTheDocument();
          });
     });

     // --- Table column headers ---
     it('should render table column headers', async () => {
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('drivers.firstName')).toBeInTheDocument();
               expect(screen.getByText('drivers.lastName')).toBeInTheDocument();
               expect(screen.getByText('drivers.color')).toBeInTheDocument();
          });
     });

     // --- Empty list ---
     it('should show empty state when no drivers exist', async () => {
          mockFetchDrivers.mockResolvedValue([]);

          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('table.noDataTitle')).toBeInTheDocument();
          });
     });

     // --- Filter by first name ---
     it('should refetch when filtering by first name', async () => {
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('Jan')).toBeInTheDocument();
          });

          const firstNameFilter = screen.getByPlaceholderText('drivers.firstName...');
          fireEvent.change(firstNameFilter, { target: { value: 'Jan' } });

          await waitFor(() => {
               // fetchDrivers should be called again with the filter
               expect(mockFetchDrivers).toHaveBeenCalledTimes(2);
          });
     });

     // --- Filter by last name ---
     it('should refetch when filtering by last name', async () => {
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('Jan')).toBeInTheDocument();
          });

          const lastNameFilter = screen.getByPlaceholderText('drivers.lastName...');
          fireEvent.change(lastNameFilter, { target: { value: 'Nov' } });

          await waitFor(() => {
               expect(mockFetchDrivers).toHaveBeenCalledTimes(2);
          });
     });

     // --- Open create drawer ---
     it('should open the create driver drawer when "new" button is clicked', async () => {
          const user = userEvent.setup();
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: /drivers\.new/i })).toBeInTheDocument();
          });

          await user.click(screen.getByRole('button', { name: /drivers\.new/i }));

          await waitFor(() => {
               expect(screen.getByTestId('driver-detail-view')).toBeInTheDocument();
          });
     });

     // --- Click row to open detail ---
     it('should open the driver detail drawer when a row is clicked', async () => {
          const user = userEvent.setup();
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('Jan')).toBeInTheDocument();
          });

          await user.click(screen.getByText('Jan'));

          await waitFor(() => {
               expect(screen.getByTestId('driver-detail-view')).toBeInTheDocument();
               expect(screen.getByText('Detail for driver-1')).toBeInTheDocument();
          });
     });

     // --- Delete confirmation dialog ---
     it('should show delete confirmation dialog when delete button is clicked', async () => {
          const user = userEvent.setup();
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('Jan')).toBeInTheDocument();
          });

          // Click the delete (error color) icon button on the first row
          const deleteButtons = document.querySelectorAll('.MuiIconButton-colorError');
          expect(deleteButtons.length).toBeGreaterThan(0);
          await user.click(deleteButtons[0] as HTMLElement);

          await waitFor(() => {
               expect(screen.getByText('drivers.deleteConfirm')).toBeInTheDocument();
               expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
               expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
          });
     });

     // --- Cancel delete ---
     it('should close delete dialog when cancel is clicked', async () => {
          const user = userEvent.setup();
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('Jan')).toBeInTheDocument();
          });

          const deleteButtons = document.querySelectorAll('.MuiIconButton-colorError');
          await user.click(deleteButtons[0] as HTMLElement);

          await waitFor(() => {
               expect(screen.getByText('drivers.deleteConfirm')).toBeInTheDocument();
          });

          await user.click(screen.getByRole('button', { name: 'common.cancel' }));

          await waitFor(() => {
               expect(screen.queryByText('drivers.deleteConfirm')).not.toBeInTheDocument();
          });
     });

     // --- Confirm delete ---
     it('should call delete API when delete is confirmed', async () => {
          const user = userEvent.setup();
          mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
          mockDeleteDriverEndpoint.mockResolvedValue('ok');

          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByText('Jan')).toBeInTheDocument();
          });

          const deleteButtons = document.querySelectorAll('.MuiIconButton-colorError');
          await user.click(deleteButtons[0] as HTMLElement);

          await waitFor(() => {
               expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
          });

          await user.click(screen.getByRole('button', { name: 'common.delete' }));

          await waitFor(() => {
               expect(mockDeleteDriverEndpoint).toHaveBeenCalledWith('driver-1');
               expect(mockTriggerRefresh).toHaveBeenCalled();
               expect(mockShowSnackbar).toHaveBeenCalledWith('drivers.deleteSuccess', 'success');
          });
     });

     // --- Availability calendar is rendered ---
     it('should render the availability calendar', async () => {
          render(<DriversView />);

          await waitFor(() => {
               expect(screen.getByTestId('drivers-availability-calendar')).toBeInTheDocument();
          });
     });
});
