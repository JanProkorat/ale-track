import { screen, userEvent, renderWithProviders } from 'src/test/test-utils';

import ConfirmDialog from './ConfirmDialog';

vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: (key: string) => key }),
}));

const defaultProps = {
     open: true,
     title: 'Delete item',
     message: 'Are you sure you want to delete this item?',
     onConfirm: vi.fn(),
     onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('renders title and message when open', () => {
          renderWithProviders(<ConfirmDialog {...defaultProps} />);

          expect(screen.getByText('Delete item')).toBeInTheDocument();
          expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
     });

     it('does not render content when closed', () => {
          renderWithProviders(<ConfirmDialog {...defaultProps} open={false} />);

          expect(screen.queryByText('Delete item')).not.toBeInTheDocument();
          expect(screen.queryByText('Are you sure you want to delete this item?')).not.toBeInTheDocument();
     });

     it('calls onCancel when cancel button clicked', async () => {
          const user = userEvent.setup();
          const onCancel = vi.fn();

          renderWithProviders(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);

          await user.click(screen.getByRole('button', { name: 'common.cancel' }));

          expect(onCancel).toHaveBeenCalledTimes(1);
     });

     it('calls onConfirm when confirm button clicked', async () => {
          const user = userEvent.setup();
          const onConfirm = vi.fn();

          renderWithProviders(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

          await user.click(screen.getByRole('button', { name: 'common.confirm' }));

          expect(onConfirm).toHaveBeenCalledTimes(1);
     });

     it('uses default label translations when no custom labels', () => {
          renderWithProviders(<ConfirmDialog {...defaultProps} />);

          expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: 'common.confirm' })).toBeInTheDocument();
     });

     it('uses custom labels when provided', () => {
          renderWithProviders(
               <ConfirmDialog {...defaultProps} cancelLabel="Go back" confirmLabel="Yes, delete" />,
          );

          expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
     });

     it('cancel button is disabled when loading', () => {
          renderWithProviders(<ConfirmDialog {...defaultProps} loading />);

          expect(screen.getByRole('button', { name: 'common.cancel' })).toBeDisabled();
     });
});
