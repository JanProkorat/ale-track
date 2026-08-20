import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { OutgoingShipmentState } from 'src/generated/api-client';
import { OperationalTab } from './OperationalTab';

const data = {
  totalShipments: 20,
  totalStops: 34,
  onTimePercentage: 91,
  returnableUnits: 102,
  activeDrivers: 3,
  shipmentsByState: [
    { state: OutgoingShipmentState.Delivered, count: 17 },
    { state: OutgoingShipmentState.InTransit, count: 2 },
    { state: OutgoingShipmentState.Cancelled, count: 1 },
  ],
  incomingVsOutgoing: [
    { month: '2026-06-01', incomingWeightKg: 8000, outgoingWeightKg: 7400 },
    { month: '2026-07-01', incomingWeightKg: 9000, outgoingWeightKg: 12400 },
  ],
  byDriver: [
    { driverId: 'd1', driverName: 'Jan Novák', color: '#0072B2', deliveredShipments: 9 },
    { driverId: 'd2', driverName: 'Petr Malý', color: '#009E73', deliveredShipments: 8 },
  ],
} as never;

function renderTab(overrides: Record<string, unknown> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <OperationalTab data={{ ...(data as object), ...overrides } as never} />
    </ThemeProvider>
  );
}

describe('OperationalTab', () => {
  it('shows the four prototype KPIs with the stops hint', () => {
    renderTab();

    expect(screen.getByText('Vývozů celkem')).toBeInTheDocument();
    expect(screen.getByText('34 zastávek')).toBeInTheDocument();
    expect(screen.getByText('Doručeno včas')).toBeInTheDocument();
    // Twice on purpose: the KPI states it and the gauge repeats it in its centre. The
    // gauge is the only place the figure is legible without reading a colour, so the
    // two must not drift apart.
    expect(screen.getAllByText('91 %')).toHaveLength(2);
    expect(screen.getByText('Vratných obalů')).toBeInTheDocument();
    expect(screen.getByText('102 ks')).toBeInTheDocument();
    expect(screen.getByText('Aktivních řidičů')).toBeInTheDocument();
  });

  it('labels every shipment state in the legend, so colour is never the only cue', () => {
    renderTab();

    expect(screen.getByText('Doručeno')).toBeInTheDocument();
    expect(screen.getByText('Na cestě')).toBeInTheDocument();
    expect(screen.getByText('Zrušeno')).toBeInTheDocument();
  });

  it('names both series of the incoming-vs-outgoing chart', () => {
    renderTab();

    expect(screen.getByText('Dovoz')).toBeInTheDocument();
    expect(screen.getByText('Vývoz')).toBeInTheDocument();
  });

  it('labels the months of the incoming-vs-outgoing chart in Czech', () => {
    renderTab();

    expect(screen.getByText('čvn')).toBeInTheDocument();
    expect(screen.getByText('čvc')).toBeInTheDocument();
  });

  it('lists drivers with their delivered counts', () => {
    renderTab();

    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    expect(screen.getByText('Petr Malý')).toBeInTheDocument();
  });

  it('renders an empty state for a window with no shipments', () => {
    renderTab({
      totalShipments: 0, totalStops: 0, onTimePercentage: 0, returnableUnits: 0,
      activeDrivers: 0, shipmentsByState: [], incomingVsOutgoing: [], byDriver: [],
    });

    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
    expect(screen.getByText('0 %')).toBeInTheDocument();
  });
});
