import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import {
  BuyerClientRowDto,
  BuyerKindRowDto,
  GarageSalesBuyersReportDto,
  SaleBuyerKind,
  type IGarageSalesBuyersReportDto,
} from 'src/generated/api-client';
import { BuyersTab } from './BuyersTab';

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => `${czk ?? 0} Kč` }),
}));

function renderTab(data: Partial<IGarageSalesBuyersReportDto>) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <BuyersTab
          data={
            new GarageSalesBuyersReportDto({
              byBuyerKind: [],
              topClients: [],
              repeatBuyers: 0,
              oneTimeBuyers: 0,
              ...data,
            })
          }
        />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('BuyersTab', () => {
  it('lists top clients with their last purchase', () => {
    renderTab({
      byBuyerKind: [new BuyerKindRowDto({ buyerKind: SaleBuyerKind.Client, revenue: 1000, salesCount: 2 })],
      topClients: [
        new BuyerClientRowDto({
          clientId: '11111111-1111-1111-1111-111111111111',
          clientName: 'Hospoda U Kotvy',
          salesCount: 2,
          revenue: 1000,
          lastPurchase: new Date('2026-08-20'),
        }),
      ],
      repeatBuyers: 1,
    });

    expect(screen.getAllByText('Hospoda U Kotvy').length).toBeGreaterThan(0);
    expect(screen.getByText('Opakovaní kupující')).toBeInTheDocument();
  });

  // Walk-ins have no client record, so the table has nothing to link to — the tab must
  // still render its split rather than an empty client table.
  it('renders the walk-in bucket without a client table', () => {
    renderTab({
      byBuyerKind: [new BuyerKindRowDto({ buyerKind: SaleBuyerKind.Walkin, revenue: 600, salesCount: 3 })],
      oneTimeBuyers: 0,
    });

    expect(screen.getByText('Za zvolené období nakoupili jen jednorázoví kupující.')).toBeInTheDocument();
    expect(screen.queryByText('Podíl')).not.toBeInTheDocument();
  });

  it('shows the empty-state when nobody bought anything', () => {
    renderTab({});

    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
  });

  it('computes the client share of revenue against both buyer kinds', () => {
    renderTab({
      byBuyerKind: [
        new BuyerKindRowDto({ buyerKind: SaleBuyerKind.Client, revenue: 750, salesCount: 1 }),
        new BuyerKindRowDto({ buyerKind: SaleBuyerKind.Walkin, revenue: 250, salesCount: 1 }),
      ],
      topClients: [
        new BuyerClientRowDto({
          clientId: '11111111-1111-1111-1111-111111111111',
          clientName: 'Hospoda U Kotvy',
          salesCount: 1,
          revenue: 750,
          lastPurchase: new Date('2026-08-20'),
        }),
      ],
      oneTimeBuyers: 1,
    });

    expect(screen.getByText('Podíl klientů na tržbě')).toBeInTheDocument();
    expect(screen.getAllByText('75,0 %').length).toBeGreaterThan(0);
  });
});
