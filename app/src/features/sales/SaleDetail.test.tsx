// A sale is frozen once it leaves draft: its pieces already left the shelf, so every edit affordance
// has to be gone from the detail — the backend refuses these anyway, but app/CLAUDE.md requires the
// control be gated too. Confirming an invoice payment is the one action that stays live on a frozen
// record, and only while the sale is actually awaiting it.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import {
  InventoryItemListItemDto,
  InventorySectionDto,
  ProductKind,
  SaleBillingDetailDto,
  SaleDto,
  SaleItemDetailDto,
  SalePaymentMethod,
  SaleState,
} from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { SaleDetail } from './SaleDetail';

interface QueryLike {
  data?: SaleDto;
  isPending: boolean;
  isError: boolean;
  error?: unknown;
}

let saleResponse: QueryLike;
let inventoryResponse: { data?: InventorySectionDto[]; isPending: boolean; isSuccess: boolean };
const confirmPaymentMock = vi.fn();

/** Stock for the one item the fixture sale sells. */
function stocked(quantity: number) {
  return {
    data: [
      new InventorySectionDto({
        id: 'b1',
        name: 'Svijany',
        items: [
          new InventoryItemListItemDto({ id: 'in-maz', name: 'Svijansky Maz', quantity } as never),
        ],
      } as never),
    ],
    isPending: false,
    isSuccess: true,
  };
}

vi.mock('src/hooks/useSales', () => ({
  useSale: () => saleResponse,
  useCompleteSale: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSale: () => ({ mutate: vi.fn(), isPending: false }),
  useConfirmSalePayment: () => ({ mutate: confirmPaymentMock, isPending: false }),
}));
vi.mock('src/hooks/useInventory', () => ({
  useInventory: () => inventoryResponse,
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v: number) => `${v} Kč` }),
}));

function sale(overrides: Partial<SaleDto> = {}): SaleDto {
  return new SaleDto({
    id: 'sale-000018',
    saleDate: new Date('2026-08-13'),
    state: SaleState.Draft,
    payment: SalePaymentMethod.Cash,
    buyerName: 'Josef Vrána',
    items: [
      new SaleItemDetailDto({
        id: 'line-1',
        inventoryItemId: 'in-maz',
        name: 'Svijanský Máz',
        quantity: 2,
        unitPriceWithVat: 1850,
        listPriceWithVat: 1850,
      }),
    ],
    ...overrides,
  } as never);
}

function renderWith(data: SaleDto) {
  saleResponse = { data, isPending: false, isError: false };
  return render(
    <MemoryRouter>
      <MuiThemeProvider theme={theme}>
        <SaleDetail id="sale-000018" editable />
      </MuiThemeProvider>
    </MemoryRouter>
  );
}

