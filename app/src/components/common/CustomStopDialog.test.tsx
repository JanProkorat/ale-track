// What only CustomStopDialog decides: that switching to "Firemní sklad" mode
// returns a bare `{ kind: 'company' }` payload with no address prompt, that
// the company option is disabled (with a tooltip) once the route already has
// one, and that the custom-place fields disappear while in that mode. The map
// itself (AddressMapPicker) is a different task's concern and is mocked out
// here so this file only exercises the dialog's own mode-switching logic.
//
// fireEvent rather than user-event: the latter is not a dependency of this
// project and adding one for a test file is not worth it.

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomStopDialog } from './CustomStopDialog';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

// Pulls in react-leaflet, which doesn't run under happy-dom — same reasoning
// as DeliveryPlaceDialog.test.tsx stubbing this out.
vi.mock('src/components/common/AddressMapPicker', () => ({
  AddressMapPicker: () => <div data-testid="address-map-picker-stub" />,
}));

// Mutable rather than a literal — able to express loading/error/no-data per
// app/CLAUDE.md's testing convention: the dialog reads the company address
// from this query for its read-only address block, and a mock that always
// succeeds cannot catch a crash on a missing/erroring one. Reset in
// beforeEach; the "graceful fallback" tests below flip one each.
const DEFAULT_START_POINTS = [{ kind: 'Company', name: 'Sklad AleTrack', address: 'Nádražní 1, Žitava' }];
let startPoints: { kind: string; name: string; address?: string }[] = DEFAULT_START_POINTS;
let startPointsPending = false;
let startPointsError = false;

vi.mock('src/hooks/useShipments', () => ({
  useShipmentStartPoints: () => ({ data: startPoints, isPending: startPointsPending, isError: startPointsError }),
}));

beforeEach(() => {
  startPoints = DEFAULT_START_POINTS;
  startPointsPending = false;
  startPointsError = false;
});

describe('CustomStopDialog', () => {
  it('returns a company stop without asking for an address', () => {
    const onAdd = vi.fn();
    render(<CustomStopDialog open onClose={() => {}} onAdd={onAdd} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Přidat zastávku' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'company' });
  });

  it('hides the map picker in company mode', () => {
    render(<CustomStopDialog open onClose={() => {}} onAdd={() => {}} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));

    expect(screen.queryByLabelText('Název zastávky')).not.toBeInTheDocument();
  });

  it('disables the company option when the route already has one', () => {
    render(<CustomStopDialog open onClose={() => {}} onAdd={() => {}} hasCompanyStop />);

    expect(screen.getByRole('button', { name: 'Firemní sklad' })).toBeDisabled();
  });

  it('still adds a company stop when the start-points query is still pending', () => {
    startPointsPending = true;
    startPoints = [];
    const onAdd = vi.fn();
    render(<CustomStopDialog open onClose={() => {}} onAdd={onAdd} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));
    // No address line to show yet — falls back to a generic label rather than crashing on `undefined`.
    expect(screen.queryByText('Nádražní 1, Žitava')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Přidat zastávku' }));
    expect(onAdd).toHaveBeenCalledWith({ kind: 'company' });
  });

  it('still adds a company stop when the start-points query has failed', () => {
    startPointsError = true;
    startPoints = [];
    const onAdd = vi.fn();
    render(<CustomStopDialog open onClose={() => {}} onAdd={onAdd} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Přidat zastávku' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'company' });
  });
});
