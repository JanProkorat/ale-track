// The drawer's own job: come back pre-filled with the week that was saved. It shipped once
// showing five rows with an empty day picker, because the API sends `dayOfWeek` as the enum's
// name ("Monday") and the prefill indexed the numeric enum with it.
// fireEvent — user-event is not a dependency of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { DayOfWeek, SupplierOpeningHoursDto } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { OpeningHoursDrawer } from './OpeningHoursDrawer';

const replaceMock = vi.fn();

vi.mock('src/hooks/useSuppliers', () => ({
  useReplaceOpeningHours: () => ({ mutateAsync: replaceMock, isPending: false }),
}));
const enqueueMock = vi.fn();
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: enqueueMock }) }));

/** As the API serves it: enum names and seconds on the times. */
const wireHours = [
  { dayOfWeek: 'Monday', from: '06:30:00', to: '15:00:00' },
  { dayOfWeek: 'Monday', from: '16:00:00', to: '18:00:00' },
  { dayOfWeek: 'Friday', from: '06:30:00', to: '13:00:00' },
] as unknown as SupplierOpeningHoursDto[];

function renderDrawer(hours: SupplierOpeningHoursDto[]) {
  return render(
    <MuiThemeProvider theme={theme}>
      <OpeningHoursDrawer
        open
        supplierId="sp-1"
        supplierName="Albeco"
        hours={hours}
        onClose={vi.fn()}
      />
    </MuiThemeProvider>,
  );
}

describe('OpeningHoursDrawer', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    enqueueMock.mockClear();
  });

  it('pre-fills the day picker from the name the API sends', () => {
    renderDrawer(wireHours);

    // Two Monday rows and one Friday row — the day is named, not blank.
    expect(screen.getAllByDisplayValue('Pondělí')).toHaveLength(2);
    expect(screen.getAllByDisplayValue('Pátek')).toHaveLength(1);
  });

  it('pre-fills the times without their seconds', () => {
    renderDrawer(wireHours);

    expect(screen.getAllByDisplayValue('06:30')).toHaveLength(2);
    expect(screen.getAllByDisplayValue('15:00')).toHaveLength(1);
  });

  it('also accepts the numeric enum form', () => {
    renderDrawer([
      new SupplierOpeningHoursDto({ dayOfWeek: DayOfWeek.Wednesday, from: '08:00:00', to: '16:00:00' }),
    ]);

    expect(screen.getByDisplayValue('Středa')).toBeTruthy();
  });

  it('says so plainly when nothing is recorded yet', () => {
    renderDrawer([]);

    expect(screen.getByText(/Zatím nezadaná/)).toBeTruthy();
  });

  it('sends the week back with seconds and the enum name', async () => {
    renderDrawer(wireHours);

    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    const { id, data } = replaceMock.mock.calls[0][0];
    expect(id).toBe('sp-1');
    expect(data.openingHours).toHaveLength(3);
    expect(data.openingHours[0].from).toBe('06:30:00');
    // DayOfWeek.Monday — the request side is the numeric enum the generated DTO declares.
    expect(data.openingHours[0].dayOfWeek).toBe(DayOfWeek.Monday);
  });

  it('refuses an overlapping week instead of sending it', async () => {
    renderDrawer([
      { dayOfWeek: 'Monday', from: '07:00:00', to: '12:00:00' },
      { dayOfWeek: 'Monday', from: '11:30:00', to: '15:30:00' },
    ] as unknown as SupplierOpeningHoursDto[]);

    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(enqueueMock).toHaveBeenCalled());
    expect(enqueueMock.mock.calls[0][0]).toMatch(/překrývat/);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
