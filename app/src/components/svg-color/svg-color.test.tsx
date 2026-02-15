import { it, vi, expect, describe } from 'vitest';

import { renderWithProviders } from 'src/test/test-utils';

import { SvgColor } from './svg-color';

// ------------------------------------
// Mocks
// ------------------------------------
vi.mock('minimal-shared/utils', () => ({
    mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

// ------------------------------------
// Tests
// ------------------------------------
describe('SvgColor', () => {
    it('renders a span element', () => {
        const { container } = renderWithProviders(<SvgColor src="/test.svg" />);

        const span = container.querySelector('span');
        expect(span).toBeInTheDocument();
    });

    it('applies svg color root class', () => {
        const { container } = renderWithProviders(<SvgColor src="/test.svg" />);

        const span = container.querySelector('span');
        expect(span?.className).toContain('svg__color__root');
    });

    it('merges custom className', () => {
        const { container } = renderWithProviders(<SvgColor src="/test.svg" className="custom-class" />);

        const span = container.querySelector('span');
        expect(span?.className).toContain('custom-class');
    });

    it('passes additional props to the span', () => {
        const { container } = renderWithProviders(
            <SvgColor src="/test.svg" data-testid="svg-color" />
        );

        const span = container.querySelector('[data-testid="svg-color"]');
        expect(span).toBeInTheDocument();
    });
});
