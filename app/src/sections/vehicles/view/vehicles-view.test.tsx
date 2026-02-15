import React from 'react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { VehicleDto } from 'src/api/Client';
import { screen, waitFor, fireEvent, renderWithProviders } from 'src/test/test-utils';

import { VehiclesView } from './vehicles-view';

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
    mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('../../../components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
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
const mockExecuteApiCallWithDefault = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
        executeApiCallWithDefault: mockExecuteApiCallWithDefault,
    }),
}));

const mockFetchVehicles = vi.fn();
const mockDeleteVehicle = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class {
        fetchVehicles = mockFetchVehicles;
        deleteVehicleEndpoint = mockDeleteVehicle;
    },
}));

vi.mock('../detail-view/vehicle-detail-view', () => ({
    VehicleDetailView: ({ id, onClose, onSave }: { id: string | null; onClose: () => void; onSave: () => void }) => (
        <div data-testid="vehicle-detail-view">
            <span>id:{id ?? 'null'}</span>
            <button onClick={onClose}>closeDetail</button>
            <button onClick={onSave}>saveDetail</button>
        </div>
    ),
}));

function createVehicles(): VehicleDto[] {
    return [
        new VehicleDto({ id: 'v1', name: 'Truck A', maxWeight: 1500 }),
        new VehicleDto({ id: 'v2', name: 'Van B', maxWeight: 2000 }),
    ];
}

describe('VehiclesView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCallWithDefault.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockFetchVehicles.mockResolvedValue(createVehicles());
    });

    it('should render the title', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('vehicles.title')).toBeInTheDocument();
        });
    });

    it('should render new vehicle button', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('vehicles.new')).toBeInTheDocument();
        });
    });

    it('should fetch and display vehicles in table', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('Truck A')).toBeInTheDocument();
        });

        expect(screen.getByText('Van B')).toBeInTheDocument();
    });

    it('should render table headers', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('vehicles.name')).toBeInTheDocument();
        });

        expect(screen.getByText('vehicles.maxWeight')).toBeInTheDocument();
    });

    it('should show empty state when no vehicles', async () => {
        mockFetchVehicles.mockResolvedValue([]);

        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('table.noDataTitle')).toBeInTheDocument();
        });
    });

    it('should render filter toolbar', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('vehicles.name...')).toBeInTheDocument();
        });
    });

    it('should open create drawer when new button is clicked', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('vehicles.new')).toBeInTheDocument();
        });

        screen.getByText('vehicles.new').click();

        await waitFor(() => {
            expect(screen.getByText('id:null')).toBeInTheDocument();
        });
    });

    it('should open detail drawer when row is clicked', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('Truck A')).toBeInTheDocument();
        });

        screen.getByText('Truck A').click();

        await waitFor(() => {
            expect(screen.getByText('id:v1')).toBeInTheDocument();
        });
    });

    it('should show delete confirmation dialog when delete is clicked', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('Truck A')).toBeInTheDocument();
        });

        const deleteButtons = screen.getAllByRole('button').filter(
            (btn: HTMLElement) => btn.querySelector('[data-testid="iconify"]')?.textContent === 'solar:trash-bin-trash-bold'
        );
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('vehicles.deleteConfirm')).toBeInTheDocument();
        });

        expect(screen.getByText('common.cancel')).toBeInTheDocument();
        expect(screen.getByText('common.delete')).toBeInTheDocument();
    });

    it('should delete vehicle when confirmed', async () => {
        mockDeleteVehicle.mockResolvedValue({});

        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('Truck A')).toBeInTheDocument();
        });

        const deleteButtons = screen.getAllByRole('button').filter(
            (btn: HTMLElement) => btn.querySelector('[data-testid="iconify"]')?.textContent === 'solar:trash-bin-trash-bold'
        );
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('vehicles.deleteConfirm')).toBeInTheDocument();
        });

        screen.getByText('common.delete').click();

        await waitFor(() => {
            expect(mockDeleteVehicle).toHaveBeenCalledWith('v1');
        });

        expect(mockShowSnackbar).toHaveBeenCalledWith('Vehicle deleted', 'success');
        expect(mockTriggerRefresh).toHaveBeenCalled();
    });

    it('should close delete dialog when cancel is clicked', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(screen.getByText('Truck A')).toBeInTheDocument();
        });

        const deleteButtons = screen.getAllByRole('button').filter(
            (btn: HTMLElement) => btn.querySelector('[data-testid="iconify"]')?.textContent === 'solar:trash-bin-trash-bold'
        );
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('vehicles.deleteConfirm')).toBeInTheDocument();
        });

        screen.getByText('common.cancel').click();

        await waitFor(() => {
            expect(screen.queryByText('vehicles.deleteConfirm')).not.toBeInTheDocument();
        });
    });

    it('should call fetchVehicles on mount', async () => {
        renderView(<VehiclesView />);

        await waitFor(() => {
            expect(mockFetchVehicles).toHaveBeenCalled();
        });
    });
});
