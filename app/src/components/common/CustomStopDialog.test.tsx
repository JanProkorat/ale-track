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
// app/CLAUDE.md's testing convention. CustomStopDialog itself only ever reads
// `.data` (no isPending/isError branch), so the two states worth covering are
// "no company entry in `data`" (whether that's because the query is still
// pending or genuinely came back empty — same code path either way) and "the
// query errored but TanStack Query still holds a previously cached `data`" —
// a real scenario (data and isError can coexist on a background refetch
// failure), not a fabricated one. Reset in beforeEach; the two tests below
// each flip one flag.
const DEFAULT_START_POINTS = [{ kind: 'Company', name: 'Sklad AleTrack', address: 'Turistická 211, 46334 Hrádek nad Nisou' }];
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

    // A regex, not the exact string: the field is `required`, so MUI renders
    // its label with a trailing " *" indicator — an exact-string match against
    // 'Název zastávky' never matches even when the field IS present, which
    // would make this assertion pass unconditionally regardless of the bug it
    // guards.
    expect(screen.queryByLabelText(/Název zastávky/)).not.toBeInTheDocument();
  });

  it('disables the company option when the route already has one', () => {
    render(<CustomStopDialog open onClose={() => {}} onAdd={() => {}} hasCompanyStop />);

    expect(screen.getByRole('button', { name: 'Firemní sklad' })).toBeDisabled();
  });

  it('disables the company option while the run carries no stock purchases', () => {
    // The server keeps the Company stop in step with the stock purchases in both
    // directions, so adding one now would be removed again by the very next save.
    // Offering the click and silently undoing it is worse than not offering it.
    render(<CustomStopDialog open onClose={() => {}} onAdd={() => {}} hasCompanyStop={false} hasStockPurchases={false} />);

    expect(screen.getByRole('button', { name: 'Firemní sklad' })).toBeDisabled();
  });

  it('enables the company option once the run carries stock purchases', () => {
    render(<CustomStopDialog open onClose={() => {}} onAdd={() => {}} hasCompanyStop={false} hasStockPurchases />);

    expect(screen.getByRole('button', { name: 'Firemní sklad' })).toBeEnabled();
  });

  it('falls back to a generic label when there is no company entry in the start-points data (e.g. still loading)', () => {
    startPointsPending = true;
    startPoints = [];
    const onAdd = vi.fn();
    render(<CustomStopDialog open onClose={() => {}} onAdd={onAdd} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));
    // No address line to show yet — falls back to a generic label rather than crashing on `undefined`.
    expect(screen.queryByText('Turistická 211, 46334 Hrádek nad Nisou')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Přidat zastávku' }));
    expect(onAdd).toHaveBeenCalledWith({ kind: 'company' });
  });

  it('still shows the cached company address when the start-points query is currently erroring', () => {
    // A background refetch failure leaves TanStack Query's `data` holding the
    // last successful result alongside `isError: true` — the dialog reads
    // `.data` unconditionally, so a current error must not blank an address
    // it already has.
    startPointsError = true;
    const onAdd = vi.fn();
    render(<CustomStopDialog open onClose={() => {}} onAdd={onAdd} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));

    expect(screen.getByText('Turistická 211, 46334 Hrádek nad Nisou')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Přidat zastávku' }));
    expect(onAdd).toHaveBeenCalledWith({ kind: 'company' });
  });

  it('resets to custom mode when the close (X) button is clicked, so reopening lands correctly', () => {
    // The real caller (ShipmentEditor) renders <CustomStopDialog open={...} .../>
    // unconditionally — only the `open` boolean toggles, the component instance
    // itself never unmounts. So the fix under test (reset() running as part of
    // the same click, before onClose fires) is provable without physically
    // cycling MUI's own Dialog open/close transition: `open` is left `true`
    // throughout, and onClose is a spy rather than something that actually
    // hides the dialog. If `reset()` did not run, mode would still read
    // 'company' here and the custom-place field would stay hidden.
    const onClose = vi.fn();
    render(<CustomStopDialog open onClose={onClose} onAdd={() => {}} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));
    // Sanity check: now in company mode, so the custom-place field is hidden.
    expect(screen.queryByLabelText(/Název zastávky/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zavřít' }));

    expect(onClose).toHaveBeenCalled();
    // Before the fix, the X button called the raw `onClose` prop directly
    // instead of the local `close` that calls `reset()` — mode (and the
    // point/label/note fields) stuck at 'company'.
    expect(screen.getByLabelText(/Název zastávky/)).toBeInTheDocument();
  });
});
