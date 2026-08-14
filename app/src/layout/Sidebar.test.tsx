// Each nav item's badge is wired to one field of the module-counts response by name. A wrong or
// missing field name fails silently — the badge just never appears — so the mapping is worth a test.
// fireEvent rather than user-event — not a dependency of this project.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { NumberOfRecordsInEachModuleDto } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { Sidebar } from './Sidebar';

let countsResponse: NumberOfRecordsInEachModuleDto | undefined;

vi.mock('src/hooks/useReports', () => ({
  useModuleCounts: () => ({ data: countsResponse }),
}));
vi.mock('src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { userName: 'jan', firstName: 'Jan', lastName: 'Prokorát', roles: [] },
    canSee: () => true,
    canEdit: () => true,
    can: () => true,
  }),
}));

/** Renders the expanded sidebar on a route that is not the one under test, so its badge shows —
 * the prototype hides the badge on the active item. */
function renderSidebar(counts: NumberOfRecordsInEachModuleDto | undefined, at = '/dashboard') {
  countsResponse = counts;
  return render(
    <MemoryRouter initialEntries={[at]}>
      <MuiThemeProvider theme={theme}>
        <Sidebar collapsed={false} />
      </MuiThemeProvider>
    </MemoryRouter>
  );
}

const navItem = (label: string) => screen.getByText(label).closest('a') as HTMLElement;

describe('Sidebar badges', () => {
  it('badges Prodeje with the unfinished-sales count', () => {
    renderSidebar(new NumberOfRecordsInEachModuleDto({ salesCount: 4 }));

    expect(within(navItem('Prodeje')).getByText('4')).toBeInTheDocument();
  });

  it('shows no Prodeje badge when nothing is open', () => {
    renderSidebar(new NumberOfRecordsInEachModuleDto({ salesCount: 0 }));

    expect(within(navItem('Prodeje')).queryByText('0')).not.toBeInTheDocument();
  });

  it('shows no Prodeje badge when the caller may not see the module', () => {
    // The endpoint answers null rather than 0 for a module the caller cannot open.
    renderSidebar(new NumberOfRecordsInEachModuleDto({ salesCount: undefined }));

    expect(within(navItem('Prodeje')).queryByText(/\d/)).not.toBeInTheDocument();
  });

  it('hides the badge on the item the user is already looking at', () => {
    renderSidebar(new NumberOfRecordsInEachModuleDto({ salesCount: 4 }), '/sales');

    expect(within(navItem('Prodeje')).queryByText('4')).not.toBeInTheDocument();
  });
});
