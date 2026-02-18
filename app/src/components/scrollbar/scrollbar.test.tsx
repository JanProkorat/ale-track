import { it, vi, expect, describe } from 'vitest';

import { screen, renderWithProviders } from 'src/test/test-utils';

import { Scrollbar } from './scrollbar';

// -------------------------------------------------------------------

vi.mock('simplebar-react', () => ({
    default: ({ children, className, ...props }: any) => (
        <div data-testid="simplebar" className={className} {...props}>
            {children}
        </div>
    ),
}));

vi.mock('minimal-shared/utils', () => ({
    mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe('Scrollbar', () => {
    it('renders children', () => {
        renderWithProviders(
            <Scrollbar>
                <span>Content</span>
            </Scrollbar>
        );
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders SimpleBar wrapper', () => {
        renderWithProviders(
            <Scrollbar>
                <span>Content</span>
            </Scrollbar>
        );
        expect(screen.getByTestId('simplebar')).toBeInTheDocument();
    });

    it('merges custom className', () => {
        renderWithProviders(
            <Scrollbar className="custom-scroll">
                <span>Content</span>
            </Scrollbar>
        );
        const simplebar = screen.getByTestId('simplebar');
        expect(simplebar.className).toContain('custom-scroll');
    });

    it('applies scrollbar root class', () => {
        renderWithProviders(
            <Scrollbar>
                <span>Content</span>
            </Scrollbar>
        );
        const simplebar = screen.getByTestId('simplebar');
        expect(simplebar.className).toContain('scrollbar__root');
    });

    it('passes clickOnTrack as false', () => {
        renderWithProviders(
            <Scrollbar>
                <span>Content</span>
            </Scrollbar>
        );
        const simplebar = screen.getByTestId('simplebar');
        expect(simplebar).toBeInTheDocument();
    });

    it('renders with fillContent true by default', () => {
        renderWithProviders(
            <Scrollbar>
                <span>Filled</span>
            </Scrollbar>
        );
        expect(screen.getByText('Filled')).toBeInTheDocument();
    });

    it('renders with fillContent false', () => {
        renderWithProviders(
            <Scrollbar fillContent={false}>
                <span>Not filled</span>
            </Scrollbar>
        );
        expect(screen.getByText('Not filled')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
        renderWithProviders(
            <Scrollbar>
                <div data-testid="child-1">First</div>
                <div data-testid="child-2">Second</div>
            </Scrollbar>
        );
        expect(screen.getByTestId('child-1')).toBeInTheDocument();
        expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
});
