import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, render as baseRender } from 'src/test/test-utils';

import { RegionSelect } from './region-select';
import { Region } from '../../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference
const mockT = (key: string) => key;
vi.mock('react-i18next', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        useTranslation: () => ({ t: mockT }),
    };
});

// --- Default props ---
const mockOnSelect = vi.fn();
const defaultProps = {
    selectedRegion: Region.ZittauCity,
    errors: {} as Record<string, string>,
    onSelect: mockOnSelect,
};

describe('RegionSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Rendering ---
    it('should render the region select with label', () => {
        render(<RegionSelect {...defaultProps} />);

        expect(screen.getByLabelText('clients.region')).toBeInTheDocument();
    });

    it('should display the selected region as a chip', () => {
        render(<RegionSelect {...defaultProps} />);

        expect(screen.getByText('region.ZittauCity')).toBeInTheDocument();
    });

    it('should display a different region when selected', () => {
        render(<RegionSelect {...defaultProps} selectedRegion={Region.Berlin} />);

        expect(screen.getByText('region.Berlin')).toBeInTheDocument();
    });

    // --- Disabled state ---
    it('should render as disabled when disabled prop is true', () => {
        render(<RegionSelect {...defaultProps} disabled />);

        // The select input should have aria-disabled
        const combobox = screen.getByRole('combobox');
        expect(combobox).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not be disabled by default', () => {
        render(<RegionSelect {...defaultProps} />);

        const combobox = screen.getByRole('combobox');
        expect(combobox).not.toHaveAttribute('aria-disabled');
    });

    // --- Error state ---
    it('should show error state when region error exists', () => {
        render(<RegionSelect {...defaultProps} errors={{ region: 'Required' }} />);

        // The InputLabel should have error class when FormControl has error prop
        const label = screen.getByText('clients.region');
        expect(label).toHaveClass('Mui-error');
    });

    it('should not show error state when no region error', () => {
        render(<RegionSelect {...defaultProps} errors={{}} />);

        const label = screen.getByText('clients.region');
        expect(label).not.toHaveClass('Mui-error');
    });
});
