import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import {
  GarageSalesRevenueReportDto,
  RevenueByPaymentDto,
  SalePaymentMethod,
  UnpaidInvoiceRowDto,
  type IGarageSalesRevenueReportDto,
} from 'src/generated/api-client';
import { RevenueTab } from './RevenueTab';

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (czk: number | null | undefined) => `${czk ?? 0} Kč` }),
}));

function renderTab(data: Partial<IGarageSalesRevenueReportDto>) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <RevenueTab
          data={
            new GarageSalesRevenueReportDto({
              totalRevenue: 0,
              salesCount: 0,
              averageSale: 0,
              totalUnits: 0,
              totalLitres: 0,
              trend: [],
              byPayment: [],
              unpaidInvoices: [],
              unpaidTotal: 0,
              ...data,
            })
          }
          granularity="week"
          onGranularityChange={() => {}}
        />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('RevenueTab', () => {
  it('renders the KPI row from the totals', () => {
    renderTab({ totalRevenue: 12500, salesCount: 8, averageSale: 1562.5, totalUnits: 40 });

    expect(screen.getByText('12500 Kč')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('40 ks')).toBeInTheDocument();
  });

  it('says everything is settled rather than rendering an empty invoice table', () => {
    renderTab({
      salesCount: 3,
      totalRevenue: 900,
      byPayment: [new RevenueByPaymentDto({ payment: SalePaymentMethod.Cash, revenue: 900, salesCount: 3 })],
    });

    expect(screen.getByText('Všechny faktury jsou uhrazené.')).toBeInTheDocument();
    expect(screen.queryByText('Odběratel')).not.toBeInTheDocument();
  });

  it('lists an outstanding invoice with its overdue state', () => {
    renderTab({
      salesCount: 1,
      totalRevenue: 2000,
      unpaidTotal: 2000,
      unpaidInvoices: [
        new UnpaidInvoiceRowDto({
          saleId: '11111111-1111-1111-1111-111111111111',
          saleDate: new Date('2026-04-02'),
          dueDate: new Date('2026-04-16'),
          buyerLabel: 'Hospoda U Kotvy',
          amount: 2000,
          daysOverdue: 122,
        }),
      ],
    });

    expect(screen.getByText('Hospoda U Kotvy')).toBeInTheDocument();
    expect(screen.getByText('Po splatnosti 122 dní')).toBeInTheDocument();
  });

  it('reads an invoice inside its terms as days remaining, not days overdue', () => {
    renderTab({
      salesCount: 1,
      unpaidInvoices: [
        new UnpaidInvoiceRowDto({
          saleId: '22222222-2222-2222-2222-222222222222',
          saleDate: new Date('2026-08-14'),
          dueDate: new Date('2026-08-28'),
          buyerLabel: 'Restaurace Na Rynku',
          amount: 500,
          daysOverdue: -12,
        }),
      ],
    });

    expect(screen.getByText('Do splatnosti 12 dní')).toBeInTheDocument();
  });

  // An anonymous cash-desk invoice records no name at all; the column must not go blank.
  it('names an unlabelled buyer rather than rendering an empty cell', () => {
    renderTab({
      salesCount: 1,
      unpaidInvoices: [
        new UnpaidInvoiceRowDto({
          saleId: '33333333-3333-3333-3333-333333333333',
          saleDate: new Date('2026-08-14'),
          amount: 500,
          daysOverdue: undefined,
        }),
      ],
    });

    expect(screen.getByText('Neuvedeno')).toBeInTheDocument();
    expect(screen.getByText('Bez splatnosti')).toBeInTheDocument();
  });

  it('shows the period empty-state when nothing sold and nothing is owed', () => {
    renderTab({});

    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
  });

  // The unpaid list is not window-bound, so an empty period must still surface what is owed.
  it('still shows outstanding invoices when the period itself is empty', () => {
    renderTab({
      unpaidTotal: 1000,
      unpaidInvoices: [
        new UnpaidInvoiceRowDto({
          saleId: '44444444-4444-4444-4444-444444444444',
          saleDate: new Date('2026-04-02'),
          dueDate: new Date('2026-04-16'),
          buyerLabel: 'Hospoda U Kotvy',
          amount: 1000,
          daysOverdue: 122,
        }),
      ],
    });

    expect(screen.queryByText('Za zvolené období nejsou žádná data.')).not.toBeInTheDocument();
    expect(screen.getByText('Hospoda U Kotvy')).toBeInTheDocument();
  });
});
