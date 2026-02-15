import { screen, fireEvent } from '@testing-library/react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { renderWithProviders } from 'src/test/test-utils';

import { DrawerLayout } from './drawer-layout';

// -------------------------------------------------------------------

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('minimal-shared/utils', () => ({
    varAlpha: () => 'rgba(0,0,0,0.16)',
}));

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });

const defaultProps = {
    title: 'Test Drawer',
    isLoading: false,
    onClose: vi.fn(),
    onSaveAndClose: vi.fn(),
    children: <div data-testid="drawer-child">Content</div>,
};

function renderDrawer(overrides = {}) {
    return renderWithProviders(
        <DrawerLayout {...defaultProps} {...overrides} />,
        { theme: cssVarsTheme }
    );
}

describe('DrawerLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders title', () => {
        renderDrawer();
        expect(screen.getByText('Test Drawer')).toBeInTheDocument();
    });

    it('renders children when not loading', () => {
        renderDrawer();
        expect(screen.getByTestId('drawer-child')).toBeInTheDocument();
    });

    it('shows loading indicator when isLoading is true', () => {
        renderDrawer({ isLoading: true });
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(screen.queryByTestId('drawer-child')).not.toBeInTheDocument();
    });

    it('renders close button', () => {
        renderDrawer();
        expect(screen.getByText('common.close')).toBeInTheDocument();
    });

    it('renders save and close button', () => {
        renderDrawer();
        expect(screen.getByText('common.saveAndClose')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        renderDrawer();
        fireEvent.click(screen.getByText('common.close'));
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSaveAndClose when save button is clicked', () => {
        renderDrawer();
        fireEvent.click(screen.getByText('common.saveAndClose'));
        expect(defaultProps.onSaveAndClose).toHaveBeenCalledTimes(1);
    });
});
