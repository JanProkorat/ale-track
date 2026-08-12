// What only the drawer decides: the module grouping, that the Admin column is fixed/disabled
// since Admin bypasses capabilities entirely, that a save always sends the whole role x
// capability matrix (including cells the admin never touched), and that the stored rows actually
// seed the checkboxes — the state is seeded in an effect now that FormDrawer owns the submit
// button, so a broken seed would silently show default-allow for everything.
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRoleType } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { RoleCapabilitiesDrawer } from './RoleCapabilitiesDrawer';

const save = vi.fn();

// The rows the query hands back. Typed loosely on purpose: the generated client declares `role`
// as the numeric UserRoleType, but the API serializes enums as strings (Program.cs registers
// JsonStringEnumConverter), so what actually arrives at runtime is 'Driver'. The default below is
// that real shape — a mock using the numeric form hid a bug where stored rows never matched the
// checkbox cells and every saved denial read back as default-allow.
let rows: { role: UserRoleType | string; capabilityKey: string; isVisible: boolean }[] = [];

vi.mock('src/hooks/useRoleCapabilities', () => ({
  useRoleCapabilities: () => ({ data: rows, isPending: false, isError: false }),
  useSetRoleCapabilities: () => ({ mutate: save, isPending: false }),
}));

beforeEach(() => {
  save.mockClear();
  rows = [{ role: 'Driver', capabilityKey: 'Invoicing', isVisible: false }];
});

function renderDrawer(open = true) {
  return render(
    <MuiThemeProvider theme={theme}>
      <RoleCapabilitiesDrawer open={open} onClose={vi.fn()} />
    </MuiThemeProvider>,
  );
}

describe('RoleCapabilitiesDrawer', () => {
  it('groups capabilities under their module', () => {
    renderDrawer();

    expect(screen.getByText('Vývozy')).toBeInTheDocument();
    expect(screen.getByText('Fakturace')).toBeInTheDocument();
  });

  // CAPABILITY_REGISTRY currently has no module: null entry (Money was removed — nothing
  // enforces it, see capabilityRegistry.ts), so the cross-application group must not render
  // at all rather than show up empty. This pins the groups() conditional that skips it.
  it('renders no cross-application heading when the registry has no cross-application entry', () => {
    renderDrawer();

    expect(screen.queryByText('Napříč aplikací')).not.toBeInTheDocument();
  });

  it('renders the Admin column as fixed', () => {
    renderDrawer();

    // Admin bypasses capabilities, so its checkboxes exist for shape but never accept input.
    const adminBoxes = screen.getAllByRole('checkbox', { name: /Administrátor/ });
    expect(adminBoxes.every((box) => box.hasAttribute('disabled'))).toBe(true);
  });

  // The regression that shipped: rows arrive with `role` as the string 'Driver', while the cells
  // are keyed by the numeric enum. Keying stored rows without resolving that meant every saved
  // denial read back as default-allow — the UI looked as though nothing had been saved.
  it('reads stored rows whose role arrives as a string, not the numeric enum', () => {
    renderDrawer();

    expect(screen.getByRole('checkbox', { name: 'Fakturace – Řidič' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Rozpis nakládky – Řidič' })).toBeChecked();
  });

  it('reads stored rows whose role arrives as the numeric enum', () => {
    rows = [{ role: UserRoleType.Driver, capabilityKey: 'Invoicing', isVisible: false }];
    renderDrawer();

    expect(screen.getByRole('checkbox', { name: 'Fakturace – Řidič' })).not.toBeChecked();
  });

  // The backend matches capability keys case-insensitively, so a row stored with different
  // casing must still be reflected here rather than silently reading as visible.
  it('reads a stored row whose capability key differs only by case', () => {
    rows = [{ role: 'Driver', capabilityKey: 'invoicing', isVisible: false }];
    renderDrawer();

    expect(screen.getByRole('checkbox', { name: 'Fakturace – Řidič' })).not.toBeChecked();
  });

  it('sends the whole set on save, including rows left untouched', () => {
    renderDrawer();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Rozpis nakládky – Řidič' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ capabilityKey: 'Invoicing', isVisible: false }),
        expect.objectContaining({ capabilityKey: 'LoadingBreakdown', isVisible: false }),
      ]),
      expect.anything(),
    );
  });

  it('renders nothing when closed', () => {
    renderDrawer(false);

    expect(screen.queryByText('Fakturace')).not.toBeInTheDocument();
  });
});
