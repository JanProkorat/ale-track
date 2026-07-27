import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

// Mutable so individual tests can exercise the places query's in-flight state
// (isGone must not fire while it's still loading — see the isGone tests
// below) without a mock that is always the happy path.
let placesData: typeof place[] = [place];
let placesLoading = false;

vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useClientDeliveryPlaces: () => ({ data: placesData, isLoading: placesLoading }),
  // Rendered by this field's <DeliveryPlaceDialog>, which is mounted
  // (closed) whenever a client is selected — must still resolve to
  // something usable, same as DeliveryPlacesPanel.test.tsx.
  useCreateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDeliveryPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

beforeEach(() => {
  placesData = [place];
  placesLoading = false;
});

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

  describe('a place soft-deleted since the order chose it', () => {
    beforeEach(() => {
      // 'gone-id' is not in the client's current (non-deleted) places list.
      placesData = [place];
    });

    it('labels the disabled entry with the real place name, not a generic placeholder', () => {
      render(<OrderDeliveryAddressField
        clientId="c1"
        value={{ kind: DeliveryAddressKind.DeliveryPlace, placeId: 'gone-id' }}
        onChange={vi.fn()}
        deletedPlaceName="Zrušená hospůdka"
      />);
      fireEvent.mouseDown(screen.getByRole('combobox'));
      const listbox = screen.getByRole('listbox');
      const option = within(listbox).getByText('Zrušená hospůdka (smazáno)');
      expect(option).toBeInTheDocument();
      expect(option.closest('[role="option"]')).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not flash "gone" while the places query is still in flight', () => {
      placesLoading = true;
      placesData = [];
      render(<OrderDeliveryAddressField
        clientId="c1"
        value={{ kind: DeliveryAddressKind.DeliveryPlace, placeId: 'p1' }}
        onChange={vi.fn()}
        deletedPlaceName="Letní zahrádka"
      />);
      fireEvent.mouseDown(screen.getByRole('combobox'));
      expect(screen.queryByText('Smazané')).not.toBeInTheDocument();
      expect(screen.queryByText(/\(smazáno\)/)).not.toBeInTheDocument();
    });
  });
});
