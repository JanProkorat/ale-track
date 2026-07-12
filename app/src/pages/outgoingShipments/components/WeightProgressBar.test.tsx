import { screen, renderWithProviders } from 'src/test/test-utils';

import WeightProgressBar from './WeightProgressBar';

vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: (key: string) => key }),
}));

describe('WeightProgressBar', () => {
     it('returns null when maxWeight is 0', () => {
          const { container } = renderWithProviders(
               <WeightProgressBar currentWeight={10} maxWeight={0} />,
          );
          expect(container.innerHTML).toBe('');
     });

     it('returns null when maxWeight is negative', () => {
          const { container } = renderWithProviders(
               <WeightProgressBar currentWeight={10} maxWeight={-5} />,
          );
          expect(container.innerHTML).toBe('');
     });

     it('displays weight text "X.X / Y kg"', () => {
          renderWithProviders(
               <WeightProgressBar currentWeight={25} maxWeight={100} />,
          );
          expect(screen.getByText('25.0 / 100 kg')).toBeInTheDocument();
     });

     it('displays the translated label', () => {
          renderWithProviders(
               <WeightProgressBar currentWeight={10} maxWeight={100} />,
          );
          expect(screen.getByText('vehicles.maxWeight')).toBeInTheDocument();
     });

     it('shows progressbar with correct value when under 80%', () => {
          renderWithProviders(
               <WeightProgressBar currentWeight={50} maxWeight={100} />,
          );
          const progressbar = screen.getByRole('progressbar');
          expect(progressbar).toHaveAttribute('aria-valuenow', '50');
     });

     it('shows progressbar with correct value when between 80-100%', () => {
          renderWithProviders(
               <WeightProgressBar currentWeight={85} maxWeight={100} />,
          );
          const progressbar = screen.getByRole('progressbar');
          expect(progressbar).toHaveAttribute('aria-valuenow', '85');
     });

     it('caps progress bar value at 100 even when over', () => {
          renderWithProviders(
               <WeightProgressBar currentWeight={150} maxWeight={100} />,
          );
          const progressbar = screen.getByRole('progressbar');
          expect(progressbar).toHaveAttribute('aria-valuenow', '100');
     });
});

describe('weight color logic', () => {
     function getColor(currentWeight: number, maxWeight: number) {
          const percentage = Math.min((currentWeight / maxWeight) * 100, 100);
          const isOver = currentWeight > maxWeight;
          const isWarning = percentage >= 80 && !isOver;
          return isOver ? 'error' : isWarning ? 'warning' : 'success';
     }

     it('returns success when under 80%', () => {
          expect(getColor(50, 100)).toBe('success');
     });

     it('returns success at 79%', () => {
          expect(getColor(79, 100)).toBe('success');
     });

     it('returns warning at exactly 80%', () => {
          expect(getColor(80, 100)).toBe('warning');
     });

     it('returns warning at 90%', () => {
          expect(getColor(90, 100)).toBe('warning');
     });

     it('returns warning at exactly 100%', () => {
          expect(getColor(100, 100)).toBe('warning');
     });

     it('returns error when over 100%', () => {
          expect(getColor(150, 100)).toBe('error');
     });

     it('returns error when slightly over', () => {
          expect(getColor(100.1, 100)).toBe('error');
     });
});
