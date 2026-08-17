// PriceWithList renders the price that actually counts wherever an order shows
// money. It is one shared component — ProductPricesPanel, the order catalog,
// the cart, and order detail all need the same mark, and near-copies would
// drift (ports the prototype's `priceCell`).

import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { theme } from 'src/theme/theme';

// A real thousands-separated formatter (not the trivial `${v} Kč` stub used
// elsewhere) so the test can assert on the actual rendered digits without
// depending on ICU/Intl behaviour in the test environment.
function fmt(v?: number | null): string {
  if (v == null) return '—';
  return `${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Kč`;
}

vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: fmt }),
}));

const { PriceWithList } = await import('./PriceWithList');

function renderPrice(price?: number | null, listPrice?: number | null) {
  return render(
    <ThemeProvider theme={theme}>
      <PriceWithList price={price} listPrice={listPrice} />
    </ThemeProvider>,
  );
}

describe('PriceWithList', () => {
  it('renders the price alone when there is no list price', () => {
    renderPrice(1290, null);

    expect(screen.queryByText(/1 290/)).toBeInTheDocument();
    // Not merely hidden — genuinely absent, so a compact row never reserves
    // space for a mark that will not appear.
    expect(document.querySelector('[data-list-price]')).toBeNull();
  });

  it('renders the list price struck through beside a client price', () => {
    renderPrice(1190, 1290);

    expect(screen.getByText(/1 190/)).toBeInTheDocument();
    expect(screen.getByTestId('list-price')).toHaveTextContent('1 290');
    expect(screen.getByTestId('list-price')).toHaveStyle('text-decoration: line-through');
  });
});
