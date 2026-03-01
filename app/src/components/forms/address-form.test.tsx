import { it, vi, expect, describe, beforeEach } from 'vitest';

import { Country, AddressDto } from 'src/api/Client';
import { screen, render, fireEvent } from 'src/test/test-utils';

import { AddressForm } from './address-form';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

vi.mock('./collapsible-form', () => ({
     CollapsibleForm: ({ title, children }: { title: string; children: React.ReactNode }) => (
          <div data-testid="collapsible-form">
               <span>{title}</span>
               {children}
          </div>
     ),
}));

vi.mock('../map/map-view', () => ({
     MapView: ({ lat, lng }: { lat: number; lng: number }) => (
          <div data-testid="map-view">
               lat:{lat} lng:{lng}
          </div>
     ),
}));

vi.mock('../map/map-dialog', () => ({
     MapDialog: () => <div data-testid="map-dialog" />,
}));

vi.mock('src/providers/geo-location-provider', () => ({
     GeoLocationProvider: class {
          geocode = vi.fn().mockResolvedValue(null);
     },
}));

const mockOnChange = vi.fn();

function createAddress(overrides?: Partial<AddressDto>): AddressDto {
     return new AddressDto({
          streetName: 'Main St',
          streetNumber: '42',
          city: 'Prague',
          zip: '11000',
          country: Country.Czechia,
          ...overrides,
     });
}

describe('AddressForm', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render the title in collapsible form', () => {
          render(<AddressForm title="Delivery Address" address={undefined} errors={{}} onChange={mockOnChange} />);

          expect(screen.getByText('Delivery Address')).toBeInTheDocument();
     });

     it('should render street, number, city and zip fields', () => {
          render(<AddressForm title="Address" address={createAddress()} errors={{}} onChange={mockOnChange} />);

          expect(screen.getAllByText('address.street').length).toBeGreaterThan(0);
          expect(screen.getAllByText('address.number').length).toBeGreaterThan(0);
          expect(screen.getAllByText('address.city').length).toBeGreaterThan(0);
          expect(screen.getAllByText('address.zip').length).toBeGreaterThan(0);
     });

     it('should render country autocomplete', () => {
          render(<AddressForm title="Address" address={createAddress()} errors={{}} onChange={mockOnChange} />);

          expect(screen.getAllByText('address.country').length).toBeGreaterThan(0);
     });

     it('should populate fields with address values', () => {
          render(<AddressForm title="Address" address={createAddress()} errors={{}} onChange={mockOnChange} />);

          expect(screen.getByLabelText('address.street')).toHaveValue('Main St');
          expect(screen.getByLabelText('address.number')).toHaveValue('42');
          expect(screen.getByLabelText('address.city')).toHaveValue('Prague');
          expect(screen.getByLabelText('address.zip')).toHaveValue('11000');
     });

     it('should call onChange when street name is changed', () => {
          render(<AddressForm title="Address" address={createAddress()} errors={{}} onChange={mockOnChange} />);

          fireEvent.change(screen.getByLabelText('address.street'), { target: { value: 'New Street' } });

          expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ streetName: 'New Street' }));
     });

     it('should call onChange when city is changed', () => {
          render(<AddressForm title="Address" address={createAddress()} errors={{}} onChange={mockOnChange} />);

          fireEvent.change(screen.getByLabelText('address.city'), { target: { value: 'Berlin' } });

          expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ city: 'Berlin' }));
     });

     it('should show error messages for fields', () => {
          render(
               <AddressForm
                    title="Address"
                    address={createAddress({ streetName: '' })}
                    errors={{ streetName: 'Street is required', city: 'City is required' }}
                    onChange={mockOnChange}
               />
          );

          expect(screen.getByText('Street is required')).toBeInTheDocument();
          expect(screen.getByText('City is required')).toBeInTheDocument();
     });

     it('should render MapView component', () => {
          render(
               <AddressForm
                    title="Address"
                    address={createAddress({ latitude: 50.08, longitude: 14.44 })}
                    errors={{}}
                    onChange={mockOnChange}
               />
          );

          expect(screen.getByTestId('map-view')).toBeInTheDocument();
     });

     it('should render MapDialog component', () => {
          render(<AddressForm title="Address" address={createAddress()} errors={{}} onChange={mockOnChange} />);

          expect(screen.getByTestId('map-dialog')).toBeInTheDocument();
     });

     it('should render with empty address when undefined', () => {
          render(<AddressForm title="Address" address={undefined} errors={{}} onChange={mockOnChange} />);

          expect(screen.getByLabelText('address.street')).toHaveValue('');
          expect(screen.getByLabelText('address.city')).toHaveValue('');
     });
});
