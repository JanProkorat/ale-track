// What only the drawer decides: the module grouping, that the Admin column is fixed/disabled
// since Admin bypasses capabilities entirely, that a save always sends the whole role x
// capability matrix (including cells the admin never touched), and that the stored rows actually
// seed the checkboxes — the state is seeded in an effect now that FormDrawer owns the submit
// button, so a broken seed would silently show default-allow for everything.
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { UserRoleType } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { RoleCapabilitiesDrawer } from './RoleCapabilitiesDrawer';

const save = vi.fn();

vi.mock('src/hooks/useRoleCapabilities', () => ({
  useRoleCapabilities: () => ({
    data: [{ role: UserRoleType.Driver, capabilityKey: 'Invoicing', isVisible: false }],
    isPending: false,
    isError: false,
  }),
  useSetRoleCapabilities: () => ({ mutate: save, isPending: false }),
}));

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

  // The seeding guard: the mocked rows hide Invoicing from Driver, so that one box must start
  // unchecked while an unstored pair starts checked under default-allow. A seed that ignored
  // the query data would leave both checked and still pass every other test here.
  it('seeds the checkboxes from the stored rows', () => {
    renderDrawer();

    expect(screen.getByRole('checkbox', { name: 'Fakturace – Řidič' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Rozpis nakládky – Řidič' })).toBeChecked();
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