describe('SaleDetail', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    confirmPaymentMock.mockClear();
    saleResponse = { data: undefined, isPending: true, isError: false };
    inventoryResponse = stocked(9);
  });

  it('leads with a back arrow and the state pill, not a Zpět button', () => {
    renderWith(sale({ state: SaleState.Completed }));

    const header = screen.getByTestId('detail-header');
    const back = within(header).getByRole('button', { name: 'Zpět na prodeje' });
    const pill = within(header).getByText('Dokončený');

    // No text button competing with the lifecycle actions on the right.
    expect(within(header).queryByRole('button', { name: /^Zpět$/ })).not.toBeInTheDocument();

    // Arrow, then number, then pill — all ahead of the actions, as on the shipment detail.
    const number = within(header).getByText('#000018');
    expect(back.compareDocumentPosition(number) & 4).toBeTruthy();
    expect(number.compareDocumentPosition(pill) & 4).toBeTruthy();
  });

  it('sends the way back when opening the buying client', () => {
    renderWith(
      sale({ clientId: 'cl-1', clientName: 'Pivnice Na Rohu', buyerName: undefined })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pivnice Na Rohu' }));

    // Without the location state the client's own arrow drops the user on /clients, which is the
    // bug this carries the fix for. ClientsPage reads it back through detailBackState.
    expect(navigateMock).toHaveBeenCalledWith('/clients/cl-1', {
      state: { backTo: '/sales/sale-000018', backLabel: 'Zpět na prodej' },
    });
  });

  it('badges each line with the packaging it was sold in', () => {
    renderWith(
      sale({
        items: [
          new SaleItemDetailDto({
            id: 'line-1',
            inventoryItemId: 'in-maz',
            name: 'Svijansky Maz',
            kind: ProductKind.Keg,
            packageSize: 30,
            quantity: 2,
            unitPriceWithVat: 1850,
          } as never),
          new SaleItemDetailDto({
            id: 'line-2',
            inventoryItemId: 'in-basy',
            name: 'Vratne basy',
            quantity: 1,
            unitPriceWithVat: 200,
          } as never),
        ],
      })
    );

    expect(screen.getByText('Sud')).toBeInTheDocument();

    // A free-form stock item has no product, so no packaging and no chip — not an "Ostatni"
    // placeholder that would read as a real classification.
    const freeFormRow = screen.getByText('Vratne basy').closest('tr') as HTMLElement;
    expect(within(freeFormRow).queryByText('Sud')).not.toBeInTheDocument();
    expect(within(freeFormRow).queryByText('Ostatni')).not.toBeInTheDocument();
  });

  it('offers the draft actions while the stock has not moved', () => {
    renderWith(sale());

    expect(screen.getByRole('button', { name: /Dokončit prodej/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upravit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Smazat/ })).toBeInTheDocument();
    expect(screen.getByText(/Zboží zatím nebylo odečteno ze skladu/)).toBeInTheDocument();
  });

  it('blocks finishing and says why when the shelf no longer covers a line', () => {
    inventoryResponse = stocked(1); // the draft sells 2
    renderWith(sale());

    expect(screen.getByText('Na skladě už není dost kusů')).toBeInTheDocument();
    expect(screen.getByText(/potřeba 2, skladem 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dokončit prodej/ })).toBeDisabled();

    // The offending line is called out where the goods are listed, not only in the banner.
    expect(screen.getByText(/skladem jen 1 — nelze vyskladnit/)).toBeInTheDocument();
  });

  it('treats a vanished stock row as uncompletable, as the backend does', () => {
    inventoryResponse = { data: [], isPending: false, isSuccess: true };
    renderWith(sale());

    expect(screen.getByRole('button', { name: /Dokončit prodej/ })).toBeDisabled();
    expect(screen.getByText(/skladem jen 0/)).toBeInTheDocument();
  });

  it('does not block while the stock check is still in flight', () => {
    // Mid-fetch every row looks absent; disabling on that would block a completable sale.
    inventoryResponse = { data: undefined, isPending: true, isSuccess: false };
    renderWith(sale());

    expect(screen.getByRole('button', { name: /Dokončit prodej/ })).toBeEnabled();
    expect(screen.queryByText('Na skladě už není dost kusů')).not.toBeInTheDocument();
  });

  it('does not measure a completed sale against the current shelf', () => {
    inventoryResponse = stocked(0);
    renderWith(sale({ state: SaleState.Completed }));

    expect(screen.queryByText('Na skladě už není dost kusů')).not.toBeInTheDocument();
    expect(screen.getByText('Vyskladněno')).toBeInTheDocument();
  });

  it('hides every edit affordance once the sale is completed', () => {
    renderWith(sale({ state: SaleState.Completed }));

    expect(screen.queryByRole('button', { name: /Dokončit prodej/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upravit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Smazat/ })).not.toBeInTheDocument();
    expect(screen.getByText('Vyskladněno')).toBeInTheDocument();
  });

  it('offers confirming the payment while the sale awaits it', () => {
    renderWith(
      sale({
        state: SaleState.AwaitingPayment,
        payment: SalePaymentMethod.Invoice,
        billing: new SaleBillingDetailDto({
          name: 'Na Rohu gastro s.r.o.',
          dueDate: new Date('2026-08-27'),
        } as never),
      })
    );

    const header = screen.getByTestId('detail-header');
    fireEvent.click(within(header).getByRole('button', { name: /Platba dorazila/ }));
    expect(confirmPaymentMock).toHaveBeenCalled();

    // The state reads as its own step, and the goods are already gone.
    expect(within(header).getByText('Čeká na platbu')).toBeInTheDocument();
    expect(screen.getByText('Vyskladněno, čeká na platbu')).toBeInTheDocument();
    expect(screen.getByText('nezaplaceno')).toBeInTheDocument();
  });

  it('does not offer confirming payment on a completed cash sale', () => {
    renderWith(sale({ state: SaleState.Completed }));

    expect(screen.queryByRole('button', { name: /Platba dorazila/ })).not.toBeInTheDocument();
  });

  it('does not offer confirming payment on an invoice already settled', () => {
    renderWith(
      sale({
        state: SaleState.Completed,
        payment: SalePaymentMethod.Invoice,
        billing: new SaleBillingDetailDto({ name: 'Na Rohu gastro s.r.o.', paidDate: new Date('2026-08-20') } as never),
      })
    );

    expect(screen.queryByRole('button', { name: /Platba dorazila/ })).not.toBeInTheDocument();
    expect(screen.getByText('zaplaceno')).toBeInTheDocument();
  });

  it('offers no paid/unpaid verdict on a draft invoice — nothing has been handed over', () => {
    renderWith(
      sale({
        payment: SalePaymentMethod.Invoice,
        billing: new SaleBillingDetailDto({ name: 'Na Rohu gastro s.r.o.' } as never),
      })
    );

    expect(screen.queryByText('nezaplaceno')).not.toBeInTheDocument();
    expect(screen.queryByText('zaplaceno')).not.toBeInTheDocument();
  });

  it('renders nothing editable for a viewer without edit rights', () => {
    saleResponse = { data: sale(), isPending: false, isError: false };
    render(
      <MemoryRouter>
        <MuiThemeProvider theme={theme}>
          <SaleDetail id="sale-000018" editable={false} />
        </MuiThemeProvider>
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /Dokončit prodej/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upravit/ })).not.toBeInTheDocument();
  });
});
