import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, fireEvent, renderWithProviders } from 'src/test/test-utils';

import { SplitViewLayout } from './split-view-layout';

// -------------------------------------------------------------------

vi.mock('minimal-shared/utils', () => ({
     varAlpha: () => 'rgba(0,0,0,0.16)',
     mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('src/components/iconify', () => ({
     Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

vi.mock('./content', () => ({
     DashboardContent: ({ children }: any) => <div data-testid="dashboard-content">{children}</div>,
}));

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });

const defaultProps = {
     title: 'Test View',
     newLabel: 'Add New',
     onNewClick: vi.fn(),
     rightContent: <div data-testid="right">Right content</div>,
     initialLoading: false,
};

function renderSplit(overrides = {}) {
     return renderWithProviders(<SplitViewLayout {...defaultProps} {...overrides} />, { theme: cssVarsTheme });
}

describe('SplitViewLayout', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('renders title', () => {
          renderSplit();
          expect(screen.getByText('Test View')).toBeInTheDocument();
     });

     it('renders new button with label', () => {
          renderSplit();
          expect(screen.getByText('Add New')).toBeInTheDocument();
     });

     it('calls onNewClick when new button is clicked', () => {
          renderSplit();
          fireEvent.click(screen.getByText('Add New'));
          expect(defaultProps.onNewClick).toHaveBeenCalledTimes(1);
     });

     it('renders right content', () => {
          renderSplit();
          expect(screen.getByTestId('right')).toBeInTheDocument();
     });

     it('renders left content when provided', () => {
          renderSplit({ leftContent: <div data-testid="left">Left</div> });
          expect(screen.getByTestId('left')).toBeInTheDocument();
     });

     it('does not render left content when not provided', () => {
          renderSplit();
          expect(screen.queryByTestId('left')).not.toBeInTheDocument();
     });

     it('shows loading indicator when initialLoading is true', () => {
          renderSplit({ initialLoading: true });
          expect(screen.getByRole('progressbar')).toBeInTheDocument();
     });

     it('does not show loading indicator when not loading', () => {
          renderSplit();
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
     });

     it('renders drawer content when drawerOpen is true', () => {
          renderSplit({
               drawerOpen: true,
               onDrawerClose: vi.fn(),
               drawerContent: <div data-testid="drawer">Drawer</div>,
          });
          expect(screen.getByTestId('drawer')).toBeInTheDocument();
     });
});
