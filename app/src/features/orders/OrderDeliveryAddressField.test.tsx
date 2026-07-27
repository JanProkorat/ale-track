import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryAddressKind } from 'src/generated/api-client';
import { OrderDeliveryAddressField } from './OrderDeliveryAddressField';

const place = { id: 'p1', name: 'Letní zahrádka', address: { latitude: 50.7, longitude: 15.05 } };

vi.mock('src/hooks/useClients', () => ({
  useClient: () => ({
    data: {
      officialAddress: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' },
      contactAddress: undefined,
    },
    isLoading: false,
  }),
}));

vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useClientDeliveryPlaces: () => ({ data: [place], isLoading: false }),
  // Rendered by this field's <DeliveryPlaceDialog>, which is mounted
  // (closed) whenever a client is selected — must still resolve to
  // something usable, same as DeliveryPlacesPanel.test.tsx.
  useCreateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('OrderDeliveryAddressField', () => {
  it('is disabled with no client selected', () => {
    render(<OrderDeliveryAddressField clientId={null} value={{ kind: DeliveryAddressKind.Official }} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });

  it("lists the client's saved places", () => {
    render(<OrderDeliveryAddressField clientId="c1" value={{ kind: DeliveryAddressKind.Official }} onChange={vi.fn()} />);
    // MUI Select opens on mouseDown, not click.
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getByText('Letní zahrádka')).toBeInTheDocument();
  });

  it('hides Kontaktní when the client has no contact address', () => {
    render(<OrderDeliveryAddressField clientId="c1" value={{ kind: DeliveryAddressKind.Official }} onChange={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.queryByText('Kontaktní')).not.toBeInTheDocument();
  });

  it('reports the decoded choice when a place is picked', () => {
    const onChange = vi.fn();
    render(<OrderDeliveryAddressField clientId="c1" value={{ kind: DeliveryAddressKind.Official }} onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Letní zahrádka'));
    expect(onChange).toHaveBeenCalledWith({ kind: DeliveryAddressKind.DeliveryPlace, placeId: 'p1' });
  });

  it('opens the new-place dialog from the sentinel option', () => {
    render(<OrderDeliveryAddressField clientId="c1" value={{ kind: DeliveryAddressKind.Official }} onChange={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('+ Nové místo…'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
