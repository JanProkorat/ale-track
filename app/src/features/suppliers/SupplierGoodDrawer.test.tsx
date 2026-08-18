// What only the drawer decides: that a good cannot be saved without a price, that two
// prices for the same purpose are refused before the request, and that an edit arrives
// pre-filled with the rows it is editing. fireEvent — user-event is not a dependency.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { SupplierChargeKind, SupplierGoodDto, SupplierGoodPriceDto } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { SupplierGoodDrawer } from './SupplierGoodDrawer';

const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock('src/hooks/useSuppliers', () => ({
  useCreateSupplierGood: () => ({ mutateAsync: createMock, isPending: false }),
  useUpdateSupplierGood: () => ({ mutateAsync: updateMock, isPending: false }),
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const EXISTING = new SupplierGoodDto({
  id: 'sg-1',
  name: 'CO₂ láhev',
  size: '10 kg',
  description: 'Potravinářský CO₂ E290',
  // Kinds as the API sends them — member names, not numbers.
  prices: [
    new SupplierGoodPriceDto({
      kind: 'Fill' as unknown as SupplierChargeKind, priceWithVat: 450, priceWithoutVat: 372,
    }),
    new SupplierGoodPriceDto({
      kind: 'Deposit' as unknown as SupplierChargeKind, priceWithVat: 1200, note: 'vratná',
    }),
  ],
} as never);

function renderDrawer(good?: SupplierGoodDto) {
  return render(
    <MuiThemeProvider theme={theme}>
      <SupplierGoodDrawer open supplierId="sp-1" good={good} onClose={vi.fn()} />
    </MuiThemeProvider>,
  );
}

const save = () => fireEvent.click(screen.getByRole('button', { name: /Přidat zboží|Uložit změny/ }));

describe('SupplierGoodDrawer', () => {
  beforeEach(() => {
    createMock.mockClear();
    updateMock.mockClear();
  });

  it('starts a new good with one empty price row', () => {
    renderDrawer();
    expect(screen.getByLabelText('s DPH')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Přidat cenu' })).toBeTruthy();
  });

  it('refuses to save without a name', async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText('s DPH'), { target: { value: '450' } });
    save();

    await waitFor(() => expect(screen.getByText('Zadejte název')).toBeTruthy());
    expect(createMock).not.toHaveBeenCalled();
  });

  it('refuses to save a good whose price is blank', async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText('Název'), { target: { value: 'CO₂ láhev' } });
    save();

    await waitFor(() => expect(screen.getByText('Cena s DPH')).toBeTruthy());
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a negative price', async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText('Název'), { target: { value: 'CO₂ láhev' } });
    fireEvent.change(screen.getByLabelText('s DPH'), { target: { value: '-5' } });
    save();

    await waitFor(() => expect(screen.getByText('Nesmí být záporná')).toBeTruthy());
    expect(createMock).not.toHaveBeenCalled();
  });

  it('sends a valid good with its price', async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText('Název'), { target: { value: 'CO₂ láhev' } });
    fireEvent.change(screen.getByLabelText('Velikost'), { target: { value: '10 kg' } });
    fireEvent.change(screen.getByLabelText('s DPH'), { target: { value: '450' } });
    fireEvent.change(screen.getByLabelText('bez DPH'), { target: { value: '372' } });
    save();

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const { id, data } = createMock.mock.calls[0][0];
    expect(id).toBe('sp-1');
    expect(data.name).toBe('CO₂ láhev');
    expect(data.size).toBe('10 kg');
    expect(data.prices).toHaveLength(1);
    // Typed as text, sent as numbers — the endpoint takes decimals, not strings.
    expect(data.prices[0].priceWithVat).toBe(450);
    expect(data.prices[0].priceWithoutVat).toBe(372);
    expect(data.prices[0].kind).toBe(SupplierChargeKind.Fill);
  });

  it('drops an empty note rather than storing a blank one', async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText('Název'), { target: { value: 'Dusík' } });
    fireEvent.change(screen.getByLabelText('s DPH'), { target: { value: '1250' } });
    save();

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0].data.prices[0].note).toBeUndefined();
  });

  it('pre-fills an edit with the good and every price row it has', () => {
    renderDrawer(EXISTING);

    expect(screen.getByDisplayValue('CO₂ láhev')).toBeTruthy();
    expect(screen.getByDisplayValue('10 kg')).toBeTruthy();
    expect(screen.getByDisplayValue('450')).toBeTruthy();
    expect(screen.getByDisplayValue('1200')).toBeTruthy();
    expect(screen.getByDisplayValue('vratná')).toBeTruthy();
  });

  it('updates through the update endpoint, addressing the good by its own id', async () => {
    renderDrawer(EXISTING);
    fireEvent.change(screen.getByDisplayValue('450'), { target: { value: '480' } });
    save();

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const arg = updateMock.mock.calls[0][0];
    expect(arg.goodId).toBe('sg-1');
    expect(arg.supplierId).toBe('sp-1');
    expect(arg.data.prices[0].priceWithVat).toBe(480);
    // Both rows still travel: prices are replaced, not merged.
    expect(arg.data.prices).toHaveLength(2);
  });

  it('keeps the last price row undeletable, since a good needs one', () => {
    renderDrawer();
    const removeButtons = screen.getAllByRole('button', { name: 'Odebrat cenu' });
    expect(removeButtons).toHaveLength(1);
    expect(removeButtons[0]).toHaveProperty('disabled', true);
  });
});
