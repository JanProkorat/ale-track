import { it, vi, expect, describe } from 'vitest';

import { screen, fireEvent, renderWithProviders } from 'src/test/test-utils';

import { SectionHeader } from './section-header';

// -------------------------------------------------------------------

describe('SectionHeader', () => {
    it('renders header text', () => {
        renderWithProviders(<SectionHeader text="My Section" />);
        expect(screen.getByText('My Section')).toBeInTheDocument();
    });

    it('uses subtitle1 variant by default', () => {
        renderWithProviders(<SectionHeader text="Title" />);
        const typography = screen.getByText('Title');
        expect(typography.tagName).toBe('H6'); // MUI subtitle1 renders as h6
    });

    it('renders with custom headerVariant', () => {
        renderWithProviders(<SectionHeader text="Title" headerVariant="h4" />);
        expect(screen.getByText('Title')).toBeInTheDocument();
    });

    it('renders children', () => {
        renderWithProviders(
            <SectionHeader text="Title">
                <button type="button">Action</button>
            </SectionHeader>
        );
        expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('calls onClick when text is clicked', () => {
        const handleClick = vi.fn();
        renderWithProviders(<SectionHeader text="Clickable" onClick={handleClick} />);
        fireEvent.click(screen.getByText('Clickable'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not throw when clicked without onClick handler', () => {
        renderWithProviders(<SectionHeader text="No handler" />);
        expect(() => fireEvent.click(screen.getByText('No handler'))).not.toThrow();
    });

    it('renders with bold by default', () => {
        renderWithProviders(<SectionHeader text="Bold" />);
        const el = screen.getByText('Bold');
        expect(el).toBeInTheDocument();
    });

    it('renders with bold explicitly false', () => {
        renderWithProviders(<SectionHeader text="Not bold" bold={false} />);
        expect(screen.getByText('Not bold')).toBeInTheDocument();
    });

    it('renders bottom border line by default', () => {
        const { container } = renderWithProviders(<SectionHeader text="Bordered" />);
        const box = container.firstElementChild as HTMLElement;
        expect(box).toBeInTheDocument();
    });

    it('hides bottom border line when bottomLineVisible is false', () => {
        const { container } = renderWithProviders(
            <SectionHeader text="No border" bottomLineVisible={false} />
        );
        const box = container.firstElementChild as HTMLElement;
        expect(box).toBeInTheDocument();
    });

    it('renders with custom sx prop', () => {
        renderWithProviders(<SectionHeader text="Styled" sx={{ padding: 2 }} />);
        expect(screen.getByText('Styled')).toBeInTheDocument();
    });
});
