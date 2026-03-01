import { it, vi, expect, describe } from 'vitest';

import { screen, render } from 'src/test/test-utils';

import { OverviewAnalyticsView } from './overview-analytics-view';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

// Mock DashboardContent
vi.mock('src/layouts/dashboard', () => ({
    DashboardContent: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dashboard-content">{children}</div>
    ),
}));

// Mock child components
vi.mock('../components/reminders-overview', () => ({
    RemindersOverview: () => <div data-testid="reminders-overview" />,
}));

vi.mock('../components/order-items-reminders-view', () => ({
    OrderItemsRemindersView: () => <div data-testid="order-items-reminders-view" />,
}));

describe('OverviewAnalyticsView', () => {
    it('should render the welcome heading', () => {
        render(<OverviewAnalyticsView />);

        expect(screen.getByText(/dashboard\.welcome/)).toBeInTheDocument();
    });

    it('should render within DashboardContent', () => {
        render(<OverviewAnalyticsView />);

        expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });

    it('should render RemindersOverview component', () => {
        render(<OverviewAnalyticsView />);

        expect(screen.getByTestId('reminders-overview')).toBeInTheDocument();
    });

    it('should render OrderItemsRemindersView component', () => {
        render(<OverviewAnalyticsView />);

        expect(screen.getByTestId('order-items-reminders-view')).toBeInTheDocument();
    });

    it('should display the wave emoji in the welcome message', () => {
        render(<OverviewAnalyticsView />);

        expect(screen.getByText(/👋/)).toBeInTheDocument();
    });
});
