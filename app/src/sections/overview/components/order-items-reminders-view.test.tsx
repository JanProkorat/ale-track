import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { OrderItemsRemindersView } from './order-items-reminders-view';

import type { ClientOrderReminderDto } from '../../../api/Client';

// Theme with CSS variables
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable mockT
const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

// Mock AuthorizedClient
const mockFetchOrderItemsRemindersOverview = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        fetchOrderItemsRemindersOverview = mockFetchOrderItemsRemindersOverview;
    },
}));

// Mock SnackbarProvider
const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({
        showSnackbar: mockShowSnackbar,
    }),
}));

// Mock useRouter
const mockPush = vi.fn();
vi.mock('../../../routes/hooks', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

// Mock formatDate
vi.mock('../../../locales/formatDate', () => ({
    formatDate: (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
}));

// Mock minimal-shared/utils
vi.mock('minimal-shared/utils', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        varAlpha: () => 'rgba(0,0,0,0.16)',
    };
});

// Mock Scrollbar
vi.mock('../../../components/scrollbar', () => ({
    Scrollbar: ({ children }: { children: React.ReactNode }) => <div data-testid="scrollbar">{children}</div>,
}));

// Mock SectionHeader
vi.mock('../../../components/label/section-header', () => ({
    SectionHeader: ({ text, children }: { text: string; children?: React.ReactNode }) => (
        <div data-testid="section-header">
            <span>{text}</span>
            {children}
        </div>
    ),
}));

// --- Test data ---
const mockReminders: ClientOrderReminderDto[] = [
    {
        clientId: 'c1',
        clientName: 'Restaurant Praha',
        orderItems: [
            {
                orderId: 'o1',
                productId: 'p1',
                productName: 'Pilsner',
                packageSize: 50,
                quantity: 10,
                deliveryDate: new Date(2026, 5, 15),
            },
            {
                orderId: 'o2',
                productId: 'p2',
                productName: 'IPA',
                packageSize: 0.5,
                quantity: 24,
                deliveryDate: undefined,
            },
        ],
    } as ClientOrderReminderDto,
    {
        clientId: 'c2',
        clientName: 'Beer Garden',
        orderItems: [
            {
                orderId: 'o3',
                productId: 'p3',
                productName: 'Lager',
                packageSize: 30,
                quantity: 5,
                deliveryDate: new Date(2026, 6, 1),
            },
        ],
    } as ClientOrderReminderDto,
];

describe('OrderItemsRemindersView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchOrderItemsRemindersOverview.mockResolvedValue([]);
    });

    // --- Header ---
    it('should show the section header', () => {
        render(<OrderItemsRemindersView />);

        expect(screen.getByText('orderItemReminders.title')).toBeInTheDocument();
    });

    // --- Empty state ---
    it('should show empty state when no reminders exist', async () => {
        mockFetchOrderItemsRemindersOverview.mockResolvedValue([]);

        render(<OrderItemsRemindersView />);

        await waitFor(() => {
            expect(screen.getByText('clientOrders.noUpcomingReminders')).toBeInTheDocument();
        });
    });

    // --- Populated state ---
    it('should display client sections after loading', async () => {
        mockFetchOrderItemsRemindersOverview.mockResolvedValue(mockReminders);

        render(<OrderItemsRemindersView />);

        await waitFor(() => {
            expect(screen.getByText('Restaurant Praha')).toBeInTheDocument();
        });
        expect(screen.getByText('Beer Garden')).toBeInTheDocument();
    });

    it('should display order item details', async () => {
        mockFetchOrderItemsRemindersOverview.mockResolvedValue(mockReminders);

        render(<OrderItemsRemindersView />);

        await waitFor(() => {
            expect(screen.getByText('Pilsner 50L - 10x')).toBeInTheDocument();
        });
        expect(screen.getByText('IPA 0.5L - 24x')).toBeInTheDocument();
        expect(screen.getByText('Lager 30L - 5x')).toBeInTheDocument();
    });

    it('should display delivery date for items that have one', async () => {
        mockFetchOrderItemsRemindersOverview.mockResolvedValue(mockReminders);

        render(<OrderItemsRemindersView />);

        await waitFor(() => {
            expect(screen.getByText('common.until: 2026-06-15')).toBeInTheDocument();
        });
    });

    it('should call fetchOrderItemsRemindersOverview on mount', async () => {
        mockFetchOrderItemsRemindersOverview.mockResolvedValue([]);

        render(<OrderItemsRemindersView />);

        await waitFor(() => {
            expect(mockFetchOrderItemsRemindersOverview).toHaveBeenCalledTimes(1);
        });
    });

    // --- Error handling ---
    it('should show snackbar on fetch error', async () => {
        mockFetchOrderItemsRemindersOverview.mockRejectedValue(new Error('Network error'));

        render(<OrderItemsRemindersView />);

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('clientOrders.fetchError', 'error');
        });
    });

    // --- Navigation ---
    it('should navigate to client detail when client open icon is clicked', async () => {
        const user = userEvent.setup();
        mockFetchOrderItemsRemindersOverview.mockResolvedValue([mockReminders[0]]);

        render(<OrderItemsRemindersView />);

        await waitFor(() => {
            expect(screen.getByText('Restaurant Praha')).toBeInTheDocument();
        });

        // Find the OpenInNew icon buttons - first one is for the client
        const openButtons = screen.getAllByTestId('OpenInNewIcon');
        await user.click(openButtons[0]);

        expect(mockPush).toHaveBeenCalledWith('/clients/c1');
    });

    it('should navigate to order detail when order open icon is clicked', async () => {
        const user = userEvent.setup();
        mockFetchOrderItemsRemindersOverview.mockResolvedValue([
            {
                clientId: 'c1',
                clientName: 'Restaurant Praha',
                orderItems: [
                    {
                        orderId: 'o1',
                        productId: 'p1',
                        productName: 'Pilsner',
                        packageSize: 50,
                        quantity: 10,
                        deliveryDate: new Date(2026, 5, 15),
                    },
                ],
            } as ClientOrderReminderDto,
        ]);

        render(<OrderItemsRemindersView />);

        await waitFor(() => {
            expect(screen.getByText('Pilsner 50L - 10x')).toBeInTheDocument();
        });

        // Second OpenInNew icon button is for the order item
        const openButtons = screen.getAllByTestId('OpenInNewIcon');
        await user.click(openButtons[1]);

        expect(mockPush).toHaveBeenCalledWith('/orders/o1');
    });
});
