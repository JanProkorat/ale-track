import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { theme } from 'src/theme/theme';
import {
  PriceListChangeKind, PriceListPreviewDto, PriceListPreviewItemDto,
  PriceListPreviewSummaryDto, ProductContainer, ProductSaleUnit,
} from 'src/generated/api-client';
import { PriceListImportDrawer } from './PriceListImportDrawer';

const previewMutate = vi.fn();
const applyMutate = vi.fn();

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/providers/CurrencyProvider', () => ({
  useCurrency: () => ({ formatMoney: (v?: number) => (v == null ? '—' : `${v} Kč`) }),
}));
vi.mock('src/hooks/useBreweryProducts', () => ({
  usePreviewPriceList: () => ({ mutateAsync: previewMutate }),
  useApplyPriceList: () => ({ mutateAsync: applyMutate }),
}));

function summary(over: Partial<PriceListPreviewSummaryDto> = {}) {
  return new PriceListPreviewSummaryDto({
    added: 0, repriced: 0, changed: 0, unchanged: 0, toRemove: 0, blocked: 0, ...over,
  });
}

function preview(over: Partial<PriceListPreviewDto> = {}) {
  return new PriceListPreviewDto({
    sourceHash: 'hash-of-the-reviewed-file',
    effectiveFrom: new Date('2026-05-01'),
    sourceName: 'pivovarsvijany.cz/file/2336',
    breweryName: 'Svijany',
    summary: summary({ repriced: 1 }),
    items: [
      new PriceListPreviewItemDto({
        kind: PriceListChangeKind.Repriced,
        name: 'Svijanská Desítka',
        container: ProductContainer.Bottle,
        saleUnit: ProductSaleUnit.Crate,
        volumeLiters: 0.5,
        unitsPerPackage: 20,
        priceWithVat: 318,
        derived: 0,
        changes: [],
      }),
    ],
    ...over,
  });
}

function renderDrawer() {
  return render(
    <MuiThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <PriceListImportDrawer open breweryId="brewery-1" onClose={vi.fn()} />
      </LocalizationProvider>
    </MuiThemeProvider>,
  );
}

function chooseFile(name = 'svijany-2026-05-01.csv') {
  const input = screen.getByLabelText('Soubor s ceníkem');
  fireEvent.change(input, {
    target: { files: [new File(['name,type\n'], name, { type: 'text/csv' })] },
  });
}

describe('PriceListImportDrawer', () => {
  beforeEach(() => {
    previewMutate.mockReset();
    applyMutate.mockReset();
  });

  it('cannot be submitted before a file is chosen', () => {
    renderDrawer();

    expect(screen.getByRole('button', { name: 'Načíst náhled' })).toBeDisabled();
  });

  it('previews first and only then offers to apply', async () => {
    previewMutate.mockResolvedValue(preview());
    renderDrawer();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: 'Načíst náhled' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Použít ceník' })).toBeInTheDocument());
    expect(previewMutate).toHaveBeenCalledTimes(1);
    // The preview writes nothing; nothing may be applied off the back of rendering it.
    expect(applyMutate).not.toHaveBeenCalled();
  });

  it('applies with the hash the preview handed out', async () => {
    previewMutate.mockResolvedValue(preview());
    applyMutate.mockResolvedValue({ added: 0, updated: 1, removed: 0, blocked: 0 });
    renderDrawer();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: 'Načíst náhled' }));
    await waitFor(() => screen.getByRole('button', { name: 'Použít ceník' }));
    fireEvent.click(screen.getByRole('button', { name: 'Použít ceník' }));

    await waitFor(() => expect(applyMutate).toHaveBeenCalledTimes(1));
    expect(applyMutate.mock.calls[0][0]).toMatchObject({ sourceHash: 'hash-of-the-reviewed-file' });
  });

  it('throws the diff away when the file is swapped, so a stale one cannot be applied', async () => {
    // Without this the drawer would post the new file under the previous file's hash — which the
    // API rejects with 409, but the user would have been shown a diff that was never theirs.
    previewMutate.mockResolvedValue(preview());
    renderDrawer();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: 'Načíst náhled' }));
    await waitFor(() => screen.getByRole('button', { name: 'Použít ceník' }));

    chooseFile('rohozec-2024-05-01.csv');

    expect(screen.getByRole('button', { name: 'Načíst náhled' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Použít ceník' })).not.toBeInTheDocument();
  });

  it('lists only the products an import would touch, but counts the rest', async () => {
    previewMutate.mockResolvedValue(preview({
      summary: summary({ repriced: 1, unchanged: 114 }),
      items: [
        ...preview().items!,
        new PriceListPreviewItemDto({
          kind: PriceListChangeKind.Unchanged,
          name: 'Svijanský Máz',
          container: ProductContainer.Keg,
          saleUnit: ProductSaleUnit.Single,
          volumeLiters: 50,
          unitsPerPackage: 1,
          priceWithVat: 2140,
          derived: 0,
          changes: [],
        }),
      ],
    }));
    renderDrawer();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: 'Načíst náhled' }));

    await waitFor(() => screen.getByRole('button', { name: 'Použít ceník' }));
    expect(screen.getByText('Svijanská Desítka')).toBeInTheDocument();
    expect(screen.queryByText('Svijanský Máz')).not.toBeInTheDocument();
    expect(screen.getByText('Beze změny: 114')).toBeInTheDocument();
  });

  it('warns before removals and explains what stays', async () => {
    previewMutate.mockResolvedValue(preview({
      summary: summary({ toRemove: 2, blocked: 1 }),
      items: [
        new PriceListPreviewItemDto({
          kind: PriceListChangeKind.ToRemove,
          name: 'Zámek',
          container: ProductContainer.Keg,
          saleUnit: ProductSaleUnit.Single,
          volumeLiters: 50,
          unitsPerPackage: 1,
          priceWithVat: 2250,
          derived: 0,
          changes: [],
        }),
      ],
    }));
    renderDrawer();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: 'Načíst náhled' }));

    await waitFor(() => screen.getByRole('button', { name: 'Použít ceník' }));
    expect(screen.getByText(/budou odebrány/i)).toBeInTheDocument();
    expect(screen.getByText(/skladem nebo na otevřené objednávce/i)).toBeInTheDocument();
  });

  it('stays on the preview step when the file cannot be read', async () => {
    previewMutate.mockRejectedValue(new Error('nope'));
    renderDrawer();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: 'Načíst náhled' }));

    await waitFor(() => expect(previewMutate).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Načíst náhled' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Použít ceník' })).not.toBeInTheDocument();
  });

  it('flags a price the parser computed rather than read off the list', async () => {
    previewMutate.mockResolvedValue(preview({
      items: [new PriceListPreviewItemDto({
        kind: PriceListChangeKind.Added,
        name: 'Bidlovka',
        container: ProductContainer.Keg,
        saleUnit: ProductSaleUnit.Single,
        volumeLiters: 30,
        unitsPerPackage: 1,
        priceWithVat: 1506,
        derived: 2,
        changes: [],
      })],
    }));
    renderDrawer();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: 'Načíst náhled' }));

    await waitFor(() => screen.getByRole('button', { name: 'Použít ceník' }));
    expect(screen.getByText('dopočteno')).toBeInTheDocument();
  });
});
