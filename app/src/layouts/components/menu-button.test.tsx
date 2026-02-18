import { it, vi, expect, describe } from 'vitest';

import { screen, fireEvent, renderWithProviders } from 'src/test/test-utils';

import { MenuButton } from './menu-button';

// -------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

describe('MenuButton', () => {
    it('renders an icon button', () => {
        renderWithProviders(<MenuButton />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders menu icon', () => {
        renderWithProviders(<MenuButton />);
        expect(screen.getByText('custom:menu-duotone')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn();
        renderWithProviders(<MenuButton onClick={handleClick} />);
        fireEvent.click(screen.getByRole('button'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
