import React from 'react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { VehicleDto } from 'src/api/Client';
import { screen, waitFor, fireEvent, renderWithProviders } from 'src/test/test-utils';

import { VehicleDetailView } from './vehicle-detail-view';

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
function render(ui: React.ReactElement) {
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

const mockTriggerRefresh = vi.fn();
vi.mock('../../../providers/EntityStatsContext', () => ({
    useEntityStatsRefresh: () => ({ triggerRefresh: mockTriggerRefresh }),
}));

const mockExecuteApiCall = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
    }),
}));

const mockGetVehicleDetail = vi.fn();
const mockCreateVehicle = vi.fn();
const mockUpdateVehicle = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class {
        getVehicleDetailEndpoint = mockGetVehicleDetail;
        createVehicleEndpoint = mockCreateVehicle;
        updateVehicleEndpoint = mockUpdateVehicle;
    },
}));

const mockOnClose = vi.fn();
const mockOnSave = vi.fn();

describe('VehicleDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
    });

    it('should render the drawer title', () => {
        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('vehicles.detailTitle')).toBeInTheDocument();
    });

    it('should render close and save buttons', () => {
        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('common.close')).toBeInTheDocument();
        expect(screen.getByText('common.saveAndClose')).toBeInTheDocument();
    });

    it('should render name and maxWeight fields', () => {
        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getAllByText('vehicles.name').length).toBeGreaterThan(0);
        expect(screen.getAllByText('vehicles.maxWeight').length).toBeGreaterThan(0);
    });

    it('should call onClose when close button is clicked', () => {
        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        screen.getByText('common.close').click();

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should show validation errors when saving with empty fields', async () => {
        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });

        expect(screen.getAllByText('common.required').length).toBeGreaterThan(0);
    });

    it('should call createVehicleEndpoint when saving with id=null', async () => {
        mockCreateVehicle.mockResolvedValue({ id: 'new-id' });

        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('vehicles.name'), { target: { value: 'Truck A' } });
        fireEvent.change(screen.getByLabelText('vehicles.maxWeight'), { target: { value: '1500' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockCreateVehicle).toHaveBeenCalled();
        });
    });

    it('should call onSave and show success snackbar after create', async () => {
        mockCreateVehicle.mockResolvedValue({ id: 'new-id' });

        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('vehicles.name'), { target: { value: 'Truck A' } });
        fireEvent.change(screen.getByLabelText('vehicles.maxWeight'), { target: { value: '1500' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('vehicles.saveSuccess', 'success');
        });

        expect(mockOnSave).toHaveBeenCalled();
    });

    it('should trigger entity stats refresh after create', async () => {
        mockCreateVehicle.mockResolvedValue({ id: 'new-id' });

        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('vehicles.name'), { target: { value: 'Truck A' } });
        fireEvent.change(screen.getByLabelText('vehicles.maxWeight'), { target: { value: '1500' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockTriggerRefresh).toHaveBeenCalled();
        });
    });

    it('should fetch vehicle detail when id is provided', async () => {
        const vehicleDetail = new VehicleDto({ id: 'v1', name: 'Van B', maxWeight: 2000 });
        mockGetVehicleDetail.mockResolvedValue(vehicleDetail);

        render(<VehicleDetailView id="v1" onClose={mockOnClose} onSave={mockOnSave} />);

        await waitFor(() => {
            expect(mockGetVehicleDetail).toHaveBeenCalledWith('v1');
        });

        expect(screen.getByLabelText('vehicles.name')).toHaveValue('Van B');
        expect(screen.getByLabelText('vehicles.maxWeight')).toHaveValue(2000);
    });

    it('should call updateVehicleEndpoint when saving with existing id', async () => {
        const vehicleDetail = new VehicleDto({ id: 'v1', name: 'Van B', maxWeight: 2000 });
        mockGetVehicleDetail.mockResolvedValue(vehicleDetail);
        mockUpdateVehicle.mockResolvedValue({});

        render(<VehicleDetailView id="v1" onClose={mockOnClose} onSave={mockOnSave} />);

        await waitFor(() => {
            expect(screen.getByLabelText('vehicles.name')).toHaveValue('Van B');
        });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockUpdateVehicle).toHaveBeenCalledWith('v1', expect.any(Object));
        });

        expect(mockShowSnackbar).toHaveBeenCalledWith('vehicles.saveSuccess', 'success');
        expect(mockOnSave).toHaveBeenCalled();
    });

    it('should not call onSave when update has error', async () => {
        const vehicleDetail = new VehicleDto({ id: 'v1', name: 'Van B', maxWeight: 2000 });
        mockGetVehicleDetail.mockResolvedValue(vehicleDetail);

        mockExecuteApiCall.mockImplementation(
            (_fn: () => Promise<unknown>, _default: unknown, opts?: { onError: () => void }) => {
                if (opts?.onError) {
                    opts.onError();
                    return Promise.resolve(undefined);
                }
                return _fn();
            }
        );

        render(<VehicleDetailView id="v1" onClose={mockOnClose} onSave={mockOnSave} />);

        await waitFor(() => {
            expect(screen.getByLabelText('vehicles.name')).toHaveValue('Van B');
        });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockUpdateVehicle).not.toHaveBeenCalled();
        });

        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should render Kg adornment on maxWeight field', () => {
        render(<VehicleDetailView id={null} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('Kg')).toBeInTheDocument();
    });
});
