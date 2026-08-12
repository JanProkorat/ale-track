// What only the panel decides: the module grouping (including the
// cross-application bucket), that the Admin column is fixed/disabled since
// Admin bypasses capabilities entirely, and that a save always sends the
// whole role x capability matrix — including cells the admin never touched.
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { UserRoleType } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { RoleCapabilitiesPanel } from './RoleCapabilitiesPanel';

const save = vi.fn();

vi.mock('src/hooks/useRoleCapabilities', () => ({
  useRoleCapabilities: () => ({
    data: [{ role: UserRoleType.Driver, capabilityKey: 'Invoicing', isVisible: false }],
    isPending: false,
    isError: false,
  }),
  useSetRoleCapabilities: () => ({ mutate: save, isPending: false }),
}));

function renderPanel() {
  return render(
    <MuiThemeProvider theme={theme}>
      <RoleCapabilitiesPanel />
    </MuiThemeProvider>,
  );
}

describe('RoleCapabilitiesPanel', () => {
  it('groups capabilities under their module', () => {
    renderPanel();

    expect(screen.getByText('Vývozy')).toBeInTheDocument();
    expect(screen.getByText('Fakturace')).toBeInTheDocument();
  });

  // CAPABILITY_REGISTRY currently has no module: null entry (Money was removed — nothing
  // enforces it, see capabilityRegistry.ts), so the cross-application group must not render
  // at all rather than show up empty. This pins the groups() conditional that skips it.
  it('renders no cross-application heading when the registry has no cross-application entry', () => {
    renderPanel();

    expect(screen.queryByText('Napříč aplikací')).not.toBeInTheDocument();
  });

  it('renders the Admin column as fixed', () => {
    renderPanel();

    // Admin bypasses capabilities, so its checkboxes exist for shape but never accept input.
    const adminBoxes = screen.getAllByRole('checkbox', { name: /Administrátor/ });
    expect(adminBoxes.every((box) => box.hasAttribute('disabled'))).toBe(true);
  });

  it('sends the whole set on save, including rows left untouched', () => {
    renderPanel();

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
});
