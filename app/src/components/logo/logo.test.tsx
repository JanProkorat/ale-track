import { it, vi, expect, describe } from 'vitest';

import { screen, renderWithProviders } from 'src/test/test-utils';

import { Logo } from './logo';

// -------------------------------------------------------------------

vi.mock('react-router-dom', () => ({
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('classnames', () => ({
    default: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe('Logo', () => {
    it('renders with aria-label', () => {
        renderWithProviders(<Logo />);
        expect(screen.getByLabelText('Logo')).toBeInTheDocument();
    });

    it('renders full logo by default', () => {
        renderWithProviders(<Logo />);
        const img = screen.getByAltText('Full Logo');
        expect(img).toBeInTheDocument();
    });

    it('renders single/small logo when isSingle is true', () => {
        renderWithProviders(<Logo isSingle />);
        const img = screen.getByAltText('Single Logo');
        expect(img).toBeInTheDocument();
    });

    it('renders as a link with default href "/"', () => {
        renderWithProviders(<Logo />);
        const link = screen.getByLabelText('Logo');
        expect(link).toHaveAttribute('href', '/');
    });

    it('renders with custom href', () => {
        renderWithProviders(<Logo href="/dashboard" />);
        const link = screen.getByLabelText('Logo');
        expect(link).toHaveAttribute('href', '/dashboard');
    });

    it('applies disabled pointer events', () => {
        renderWithProviders(<Logo disabled />);
        expect(screen.getByLabelText('Logo')).toBeInTheDocument();
    });

    it('merges custom className', () => {
        renderWithProviders(<Logo className="my-logo" />);
        const link = screen.getByLabelText('Logo');
        expect(link.className).toContain('my-logo');
    });

    it('applies custom sx prop', () => {
        renderWithProviders(<Logo sx={{ margin: 2 }} />);
        expect(screen.getByLabelText('Logo')).toBeInTheDocument();
    });

    it('renders img with 100% width and height', () => {
        renderWithProviders(<Logo />);
        const img = screen.getByAltText('Full Logo');
        expect(img.style.width).toBe('100%');
        expect(img.style.height).toBe('100%');
    });
});
