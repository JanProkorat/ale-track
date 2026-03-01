import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, fireEvent, render as baseRender } from 'src/test/test-utils';

import { PlanningStateTab } from './planning-state-tab';

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

const mockOnPlanningStateChange = vi.fn();

describe('PlanningStateTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render all planning state tabs', () => {
        render(<PlanningStateTab onPlanningStateChange={mockOnPlanningStateChange} />);

        expect(screen.getByText('PlanningState.Active')).toBeInTheDocument();
        expect(screen.getByText('PlanningState.Finished')).toBeInTheDocument();
        expect(screen.getByText('PlanningState.Cancelled')).toBeInTheDocument();
    });

    it('should have Active tab selected by default', () => {
        render(<PlanningStateTab onPlanningStateChange={mockOnPlanningStateChange} />);

        const activeTab = screen.getByRole('tab', { name: 'PlanningState.Active' });
        expect(activeTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should call onPlanningStateChange when a tab is clicked', () => {
        render(<PlanningStateTab onPlanningStateChange={mockOnPlanningStateChange} />);

        screen.getByRole('tab', { name: 'PlanningState.Finished' }).click();

        expect(mockOnPlanningStateChange).toHaveBeenCalled();
    });

    it('should switch selected tab when clicked', async () => {
        render(<PlanningStateTab onPlanningStateChange={mockOnPlanningStateChange} />);

        fireEvent.click(screen.getByRole('tab', { name: 'PlanningState.Cancelled' }));

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: 'PlanningState.Cancelled' })).toHaveAttribute(
                'aria-selected',
                'true'
            );
            expect(screen.getByRole('tab', { name: 'PlanningState.Active' })).toHaveAttribute(
                'aria-selected',
                'false'
            );
        });
    });
});
