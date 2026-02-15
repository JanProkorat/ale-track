import { screen } from '@testing-library/react';
import { it, vi, expect, describe } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { renderWithProviders } from 'src/test/test-utils';

import { Label } from './label';

import type { LabelColor, LabelVariant } from './types';

// -------------------------------------------------------------------

vi.mock('minimal-shared/utils', () => ({
    mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
    varAlpha: () => 'rgba(0,0,0,0.16)',
}));

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });

function renderLabel(ui: React.ReactElement) {
    return renderWithProviders(ui, { theme: cssVarsTheme });
}

describe('Label', () => {
    it('renders children text with upperFirst', () => {
        renderLabel(<Label>hello world</Label>);
        expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders non-string children as-is', () => {
        renderLabel(
            <Label>
                <span data-testid="child">Custom</span>
            </Label>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('uses soft variant and default color by default', () => {
        const { container } = renderLabel(<Label>test</Label>);
        const span = container.querySelector('span');
        expect(span).toBeInTheDocument();
    });

    it('renders start icon', () => {
        renderLabel(
            <Label startIcon={<span data-testid="start-icon">★</span>}>labeled</Label>
        );
        expect(screen.getByTestId('start-icon')).toBeInTheDocument();
    });

    it('renders end icon', () => {
        renderLabel(
            <Label endIcon={<span data-testid="end-icon">✓</span>}>labeled</Label>
        );
        expect(screen.getByTestId('end-icon')).toBeInTheDocument();
    });

    it('renders both start and end icons', () => {
        renderLabel(
            <Label
                startIcon={<span data-testid="s-icon">★</span>}
                endIcon={<span data-testid="e-icon">✓</span>}
            >
                labeled
            </Label>
        );
        expect(screen.getByTestId('s-icon')).toBeInTheDocument();
        expect(screen.getByTestId('e-icon')).toBeInTheDocument();
    });

    it('does not render icons when not provided', () => {
        const { container } = renderLabel(<Label>no icons</Label>);
        expect(container.querySelectorAll('[class*="label__icon"]')).toHaveLength(0);
    });

    it('applies disabled styles', () => {
        const { container } = renderLabel(<Label disabled>disabled</Label>);
        const root = container.firstElementChild as HTMLElement;
        expect(root).toBeInTheDocument();
    });

    it.each<LabelVariant>(['filled', 'outlined', 'soft', 'inverted'])(
        'renders with variant %s',
        (variant) => {
            renderLabel(<Label variant={variant}>test</Label>);
            expect(screen.getByText('Test')).toBeInTheDocument();
        }
    );

    it.each<LabelColor>(['default', 'primary', 'secondary', 'info', 'success', 'warning', 'error'])(
        'renders with color %s',
        (color) => {
            renderLabel(<Label color={color}>test</Label>);
            expect(screen.getByText('Test')).toBeInTheDocument();
        }
    );

    it('merges custom className', () => {
        const { container } = renderLabel(<Label className="custom">test</Label>);
        const root = container.firstElementChild as HTMLElement;
        expect(root.className).toContain('custom');
    });
});
