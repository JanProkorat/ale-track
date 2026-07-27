import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OutgoingShipmentStopDto } from 'src/generated/api-client';
import { AddressChangedBanner } from './AddressChangedBanner';

const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('src/hooks/useShipments', () => ({
  useAcknowledgeAddressChanges: () => ({ mutateAsync, isPending: false }),
}));

const stamped = '2026-07-27T09:00:00Z';

describe('AddressChangedBanner', () => {
  it('renders nothing when no stop has a pending change', () => {
    const { container } = render(<AddressChangedBanner shipmentId="s1" stops={[{ id: 'st1', clientName: 'A' } as OutgoingShipmentStopDto]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the address was updated for an inherited stop', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      { id: 'st1', clientName: 'A', addressChangedAt: stamped, isAddressOverridden: false } as unknown as OutgoingShipmentStopDto,
    ]} />);
    expect(screen.getByText(/aktualizována/i)).toBeInTheDocument();
  });

  it('says the order disagrees for an overridden stop and names the street address it now wants', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      {
        id: 'st1',
        clientName: 'A',
        addressChangedAt: stamped,
        isAddressOverridden: true,
        orderDeliveryAddress: {
          address: { streetName: 'Nábřežní', streetNumber: '3', zip: '02763', city: 'Žitava' },
        },
      } as unknown as OutgoingShipmentStopDto,
    ]} />);
    expect(screen.getByText(/jinou adresu/i)).toBeInTheDocument();
    expect(screen.getByText(/Nábřežní 3, 02763 Žitava/)).toBeInTheDocument();
  });

  it('names the saved place alongside its address when the order\'s own choice is a delivery place', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      {
        id: 'st1',
        clientName: 'A',
        addressChangedAt: stamped,
        isAddressOverridden: true,
        orderDeliveryAddress: {
          placeName: 'Sklad Liberec',
          address: { streetName: 'Skladová', streetNumber: '1', zip: '46001', city: 'Liberec' },
        },
      } as unknown as OutgoingShipmentStopDto,
    ]} />);
    expect(screen.getByText(/Sklad Liberec · Skladová 1, 46001 Liberec/)).toBeInTheDocument();
  });

  it('acknowledges on Rozumím', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      { id: 'st1', clientName: 'A', addressChangedAt: stamped, isAddressOverridden: false } as unknown as OutgoingShipmentStopDto,
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozumím' }));
    expect(mutateAsync).toHaveBeenCalledWith('s1');
  });
});
