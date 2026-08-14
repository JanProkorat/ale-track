// The list is where an unpaid invoice has to catch the eye: an invoiced sale sits in "Čeká na
// platbu" until the money lands, and once it is past its due date the whole row is tinted rather
// than only the pill in the last column.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { SaleListItemDto, SalePaymentMethod, SaleState } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { SalesPage } from './SalesPage';

let salesResponse: { data?: SaleListItemDto[]; isPending: boolean; isError: boolean };

vi.mock('src/hooks/useSales', () => ({
  useSales: () => salesResponse,
}));
vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({ canEdit: () => true, canSee: () => true, can: () => true }),
}));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v: number) => `${v} Kč` }),
}));

/** Today is fixed so "overdue" does not depend on when the suite runs. */
const TODAY = new Date('2026-08-14T09:00:00Z');

function row(overrides: Partial<SaleListItemDto>): SaleListItemDto {
  return new SaleListItemDto({
    id: 'sale-1',
    saleDate: new Date('2026-08-01'),
    state: SaleState.Completed,
    payment: SalePaymentMethod.Cash,
    buyerName: 'Josef Vrána',
    totalQuantity: 2,
    totalPrice: 1000,
    ...overrides,
  } as never);
}

const overdue = row({
  id: 'sale-overdue',
  buyerName: 'Po splatnosti',
  state: SaleState.AwaitingPayment,
  payment: SalePaymentMethod.Invoice,
  dueDate: new Date('2026-08-10'),
});

const inTime = row({
  id: 'sale-in-time',
  buyerName: 'Ještě má čas',
  state: SaleState.AwaitingPayment,
  payment: SalePaymentMethod.Invoice,
  dueDate: new Date('2026-08-20'),
});

const settled = row({ id: 'sale-settled', buyerName: 'Zaplaceno' });

function renderList(rows: SaleListItemDto[]) {
  salesResponse = { data: rows, isPending: false, isError: false };
  return render(
    <MemoryRouter initialEntries={['/sales']}>
      <MuiThemeProvider theme={theme}>
        <SalesPage />
      </MuiThemeProvider>
    </MemoryRouter>
  );
}

const rowOf = (buyer: string) => screen.getByText(buyer).closest('tr') as HTMLElement;

describe('SalesPage list', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  it('tints only the rows whose invoice is past its due date', () => {
    renderList([overdue, inTime, settled]);

    expect(getComputedStyle(rowOf('Po splatnosti')).backgroundColor).toBeTruthy();
    // Awaiting payment is not by itself a problem — only being late is.
    expect(getComputedStyle(rowOf('Ještě má čas')).backgroundColor).toBeFalsy();
    expect(getComputedStyle(rowOf('Zaplaceno')).backgroundColor).toBeFalsy();

    expect(screen.getByText('po splatnosti 4 dny')).toBeInTheDocument();
  });

  it('reads unpaid off the state rather than the payment method', () => {
    renderList([overdue, settled]);

    expect(screen.getByText('Faktura · nezaplaceno')).toBeInTheDocument();
    expect(screen.getAllByText('Čeká na platbu')).not.toHaveLength(0);
  });

  it('keeps an awaiting-payment sale out of the Dokončené segment', () => {
    renderList([overdue, inTime, settled]);

    fireEvent.click(screen.getByRole('button', { name: /Dokončené/ }));

    expect(screen.getByText('Zaplaceno')).toBeInTheDocument();
    expect(screen.queryByText('Po splatnosti')).not.toBeInTheDocument();
    expect(screen.queryByText('Ještě má čas')).not.toBeInTheDocument();
  });

  it('collects both awaiting-payment sales under Nezaplacené', () => {
    renderList([overdue, inTime, settled]);

    fireEvent.click(screen.getByRole('button', { name: /Nezaplacené/ }));

    expect(screen.getByText('Po splatnosti')).toBeInTheDocument();
    expect(screen.getByText('Ještě má čas')).toBeInTheDocument();
    expect(screen.queryByText('Zaplaceno')).not.toBeInTheDocument();
  });
});
