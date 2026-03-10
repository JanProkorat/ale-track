import { screen, renderWithProviders } from 'src/test/test-utils';

import LoadingSpinner from './LoadingSpinner';

vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LoadingSpinner', () => {
     it('renders default message', () => {
          renderWithProviders(<LoadingSpinner />);

          expect(screen.getByText('common.loading')).toBeInTheDocument();
     });

     it('renders custom message when provided', () => {
          renderWithProviders(<LoadingSpinner message="Please wait..." />);

          expect(screen.getByText('Please wait...')).toBeInTheDocument();
     });

     it('renders CircularProgress', () => {
          renderWithProviders(<LoadingSpinner />);

          expect(screen.getByRole('progressbar')).toBeInTheDocument();
     });
});
