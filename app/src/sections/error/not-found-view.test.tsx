import { it, vi, expect, describe } from 'vitest';

import { screen, render } from 'src/test/test-utils';

import { NotFoundView } from './not-found-view';

vi.mock('src/routes/components', () => ({
    RouterLink: 'a',
}));

vi.mock('src/components/logo', () => ({
    Logo: () => <div data-testid="logo" />,
}));

describe('NotFoundView', () => {
    it('should render the 404 title', () => {
        render(<NotFoundView />);

        expect(screen.getByText('Sorry, page not found!')).toBeInTheDocument();
    });

    it('should render the description text', () => {
        render(<NotFoundView />);

        // The description text includes apostrophes, verify a unique part
        expect(screen.getByText(/check your spelling/)).toBeInTheDocument();
    });

    it('should render the 404 illustration', () => {
        render(<NotFoundView />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', '/assets/illustrations/illustration-404.svg');
    });

    it('should render a go to home button', () => {
        render(<NotFoundView />);

        const button = screen.getByText('Go to home');
        expect(button).toBeInTheDocument();
    });

    it('should render the logo', () => {
        render(<NotFoundView />);

        expect(screen.getByTestId('logo')).toBeInTheDocument();
    });
});
