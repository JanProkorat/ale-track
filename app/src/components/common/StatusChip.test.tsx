import { screen, renderWithProviders } from 'src/test/test-utils';

import StatusChip from './StatusChip';

describe('StatusChip', () => {
     it('renders the label text', () => {
          renderWithProviders(<StatusChip label="Active" />);

          expect(screen.getByText('Active')).toBeInTheDocument();
     });

     it('defaults to default color (chip is rendered)', () => {
          renderWithProviders(<StatusChip label="Pending" />);

          const chip = screen.getByText('Pending').closest('.MuiChip-root');
          expect(chip).toBeInTheDocument();
     });

     it('renders with specified color prop', () => {
          renderWithProviders(<StatusChip label="Success" color="success" />);

          const chip = screen.getByText('Success').closest('.MuiChip-root');
          expect(chip).toHaveClass('MuiChip-colorSuccess');
     });
});
