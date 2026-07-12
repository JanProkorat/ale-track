import { screen, renderWithProviders } from 'src/test/test-utils';

import EmptyState from './EmptyState';

vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: (key: string) => key }),
}));

describe('EmptyState', () => {
     it('renders default message when no message prop is provided', () => {
          renderWithProviders(<EmptyState />);

          expect(screen.getByText('common.noData')).toBeInTheDocument();
     });

     it('renders custom message when provided', () => {
          renderWithProviders(<EmptyState message="Nothing here" />);

          expect(screen.getByText('Nothing here')).toBeInTheDocument();
     });

     it('renders custom action when provided', () => {
          renderWithProviders(<EmptyState action={<button>Add item</button>} />);

          expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
     });

     it('renders without action when not provided', () => {
          renderWithProviders(<EmptyState />);

          expect(screen.queryByRole('button')).not.toBeInTheDocument();
     });
});
