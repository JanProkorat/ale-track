// A driver's shipment detail: the Vykládka view as the loading card's only content,
// and no Fakturace section. Both are conditional chrome the component alone decides,
// which is what earns this a rendering test rather than a pure-logic one.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import {
  OutgoingShipmentDetailDto,
  OutgoingShipmentState,
  OutgoingShipmentStopDto,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { ShipmentDetail } from './ShipmentDetail';

const listQuery = { data: [], isLoading: false, isPending: false, isError: false };
const noMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock('src/hooks/useShipments', () => ({
  useUpdateShipment: () => noMutation,
  useSetPreparationStep: () => noMutation,
  useSetShipmentState: () => noMutation,
  useSetOrderItemSourcing: () => noMutation,
  useSetStockPurchase: () => noMutation,
  useExportShipment: () => noMutation,
  useShipmentStartPoints: () => listQuery,
  // Reached through AddressChangedBanner rather than the detail itself.
  useAcknowledgeAddressChanges: () => noMutation,
}));
vi.mock('src/hooks/useInventory', () => ({ useInventory: () => listQuery }));
vi.mock('src/hooks/useProducts', () => ({ useProducts: () => listQuery }));
vi.mock('src/hooks/useBreweries', () => ({ useBreweryColors: () => ({}) }));
vi.mock('src/hooks/usePurchaseInvoices', () => ({
  useAddPurchaseInvoice: () => noMutation,
  useDeletePurchaseInvoice: () => noMutation,
  useSetLoadingState: () => noMutation,
  useSetPurchaseInvoiceLine: () => noMutation,
}));

// Leaflet needs a real layout box; the map is irrelevant to what is asserted here.
vi.mock('src/components/common/RouteMap', () => ({ RouteMap: () => <div data-testid="route-map" /> }));
// Stands in for the Fakturace section so its presence is a single unambiguous probe
// and no invoices query has to be mocked.
vi.mock('./ShipmentInvoicing', () => ({
  ShipmentInvoicing: () => <div data-testid="shipment-invoicing" />,
}));

const shipment = new OutgoingShipmentDetailDto({
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Vývoz na severu',
  state: OutgoingShipmentState.Created,
  deliveryDate: new Date('2026-08-20T08:00:00Z'),
  stops: [
    new OutgoingShipmentStopDto({
      id: '22222222-2222-2222-2222-222222222222',
      order: 1,
      clientName: 'Hospoda U Kotvy',
      products: [],
      returns: [],
    }),
  ],
  purchaseInvoices: [],
  stockPurchases: [],
  loadingStates: [],
  preparationSteps: [],
});

function renderDetail(props: Partial<Parameters<typeof ShipmentDetail>[0]> = {}) {
  return render(
    <MemoryRouter>
      <MuiThemeProvider theme={theme}>
        <ShipmentDetail
          shipment={shipment}
          editable={false}
          onBack={() => {}}
          onEdit={() => {}}
          {...props}
        />
      </MuiThemeProvider>
    </MemoryRouter>,
  );
}

describe('ShipmentDetail for a driver', () => {
  it('drops the Fakturace section', () => {
    renderDetail({ canSeeInvoicing: false, canSeeLoadingBreakdown: false });

    expect(screen.queryByTestId('shipment-invoicing')).toBeNull();
  });

  it('drops the invoice-filter tabs and shows the unload view instead', () => {
    renderDetail({ canSeeInvoicing: false, canSeeLoadingBreakdown: false });

    expect(screen.queryByRole('button', { name: 'Vše' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vykládka' })).toBeNull();
    // The unload view names each stop; the aggregated table never renders a client.
    expect(screen.getByText('Hospoda U Kotvy')).toBeInTheDocument();
  });

  it('keeps both for a user who has the capabilities', () => {
    renderDetail({ canSeeInvoicing: true, canSeeLoadingBreakdown: true });

    expect(screen.getByTestId('shipment-invoicing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vše' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vykládka' })).toBeInTheDocument();
  });
});
