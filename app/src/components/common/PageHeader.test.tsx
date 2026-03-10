import { screen, renderWithProviders } from 'src/test/test-utils';

import PageHeader from './PageHeader';

describe('PageHeader', () => {
     it('renders title as heading', () => {
          renderWithProviders(<PageHeader title="My Page" />);

          expect(screen.getByRole('heading', { name: 'My Page' })).toBeInTheDocument();
     });

     it('renders action when provided', () => {
          renderWithProviders(<PageHeader title="My Page" action={<button>Create</button>} />);

          expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
     });

     it('does not render action container when action is not provided', () => {
          renderWithProviders(<PageHeader title="My Page" />);

          // The action is wrapped in a Box with flexShrink: 0; when no action, only the title Box exists
          const heading = screen.getByRole('heading', { name: 'My Page' });
          const parentBox = heading.parentElement;
          // Only the heading Typography should be a child, no extra Box for action
          expect(parentBox?.children).toHaveLength(1);
     });
});
