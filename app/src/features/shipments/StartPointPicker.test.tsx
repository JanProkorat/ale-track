// What only StartPointPicker decides (the pure key-building lives in
// startPointOption.test.ts): that the address-kind suffix ("— Fakturační" /
// "— Kontaktní") is shown only for a brewery that contributes more than one
// entry, and that picking an entry hands `onChange` its `addressKind` as well
// as its `kind`/`breweryId` — the field a brewery's second address rides on.

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShipmentStartPointKind } from 'src/generated/api-client';
import { StartPointPicker } from './StartPointPicker';
import type { StartPointValue } from './startPointOption';

interface StartPointFixture {
  kind: string;
  breweryId?: string;
  addressKind?: string | null;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

let startPoints: StartPointFixture[] = [];

vi.mock('src/hooks/useShipments', () => ({
  useShipmentStartPoints: () => ({ data: startPoints, isPending: false, isError: false }),
}));

// `addressKind: null` explicitly, not omitted — the real GetShipmentStartPointsEndpoint
// assigns `AddressKind = null` on the company entry, and there is no
// DefaultIgnoreCondition to drop it from the response, so the wire carries an explicit
// `"addressKind": null` rather than leaving the key out. A fixture that omits the key
// entirely (producing `undefined`, which JSON.stringify drops) cannot reproduce the bug
// this shape exists to catch.
const COMPANY: StartPointFixture = { kind: 'Company', name: 'Sklad AleTrack', address: 'Turistická 211, 46334 Hrádek nad Nisou', addressKind: null };
// Two entries for the same brewery — its official seat and a separate contact
// address it actually loads from. Distinct town names so a test asserting on
// either address string cannot pass by coincidence.
const SVIJANY_OFFICIAL: StartPointFixture = {
  kind: 'Brewery', breweryId: 'brewery-svijany', addressKind: 'Official',
  name: 'Pivovar Svijany', address: 'Svijany 1, Svijany', latitude: 50.6, longitude: 15.15,
};
const SVIJANY_CONTACT: StartPointFixture = {
  kind: 'Brewery', breweryId: 'brewery-svijany', addressKind: 'Contact',
  name: 'Pivovar Svijany', address: 'Skladová 9, Turnov', latitude: 50.59, longitude: 15.16,
};
// A brewery with only one address set — no Contact entry at all.
const FRYDLANT: StartPointFixture = {
  kind: 'Brewery', breweryId: 'brewery-frydlant', addressKind: 'Official',
  name: 'Pivovar Frýdlant', address: 'Náměstí 1, Frýdlant', latitude: 50.9, longitude: 15.08,
};

function renderPicker(value: StartPointValue, onChange = vi.fn()) {
  render(<StartPointPicker value={value} onChange={onChange} />);
  return onChange;
}

describe('StartPointPicker — address-kind suffix', () => {
  it('shows the address-kind label for a brewery that contributes two entries', () => {
    startPoints = [COMPANY, SVIJANY_OFFICIAL, SVIJANY_CONTACT];
    renderPicker({ kind: ShipmentStartPointKind.Company });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    const listbox = screen.getByRole('listbox');

    // Both Svijany rows share a name; only the kind suffix (and the address caption)
    // tells them apart. If the suffix were dropped, both options would render
    // identical primary text and this query would find only one match instead of two.
    const svijanyOfficialOption = within(listbox).getByText((_, el) => el?.textContent?.startsWith('Pivovar Svijany — Fakturační') ?? false);
    const svijanyContactOption = within(listbox).getByText((_, el) => el?.textContent?.startsWith('Pivovar Svijany — Kontaktní') ?? false);
    expect(svijanyOfficialOption).toBeInTheDocument();
    expect(svijanyContactOption).toBeInTheDocument();
  });

  it('shows no suffix for a brewery with only one address', () => {
    startPoints = [COMPANY, FRYDLANT];
    renderPicker({ kind: ShipmentStartPointKind.Company });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    const listbox = screen.getByRole('listbox');

    // A single-address brewery must not carry "— Fakturační" — that would be noise, since
    // there is nothing else of the same brewery to disambiguate it from.
    expect(within(listbox).queryByText((_, el) => el?.textContent?.includes('— Fakturační') ?? false)).not.toBeInTheDocument();
    expect(within(listbox).getByText('Pivovar Frýdlant')).toBeInTheDocument();
  });
});

describe('StartPointPicker — picking an entry', () => {
  it('hands onChange the addressKind of the picked entry', () => {
    startPoints = [COMPANY, SVIJANY_OFFICIAL, SVIJANY_CONTACT];
    const onChange = renderPicker({ kind: ShipmentStartPointKind.Company });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(screen.getByText((_, el) => el?.textContent?.startsWith('Pivovar Svijany — Kontaktní') ?? false));

    // Without addressKind on the picked value, this would be indistinguishable from
    // picking the Official entry — both share kind and breweryId.
    expect(onChange).toHaveBeenCalledWith({
      kind: 'Brewery',
      breweryId: 'brewery-svijany',
      addressKind: 'Contact',
    });
  });

  it('never hands onChange a null addressKind when picking the company', () => {
    // Both write DTOs declare `StartBreweryAddressKind` as a non-nullable enum:
    // System.Text.Json throws on a literal `null` against a non-nullable enum at model
    // binding, so a `null` reaching the save payload 400s every save that starts at the
    // company. `undefined` is safe — JSON.stringify drops it, so the key is simply
    // absent and the server falls back to its own default.
    startPoints = [COMPANY, SVIJANY_OFFICIAL];
    const onChange = renderPicker({ kind: ShipmentStartPointKind.Brewery, breweryId: 'brewery-svijany', addressKind: 'Official' as never });

    fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
    fireEvent.click(screen.getByText('Sklad AleTrack'));

    expect(onChange).toHaveBeenCalledWith({
      kind: 'Company',
      breweryId: undefined,
      addressKind: undefined,
    });
  });
});
