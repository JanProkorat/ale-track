// The Vratky card on the vývoz detail. Returns are owned by the orders on the
// route, so the card's whole job is grouping them per stop and staying out of
// the way when there are none.

import { render, screen, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';
import {
  OrderReturnDto,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { ReturnsCard } from './ShipmentDetail';

function orderStop(over: Partial<OutgoingShipmentStopDto> = {}): OutgoingShipmentStopDto {
  return new OutgoingShipmentStopDto({
    id: `stop-${Math.random().toString(36).slice(2, 8)}`,
    kind: OutgoingShipmentStopKind.Order,
    order: 1,
    clientId: 'client-a',
    clientName: 'Hospoda A',
    orderId: 'order-a',
    returns: [],
    ...over,
  });
}

function ret(name: string, quantity: number, note?: string): OrderReturnDto {
  return new OrderReturnDto({ id: `ret-${name}`, name, quantity, note });
}

function renderCard(stops: OutgoingShipmentStopDto[]) {
  return render(
    <MuiThemeProvider theme={theme}>
      <ReturnsCard stops={stops} />
    </MuiThemeProvider>,
  );
}

describe('ReturnsCard', () => {
  it('groups returns under the client of each stop', () => {
    renderCard([
      orderStop({
        order: 1,
        clientId: 'client-a',
        clientName: 'Hospoda A',
        returns: [ret('Sud 50 l', 4, 'Vadný ventil'), ret('Přepravka', 2)],
      }),
      orderStop({
        order: 2,
        clientId: 'client-b',
        clientName: 'Restaurace B',
        returns: [ret('Láhev 0,5 l', 20)],
      }),
    ]);

    expect(screen.getByText('Vratky')).toBeInTheDocument();

    // Each client heading owns only its own rows.
    const groupA = screen.getByText('Hospoda A').closest('div')!.parentElement!;
    expect(within(groupA).getByText('Sud 50 l')).toBeInTheDocument();
    expect(within(groupA).getByText('Přepravka')).toBeInTheDocument();
    expect(within(groupA).queryByText('Láhev 0,5 l')).not.toBeInTheDocument();

    expect(screen.getByText('Restaurace B')).toBeInTheDocument();
    expect(screen.getByText('Láhev 0,5 l')).toBeInTheDocument();
    expect(screen.getByText('20×')).toBeInTheDocument();
  });

  it('shows the note under the item name, and nothing when there is none', () => {
    renderCard([
      orderStop({ returns: [ret('Sud 50 l', 4, 'Vadný ventil'), ret('Přepravka', 2)] }),
    ]);

    expect(screen.getByText('Vadný ventil')).toBeInTheDocument();
    expect(screen.getByText('4×')).toBeInTheDocument();
    expect(screen.getByText('2×')).toBeInTheDocument();
  });

  it('skips stops that hand nothing back', () => {
    renderCard([
      orderStop({ clientName: 'Hospoda A', returns: [ret('Sud 50 l', 4)] }),
      orderStop({ clientName: 'Restaurace B', returns: [] }),
    ]);

    expect(screen.getByText('Hospoda A')).toBeInTheDocument();
    expect(screen.queryByText('Restaurace B')).not.toBeInTheDocument();
  });

  it('renders two groups when one client has two orders on the route', () => {
    renderCard([
      orderStop({ order: 1, clientName: 'Hospoda A', orderId: 'order-1', returns: [ret('Sud 50 l', 4)] }),
      orderStop({ order: 2, clientName: 'Hospoda A', orderId: 'order-2', returns: [ret('Přepravka', 6)] }),
    ]);

    expect(screen.getAllByText('Hospoda A')).toHaveLength(2);
  });

  it('renders nothing at all when no stop has returns', () => {
    const { container } = renderCard([
      orderStop({ returns: [] }),
      // A custom stop has no order, so the API never gives it returns.
      new OutgoingShipmentStopDto({
        id: 'stop-custom',
        kind: OutgoingShipmentStopKind.Custom,
        order: 2,
        label: 'Čerpací stanice',
        returns: [],
      }),
    ]);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Vratky')).not.toBeInTheDocument();
  });
});
