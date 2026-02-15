import { it, vi, expect, describe, beforeEach } from 'vitest';

import { fireEvent, renderWithProviders } from 'src/test/test-utils';

import { NotificationsPopover } from './notifications-popover';

// ------------------------------------
// Mocks
// ------------------------------------
vi.mock('src/components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

vi.mock('src/components/scrollbar', () => ({
    Scrollbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('src/utils/format-time', () => ({
    fToNow: () => '5 minutes ago',
}));

const mockNotifications = [
    {
        id: '1',
        type: 'order-placed',
        title: 'Order 123',
        isUnRead: true,
        description: 'was placed',
        avatarUrl: null,
        postedAt: Date.now(),
    },
    {
        id: '2',
        type: 'mail',
        title: 'New email',
        isUnRead: true,
        description: 'received',
        avatarUrl: null,
        postedAt: Date.now(),
    },
    {
        id: '3',
        type: 'chat-message',
        title: 'Chat msg',
        isUnRead: false,
        description: 'hello',
        avatarUrl: null,
        postedAt: Date.now(),
    },
];

// ------------------------------------
// Tests
// ------------------------------------
describe('NotificationsPopover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the bell icon button', () => {
        const { getByRole } = renderWithProviders(<NotificationsPopover />);

        expect(getByRole('button')).toBeInTheDocument();
    });

    it('shows unread badge count', () => {
        const { getByText } = renderWithProviders(
            <NotificationsPopover data={mockNotifications} />
        );

        // 2 unread notifications
        expect(getByText('2')).toBeInTheDocument();
    });

    it('opens popover when button is clicked', () => {
        const { getByRole, getByText } = renderWithProviders(
            <NotificationsPopover data={mockNotifications} />
        );

        fireEvent.click(getByRole('button'));

        expect(getByText('Notifications')).toBeInTheDocument();
    });

    it('shows unread message count text', () => {
        const { getByRole, getByText } = renderWithProviders(
            <NotificationsPopover data={mockNotifications} />
        );

        fireEvent.click(getByRole('button'));

        expect(getByText('You have 2 unread messages')).toBeInTheDocument();
    });

    it('shows mark all as read button when there are unread messages', () => {
        const { getByRole, getByLabelText } = renderWithProviders(
            <NotificationsPopover data={mockNotifications} />
        );

        fireEvent.click(getByRole('button'));

        expect(getByLabelText(/Mark all as read/)).toBeInTheDocument();
    });

    it('marks all as read when mark all button is clicked', () => {
        const { getByRole, getByLabelText, getByText } = renderWithProviders(
            <NotificationsPopover data={mockNotifications} />
        );

        fireEvent.click(getByRole('button'));
        fireEvent.click(getByLabelText(/Mark all as read/)); expect(getByText('You have 0 unread messages')).toBeInTheDocument();
    });

    it('shows New and Before that sections', () => {
        const { getByRole, getByText } = renderWithProviders(
            <NotificationsPopover data={mockNotifications} />
        );

        fireEvent.click(getByRole('button'));

        expect(getByText('New')).toBeInTheDocument();
        expect(getByText('Before that')).toBeInTheDocument();
    });

    it('shows View all button', () => {
        const { getByRole, getByText } = renderWithProviders(
            <NotificationsPopover data={mockNotifications} />
        );

        fireEvent.click(getByRole('button'));

        expect(getByText('View all')).toBeInTheDocument();
    });

    it('renders notification titles', () => {
        const { getByRole, getByText } = renderWithProviders(
            <NotificationsPopover data={mockNotifications} />
        );

        fireEvent.click(getByRole('button'));

        expect(getByText('Order 123')).toBeInTheDocument();
        expect(getByText('New email')).toBeInTheDocument();
    });

    it('renders with no notifications', () => {
        const { getByRole, getByText } = renderWithProviders(
            <NotificationsPopover data={[]} />
        );

        fireEvent.click(getByRole('button'));

        expect(getByText('You have 0 unread messages')).toBeInTheDocument();
    });
});
