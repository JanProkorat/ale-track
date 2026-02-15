import { MemoryRouter } from 'react-router';
import { it, expect, describe } from 'vitest';
import { render } from '@testing-library/react';

import { RouterLink } from './router-link';

// ------------------------------------
// Tests
// ------------------------------------
describe('RouterLink', () => {
    it('renders an anchor element', () => {
        const { container } = render(
            <MemoryRouter>
                <RouterLink href="/dashboard">Dashboard</RouterLink>
            </MemoryRouter>
        );

        const link = container.querySelector('a');
        expect(link).toBeInTheDocument();
    });

    it('renders children', () => {
        const { getByText } = render(
            <MemoryRouter>
                <RouterLink href="/dashboard">Dashboard</RouterLink>
            </MemoryRouter>
        );

        expect(getByText('Dashboard')).toBeInTheDocument();
    });

    it('sets the href as the Link to prop', () => {
        const { container } = render(
            <MemoryRouter>
                <RouterLink href="/clients">Clients</RouterLink>
            </MemoryRouter>
        );

        const link = container.querySelector('a');
        expect(link).toHaveAttribute('href', '/clients');
    });

    it('passes additional props to the Link', () => {
        const { container } = render(
            <MemoryRouter>
                <RouterLink href="/test" className="custom-link">
                    Test
                </RouterLink>
            </MemoryRouter>
        );

        const link = container.querySelector('a');
        expect(link).toHaveClass('custom-link');
    });
});
