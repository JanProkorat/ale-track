import { it, vi, expect, describe } from 'vitest';

import { screen, render } from 'src/test/test-utils';

import { WeightInfoBox } from './weight-info-box';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

describe('WeightInfoBox', () => {
    it('should render the label with Kg suffix', () => {
        render(<WeightInfoBox currentWeight={10} maxWeight={100} />);

        expect(screen.getAllByText('outgoingShipments.weight (Kg)').length).toBeGreaterThanOrEqual(1);
    });

    it('should display "currentWeight / maxWeight" when both are provided', () => {
        render(<WeightInfoBox currentWeight={50} maxWeight={200} />);

        expect(screen.getByDisplayValue('50 / 200')).toBeInTheDocument();
    });

    it('should display "currentWeight / __" when maxWeight is undefined', () => {
        render(<WeightInfoBox currentWeight={50} maxWeight={undefined} />);

        expect(screen.getByDisplayValue('50 / __')).toBeInTheDocument();
    });

    it('should display "0 / maxWeight" when currentWeight is undefined', () => {
        render(<WeightInfoBox currentWeight={undefined} maxWeight={200} />);

        expect(screen.getByDisplayValue('0 / 200')).toBeInTheDocument();
    });

    it('should display empty value when both are undefined', () => {
        render(<WeightInfoBox currentWeight={undefined} maxWeight={undefined} />);

        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('');
    });

    it('should show error state when currentWeight exceeds maxWeight', () => {
        render(<WeightInfoBox currentWeight={300} maxWeight={200} />);

        const labels = screen.getAllByText('outgoingShipments.weight (Kg)');
        expect(labels[0]).toHaveClass('Mui-error');
    });

    it('should not show error state when currentWeight is within maxWeight', () => {
        render(<WeightInfoBox currentWeight={100} maxWeight={200} />);

        const labels = screen.getAllByText('outgoingShipments.weight (Kg)');
        expect(labels[0]).not.toHaveClass('Mui-error');
    });

    it('should always be disabled', () => {
        render(<WeightInfoBox currentWeight={10} maxWeight={100} />);

        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });
});
