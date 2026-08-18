// The "Zboží od dodavatelů" card: what a run has to bring that no brewery supplies, grouped
// by where it is collected from — which is the order it is actually gathered in, and which
// pickup stop the route grew for it.

import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { OutgoingShipmentSupplierGoodDto, SupplierGoodPickupSource } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';

const { SupplierGoodsCard } = await import('./ShipmentDetail');

function good(over: Partial<OutgoingShipmentSupplierGoodDto> = {}): OutgoingShipmentSupplierGoodDto {
  return new OutgoingShipmentSupplierGoodDto({
    id: 'line-1',
    supplierGoodId: 'g-co2',
    name: 'CO₂ láhev',
    size: '10 kg',
    quantity: 2,
    pickupSource: SupplierGoodPickupSource.Supplier,
    supplierId: 's-linde',
    supplierName: 'Linde Gas',
    clientId: 'client-a',
    clientName: 'Hospoda A',
    orderId: 'order-1',
    ...over,
  });
}

function renderCard(goods: OutgoingShipmentSupplierGoodDto[], onOpenOrder?: (id: string) => void) {
  return render(
    <MuiThemeProvider theme={theme}>
      <SupplierGoodsCard goods={goods} onOpenOrder={onOpenOrder} />
    </MuiThemeProvider>,
  );
}

describe('SupplierGoodsCard', () => {
  it('renders nothing at all when no order on the run asks for any', () => {
    const { container } = renderCard([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists a good with its size, supplier, client and quantity', () => {
    renderCard([good()]);

    expect(screen.getByText('Zboží od dodavatelů')).toBeInTheDocument();
    expect(screen.getByText('CO₂ láhev')).toBeInTheDocument();
    expect(screen.getByText('10 kg')).toBeInTheDocument();
    expect(screen.getByText(/Linde Gas/)).toBeInTheDocument();
    expect(screen.getByText('Hospoda A')).toBeInTheDocument();
    // Twice over with a single line: once on the row, once as the header total.
    expect(screen.getAllByText('2 ks')).toHaveLength(2);
  });

  it('groups by where each good is collected from, naming both sources', () => {
    renderCard([
      good({ id: 'l-1', name: 'Přepravka', pickupSource: SupplierGoodPickupSource.Garage, supplierName: 'Obaly Morava' }),
      good({ id: 'l-2', name: 'CO₂ láhev', pickupSource: SupplierGoodPickupSource.Supplier }),
    ]);

    expect(screen.getByText('Z garáže')).toBeInTheDocument();
    expect(screen.getByText('Od dodavatele')).toBeInTheDocument();
  });

  it('keeps the order the server sent, so the card matches the picking order', () => {
    renderCard([
      good({ id: 'l-1', name: 'Přepravka', pickupSource: SupplierGoodPickupSource.Garage }),
      good({ id: 'l-2', name: 'CO₂ láhev', pickupSource: SupplierGoodPickupSource.Supplier }),
    ]);

    const headings = screen.getAllByText(/^(Z garáže|Od dodavatele)$/).map((el) => el.textContent);
    expect(headings).toEqual(['Z garáže', 'Od dodavatele']);
  });

  it('puts two goods from the same source under one heading', () => {
    renderCard([
      good({ id: 'l-1', name: 'CO₂ láhev', pickupSource: SupplierGoodPickupSource.Supplier }),
      good({ id: 'l-2', name: 'Dusík láhev', pickupSource: SupplierGoodPickupSource.Supplier }),
    ]);

    expect(screen.getAllByText('Od dodavatele')).toHaveLength(1);
    expect(screen.getByText('CO₂ láhev')).toBeInTheDocument();
    expect(screen.getByText('Dusík láhev')).toBeInTheDocument();
  });

  it('totals the pieces across every group in the header', () => {
    renderCard([
      good({ id: 'l-1', quantity: 2, pickupSource: SupplierGoodPickupSource.Garage }),
      good({ id: 'l-2', quantity: 5, pickupSource: SupplierGoodPickupSource.Supplier }),
    ]);

    const header = screen.getByText('Zboží od dodavatelů').closest('div') as HTMLElement;
    expect(within(header).getByText('7 ks')).toBeInTheDocument();
  });

  it('opens the order behind a line from the client name', () => {
    const onOpenOrder = vi.fn();
    renderCard([good()], onOpenOrder);

    fireEvent.click(screen.getByRole('button', { name: 'Hospoda A' }));

    expect(onOpenOrder).toHaveBeenCalledWith('order-1');
  });

  // The page omits the callback for a user who cannot see the Objednávky module; a link into
  // a screen ProtectedRoute would bounce them off is worse than no link.
  it('leaves the client name plain when the caller passes no handler', () => {
    renderCard([good()]);

    expect(screen.queryByRole('button', { name: 'Hospoda A' })).not.toBeInTheDocument();
    expect(screen.getByText('Hospoda A')).toBeInTheDocument();
  });

  it('shows a line note when the order line carries one', () => {
    renderCard([good({ note: 'Výměnou za prázdné' })]);

    expect(screen.getByText('Výměnou za prázdné')).toBeInTheDocument();
  });
});
