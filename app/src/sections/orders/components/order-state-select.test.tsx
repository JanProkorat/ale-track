import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, render as baseRender } from 'src/test/test-utils';

import { OrderState } from '../../../api/Client';
import { OrderStateSelect } from './order-state-select';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference
const mockT = (key: string) => key;

// Mock react-i18next (partial)
vi.mock('react-i18next', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useTranslation: () => ({ t: mockT }),
    };
});

const mockOnSelect = vi.fn();

describe('OrderStateSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the state label', () => {
        render(<OrderStateSelect selectedState={OrderState.New} onSelect={mockOnSelect} />);

        expect(screen.getByText('orders.state')).toBeInTheDocument();
    });

    it('should display the selected state as a chip', () => {
        render(<OrderStateSelect selectedState={OrderState.New} onSelect={mockOnSelect} />);

        expect(screen.getByText(`orderState.${OrderState.New}`)).toBeInTheDocument();
    });

    it('should display Planning state chip when selected', () => {
        render(<OrderStateSelect selectedState={OrderState.Planning} onSelect={mockOnSelect} />);

        expect(screen.getByText(`orderState.${OrderState.Planning}`)).toBeInTheDocument();
    });

    it('should display Cancelled state chip when selected', () => {
        render(<OrderStateSelect selectedState={OrderState.Cancelled} onSelect={mockOnSelect} />);

        expect(screen.getByText(`orderState.${OrderState.Cancelled}`)).toBeInTheDocument();
    });

    it('should render as a combobox', () => {
        render(<OrderStateSelect selectedState={OrderState.New} onSelect={mockOnSelect} />);

        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
});
