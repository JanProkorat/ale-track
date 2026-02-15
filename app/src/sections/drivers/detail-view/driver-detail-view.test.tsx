import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { DriverDetailView } from './driver-detail-view';

import type { DriverDto } from '../../../api/Client';

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

// Mock useApiCall
const mockExecuteApiCall = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
    }),
}));

// Mock AuthorizedClient
const mockGetDriverDetailEndpoint = vi.fn();
const mockCreateDriverEndpoint = vi.fn();
const mockUpdateDriverEndpoint = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        getDriverDetailEndpoint = mockGetDriverDetailEndpoint;
        createDriverEndpoint = mockCreateDriverEndpoint;
        updateDriverEndpoint = mockUpdateDriverEndpoint;
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

// Mock DriverAvailabilityEditor (heavy child – tested separately)
vi.mock('./driver-availability-editor', () => ({
    DriverAvailabilityEditor: () => (
        <div data-testid="driver-availability-editor">AvailabilityEditor</div>
    ),
}));

// Mock ColorPicker (heavy child with external dependencies)
vi.mock('../../../components/color/color-picker', () => ({
    ColorPicker: ({ color, onChange }: { color: string; onChange: (c: string) => void }) => (
        <input data-testid="color-picker" value={color} onChange={(e) => onChange(e.target.value)} />
    ),
}));

// --- Test data ---
const mockDriver: DriverDto = {
    id: 'driver-1',
    firstName: 'Jan',
    lastName: 'Novák',
    phoneNumber: '+420123456789',
    color: '#ff0000',
    availableDates: [],
    toJSON: () => ({}),
} as unknown as DriverDto;

const mockOnClose = vi.fn();

