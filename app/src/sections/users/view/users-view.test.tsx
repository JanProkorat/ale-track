import React from 'react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { UserRoleType, UserListItemDto } from 'src/api/Client';
import { screen, waitFor, renderWithProviders } from 'src/test/test-utils';

import { UsersView } from './users-view';

const cssVarsTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
function renderView(ui: React.ReactElement) {
    return renderWithProviders(ui, { theme: cssVarsTheme });
}

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

vi.mock('minimal-shared/utils', () => ({
    varAlpha: () => 'rgba(0,0,0,0.16)',
    mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('../../../components/iconify', () => ({
    Iconify: ({ icon }: { icon: string }) => <span data-testid="iconify">{icon}</span>,
}));

const mockExecuteApiCallWithDefault = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCallWithDefault: mockExecuteApiCallWithDefault,
    }),
}));

const mockFetchUsers = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class {
        fetchUsers = mockFetchUsers;
    },
}));

vi.mock('../detail-view/user-detail-view', () => ({
    UserDetailView: () => <div data-testid="user-detail-view" />,
}));

vi.mock('../detail-view/create-user-view', () => ({
    CreateUserView: ({ onClose, onSave }: { onClose: () => void; onSave: (id: string) => void }) => (
        <div data-testid="create-user-view">
            <button onClick={onClose}>closeDrawer</button>
            <button onClick={() => onSave('new-id')}>saveUser</button>
        </div>
    ),
}));

function createUsers(): UserListItemDto[] {
    return [
        new UserListItemDto({ id: 'u1', userName: 'admin', firstName: 'John', lastName: 'Doe', userRoles: [UserRoleType.Admin] }),
        new UserListItemDto({ id: 'u2', userName: 'editor', firstName: 'Jane', lastName: 'Smith', userRoles: [UserRoleType.User] }),
    ];
}

describe('UsersView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCallWithDefault.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockFetchUsers.mockResolvedValue(createUsers());
    });

    it('should render the title', async () => {
        renderView(<UsersView />);

        await waitFor(() => {
            expect(screen.getByText('users.title')).toBeInTheDocument();
        });
    });

    it('should render new user button', async () => {
        renderView(<UsersView />);

        await waitFor(() => {
            expect(screen.getByText('users.new')).toBeInTheDocument();
        });
    });

    it('should fetch and display users in table', async () => {
        renderView(<UsersView />);

        await waitFor(() => {
            expect(screen.getByText('admin')).toBeInTheDocument();
        });

        expect(screen.getByText('editor')).toBeInTheDocument();
    });

    it('should render table header', async () => {
        renderView(<UsersView />);

        await waitFor(() => {
            expect(screen.getByText('users.userName')).toBeInTheDocument();
        });
    });

    it('should show empty state when no users', async () => {
        mockFetchUsers.mockResolvedValue([]);

        renderView(<UsersView />);

        await waitFor(() => {
            expect(screen.getByText('table.noDataTitle')).toBeInTheDocument();
        });
    });

    it('should render user detail view', async () => {
        renderView(<UsersView />);

        await waitFor(() => {
            expect(screen.getByTestId('user-detail-view')).toBeInTheDocument();
        });
    });

    it('should open create drawer when new button is clicked', async () => {
        renderView(<UsersView />);

        await waitFor(() => {
            expect(screen.getByText('users.new')).toBeInTheDocument();
        });

        screen.getByText('users.new').click();

        await waitFor(() => {
            expect(screen.getByTestId('create-user-view')).toBeInTheDocument();
        });
    });

    it('should call fetchUsers on mount', async () => {
        renderView(<UsersView />);

        await waitFor(() => {
            expect(mockFetchUsers).toHaveBeenCalled();
        });
    });

    it('should filter toolbar be rendered', async () => {
        renderView(<UsersView />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('users.userName...')).toBeInTheDocument();
        });
    });
});
