import { it, vi, expect, describe } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { renderWithProviders } from 'src/test/test-utils';

import { AuthContent } from './content';

// ------------------------------------
// Mocks
// ------------------------------------
vi.mock('minimal-shared/utils', () => ({
    mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });

// ------------------------------------
// Tests
// ------------------------------------
describe('AuthContent', () => {
    it('renders children', () => {
        const { getByText } = renderWithProviders(
            <AuthContent>Login form here</AuthContent>,
            { theme: cssVarsTheme }
        );

        expect(getByText('Login form here')).toBeInTheDocument();
    });

    it('applies layout content class', () => {
        const { container } = renderWithProviders(
            <AuthContent>Content</AuthContent>,
            { theme: cssVarsTheme }
        );

        const box = container.firstChild;
        expect((box as HTMLElement)?.className).toContain('layout__main__content');
    });

    it('merges custom className', () => {
        const { container } = renderWithProviders(
            <AuthContent className="custom-auth">Content</AuthContent>,
            { theme: cssVarsTheme }
        );

        const box = container.firstChild;
        expect((box as HTMLElement)?.className).toContain('custom-auth');
    });

    it('passes additional props', () => {
        const { container } = renderWithProviders(
            <AuthContent data-testid="auth-content">Content</AuthContent>,
            { theme: cssVarsTheme }
        );

        expect(container.querySelector('[data-testid="auth-content"]')).toBeInTheDocument();
    });
});
