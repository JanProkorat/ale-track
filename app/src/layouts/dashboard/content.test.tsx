import { it, vi, expect, describe } from 'vitest';

import { screen, renderWithProviders } from 'src/test/test-utils';

import { DashboardContent } from './content';

// -------------------------------------------------------------------

vi.mock('minimal-shared/utils', () => ({
    mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe('DashboardContent', () => {
    it('renders children', () => {
        renderWithProviders(
            <DashboardContent>
                <div data-testid="content">Hello</div>
            </DashboardContent>
        );
        expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders container with id', () => {
        const { container } = renderWithProviders(
            <DashboardContent>Content</DashboardContent>
        );
        expect(container.querySelector('#test-dashboard')).toBeInTheDocument();
    });

    it('merges custom className', () => {
        const { container } = renderWithProviders(
            <DashboardContent className="custom-class">Content</DashboardContent>
        );
        const el = container.querySelector('#test-dashboard');
        expect(el?.className).toContain('custom-class');
    });

    it('renders with disablePadding', () => {
        renderWithProviders(
            <DashboardContent disablePadding>Content</DashboardContent>
        );
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders with custom maxWidth', () => {
        renderWithProviders(
            <DashboardContent maxWidth="sm">Content</DashboardContent>
        );
        expect(screen.getByText('Content')).toBeInTheDocument();
    });
});
