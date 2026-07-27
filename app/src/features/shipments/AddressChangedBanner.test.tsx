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

  it('says the order disagrees for an overridden stop', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      { id: 'st1', clientName: 'A', addressChangedAt: stamped, isAddressOverridden: true } as unknown as OutgoingShipmentStopDto,
    ]} />);
    expect(screen.getByText(/jinou adresu/i)).toBeInTheDocument();
  });

  it('acknowledges on Rozumím', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      { id: 'st1', clientName: 'A', addressChangedAt: stamped, isAddressOverridden: false } as unknown as OutgoingShipmentStopDto,
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozumím' }));
    expect(mutateAsync).toHaveBeenCalledWith('s1');
  });
});