describe('DriverDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ==================== CREATE MODE (id=null) ====================

    describe('create mode (id=null)', () => {
        it('should render the form with empty fields', () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            expect(screen.getByText('drivers.detailTitle')).toBeInTheDocument();
            expect(screen.getByLabelText('drivers.firstName')).toHaveValue('');
            expect(screen.getByLabelText('drivers.lastName')).toHaveValue('');
            expect(screen.getByLabelText('drivers.phone')).toHaveValue('');
        });

        it('should render close and save buttons', () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'common.saveAndClose' })).toBeInTheDocument();
        });

        it('should allow typing a first name', () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            fireEvent.change(screen.getByLabelText('drivers.firstName'), {
                target: { value: 'Jan' },
            });

            expect(screen.getByLabelText('drivers.firstName')).toHaveValue('Jan');
        });

        it('should allow typing a last name', () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            fireEvent.change(screen.getByLabelText('drivers.lastName'), {
                target: { value: 'Novák' },
            });

            expect(screen.getByLabelText('drivers.lastName')).toHaveValue('Novák');
        });

        it('should allow typing a phone number', () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            fireEvent.change(screen.getByLabelText('drivers.phone'), {
                target: { value: '+420111222333' },
            });

            expect(screen.getByLabelText('drivers.phone')).toHaveValue('+420111222333');
        });

        it('should show validation error when saving with empty first name', async () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            // Fill only last name
            fireEvent.change(screen.getByLabelText('drivers.lastName'), {
                target: { value: 'Novák' },
            });

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
            });
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('should show validation error when saving with empty last name', async () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            // Fill only first name
            fireEvent.change(screen.getByLabelText('drivers.firstName'), {
                target: { value: 'Jan' },
            });

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
            });
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('should call create API and close on successful save', async () => {
            mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
            mockCreateDriverEndpoint.mockResolvedValue('new-id');

            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            fireEvent.change(screen.getByLabelText('drivers.firstName'), {
                target: { value: 'Jan' },
            });
            fireEvent.change(screen.getByLabelText('drivers.lastName'), {
                target: { value: 'Novák' },
            });

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockCreateDriverEndpoint).toHaveBeenCalled();
                expect(mockTriggerRefresh).toHaveBeenCalled();
                expect(mockShowSnackbar).toHaveBeenCalledWith('drivers.saveSuccess', 'success');
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('should not close when create API call fails', async () => {
            mockExecuteApiCall.mockResolvedValue(undefined);

            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            fireEvent.change(screen.getByLabelText('drivers.firstName'), {
                target: { value: 'Jan' },
            });
            fireEvent.change(screen.getByLabelText('drivers.lastName'), {
                target: { value: 'Novák' },
            });

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockOnClose).not.toHaveBeenCalled();
            });
        });

        it('should call onClose when close button is clicked', async () => {
            const user = (await import('@testing-library/user-event')).default.setup();
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            await user.click(screen.getByRole('button', { name: 'common.close' }));

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should render the availability editor', () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            expect(screen.getByTestId('driver-availability-editor')).toBeInTheDocument();
        });

        it('should render the color picker', () => {
            render(<DriverDetailView id={null} onClose={mockOnClose} />);

            expect(screen.getByTestId('color-picker')).toBeInTheDocument();
        });
    });

    // ==================== EDIT MODE (id=string) ====================

    describe('edit mode (id=string)', () => {
        beforeEach(() => {
            mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
            mockGetDriverDetailEndpoint.mockResolvedValue(mockDriver);
        });

        it('should fetch and display driver details on mount', async () => {
            render(<DriverDetailView id="driver-1" onClose={mockOnClose} />);

            await waitFor(() => {
                expect(mockGetDriverDetailEndpoint).toHaveBeenCalledWith('driver-1');
                expect(screen.getByLabelText('drivers.firstName')).toHaveValue('Jan');
                expect(screen.getByLabelText('drivers.lastName')).toHaveValue('Novák');
                expect(screen.getByLabelText('drivers.phone')).toHaveValue('+420123456789');
            });
        });

        it('should update first name when typing', async () => {
            render(<DriverDetailView id="driver-1" onClose={mockOnClose} />);

            await waitFor(() => {
                expect(screen.getByLabelText('drivers.firstName')).toHaveValue('Jan');
            });

            fireEvent.change(screen.getByLabelText('drivers.firstName'), {
                target: { value: 'Karel' },
            });

            expect(screen.getByLabelText('drivers.firstName')).toHaveValue('Karel');
        });

        it('should call update API when save button is clicked', async () => {
            mockUpdateDriverEndpoint.mockResolvedValue('ok');
            // For update, executeApiCall is called with an options object containing onError
            mockExecuteApiCall.mockImplementation(
                (fn: () => Promise<unknown>) => fn()
            );

            render(<DriverDetailView id="driver-1" onClose={mockOnClose} />);

            await waitFor(() => {
                expect(screen.getByLabelText('drivers.firstName')).toHaveValue('Jan');
            });

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockUpdateDriverEndpoint).toHaveBeenCalled();
                expect(mockShowSnackbar).toHaveBeenCalledWith('drivers.saveSuccess', 'success');
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('should not close when update API call fails', async () => {
            // First call is fetch (no opts) → return driver data
            // Second call is update (with opts.onError) → call onError
            let callCount = 0;
            mockExecuteApiCall.mockImplementation(
                (fn: () => Promise<unknown>, _?: unknown, opts?: { onError?: () => void }) => {
                    callCount += 1;
                    if (callCount === 1) {
                        // fetch call
                        return fn();
                    }
                    // update call — simulate error
                    if (opts?.onError) {
                        opts.onError();
                    }
                    return Promise.resolve(undefined);
                }
            );

            render(<DriverDetailView id="driver-1" onClose={mockOnClose} />);

            await waitFor(() => {
                expect(screen.getByLabelText('drivers.firstName')).toHaveValue('Jan');
            });

            await screen.getByRole('button', { name: 'common.saveAndClose' }).click();

            await waitFor(() => {
                expect(mockOnClose).not.toHaveBeenCalled();
            });
        });

        it('should show loading state while fetching', () => {
            // Never resolve → stays in loading state
            mockExecuteApiCall.mockReturnValue(new Promise(() => { }));

            render(<DriverDetailView id="driver-1" onClose={mockOnClose} />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
    });
});
