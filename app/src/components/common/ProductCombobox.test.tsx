// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { ProductKind, ProductListItemDto } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { ProductCombobox } from './ProductCombobox';

vi.mock('src/hooks/useBreweries', () => ({
  useBreweryColors: () => (id?: string) => (id === 'b1' ? '#F08C00' : undefined),
}));

const products = [
  new ProductListItemDto({ id: 'sv-30', name: 'Svijanela Pomeranč', kind: ProductKind.Keg, packageSize: 30, breweryId: 'b1', breweryName: 'Svijany' }),
  new ProductListItemDto({ id: 'sv-50', name: 'Svijanela Pomeranč', kind: ProductKind.Keg, packageSize: 50, breweryId: 'b1', breweryName: 'Svijany' }),
  new ProductListItemDto({ id: 'pr-50', name: 'Rytířský 12', kind: ProductKind.Keg, packageSize: 50, breweryId: 'b2', breweryName: 'Primátor' }),
];

function setup(props: Partial<React.ComponentProps<typeof ProductCombobox>> = {}) {
  const onChange = vi.fn();
  render(
    <MuiThemeProvider theme={theme}>
      <ProductCombobox label="Produkt" value={null} onChange={onChange} products={products} {...props} />
    </MuiThemeProvider>,
  );
  fireEvent.click(screen.getByTitle('Open'));
  return { onChange };
}

const listbox = () => screen.getByRole('listbox');
/** Collapsed rows are kept while they animate out, so removal is asynchronous. */
const gone = (text: string) => waitFor(() =>
  expect(within(listbox()).queryByText(text)).not.toBeInTheDocument());

describe('ProductCombobox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders brewery heads, variant heads and one row per size', () => {
    setup();

    expect(within(listbox()).getByText('Svijany')).toBeInTheDocument();
    // Counts are products, not name groups: Svijany's two sizes count as two.
    expect(within(listbox()).getByText('2 produkty')).toBeInTheDocument();
    expect(within(listbox()).getByText('1 produkt')).toBeInTheDocument();
    expect(within(listbox()).getByText('Svijanela Pomeranč')).toBeInTheDocument();
    expect(within(listbox()).getByText('2 velikosti')).toBeInTheDocument();
    // The lone Primátor product carries its own name; the nested variants don't.
    expect(within(listbox()).getByText('Rytířský 12')).toBeInTheDocument();
    expect(within(listbox()).getAllByText('50 l')).toHaveLength(2);
  });

  it('collapses a brewery on click without closing the popup or picking a value', async () => {
    const { onChange } = setup();

    fireEvent.click(within(listbox()).getByText('Svijany'));
    await gone('Svijanela Pomeranč');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(within(listbox()).getByText('Svijany')).toBeInTheDocument();
    expect(within(listbox()).getByText('Primátor')).toBeInTheDocument();
  });

  it('collapses a variant group without touching its siblings', async () => {
    setup();

    fireEvent.click(within(listbox()).getByText('Svijanela Pomeranč'));
    await waitFor(() => expect(within(listbox()).getAllByText('50 l')).toHaveLength(1));

    expect(within(listbox()).getByText('Svijanela Pomeranč')).toBeInTheDocument();
    expect(within(listbox()).getByText('2 velikosti')).toBeInTheDocument();
    expect(within(listbox()).getByText('Rytířský 12')).toBeInTheDocument();
  });

  it('re-expands on a second click', () => {
    setup();

    fireEvent.click(within(listbox()).getByText('Svijany'));
    fireEvent.click(within(listbox()).getByText('Svijany'));

    expect(within(listbox()).getByText('Svijanela Pomeranč')).toBeInTheDocument();
  });

  // MUI keys options by getOptionLabel unless getOptionKey is given, and a real
  // brewery carries plenty of products with the same name *and* size (Svijany
  // has 105 products). The duplicate React keys that produced left collapsed
  // rows stranded in the listbox and duplicated them on the next expand — it
  // only shows up at this kind of scale, which is why the list here is big.
  describe('with a brewery whose products share names and sizes', () => {
    const many = (brewery: string, name: string, count: number, groups: number) =>
      Array.from({ length: count }, (_, i) => new ProductListItemDto({
        id: `${brewery}-${i}`,
        name: `${name} ${Math.floor(i / (count / groups))}`,
        kind: ProductKind.Can,
        packageSize: 0.5,
        breweryId: brewery,
        breweryName: brewery === 'b1' ? 'Svijany' : 'Primátor',
      }));
    // 105 Svijany in 15 name groups + 40 Primátor in 10: 172 rows all told.
    const big = [...many('b1', 'Svijanela', 105, 15), ...many('b2', 'Rytířský', 40, 10)];
    const rowCount = () => listbox().querySelectorAll('li').length;

    it('leaves nothing behind through a collapse/expand cycle', async () => {
      setup({ products: big });
      expect(rowCount()).toBe(172);

      fireEvent.click(within(listbox()).getByText('Svijany'));
      await waitFor(() => expect(rowCount()).toBe(52)); // Svijany's head + all of Primátor

      fireEvent.click(within(listbox()).getByText('Svijany'));
      expect(rowCount()).toBe(172);

      fireEvent.click(within(listbox()).getByText('Svijany'));
      fireEvent.click(within(listbox()).getByText('Primátor'));
      await waitFor(() => expect(rowCount()).toBe(2)); // both heads, nothing else
      // 172 rows through three animated collapse cycles is genuinely slow; it fits the 5 s default
      // alone but not alongside the rest of the suite, where it timed out rather than failed.
    }, 20_000);
  });

  it('reports the product id when a size row is picked', () => {
    const { onChange } = setup();

    fireEvent.click(within(listbox()).getAllByText('30 l')[0]);

    expect(onChange).toHaveBeenCalledWith('sv-30');
  });

  it('shows the trailing hint on the row it belongs to', () => {
    setup({ trailing: (p) => (p.id === 'sv-50' ? 'skladem 12 ks' : undefined) });

    expect(within(listbox()).getByText('skladem 12 ks')).toBeInTheDocument();
  });

  it('ignores collapse while searching so a hit is never hidden', () => {
    setup();

    fireEvent.click(within(listbox()).getByText('Svijany'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pomeranč' } });

    expect(within(listbox()).getByText('Svijanela Pomeranč')).toBeInTheDocument();
    expect(within(listbox()).queryByText('Primátor')).not.toBeInTheDocument();
  });

  it('keeps the closing rows around to animate, but inert', () => {
    setup();

    fireEvent.click(within(listbox()).getByText('Svijany'));

    // Still on screen for the slide-out...
    const row = within(listbox()).getByText('30 l').closest('li')!;
    expect(row).toBeInTheDocument();
    // ...but no longer selectable: MUI skips disabled options and blocks clicks
    // on them, so a shrinking row can't be picked by accident.
    expect(row).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the picked product in the input, not a head label', () => {
    setup();

    fireEvent.click(within(listbox()).getByText('Svijany'));

    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});
