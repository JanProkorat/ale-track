import { it, vi, expect, describe, beforeEach } from 'vitest';

import { UserRoleType, UserListItemDto } from 'src/api/Client';
import { act, screen, render, waitFor } from 'src/test/test-utils';

import { UserDetailView } from './user-detail-view';

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockShowSnackbar = vi.fn();
vi.mock('../../../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

const mockExecuteApiCall = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
    }),
}));

const mockUpdateUser = vi.fn();
const mockDeleteUser = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class {
        updateUserEndpoint = mockUpdateUser;
        deleteUserEndpoint = mockDeleteUser;
    },
}));

let mockOnFetchEntity: (() => Promise<void>) | undefined;
let mockOnSaveEntity: (() => Promise<boolean>) | undefined;
let mockOnDeleteEntity: (() => Promise<void>) | undefined;
let mockOnResetEntity: (() => void) | undefined;

vi.mock('../../../layouts/dashboard/detail-card-layout', () => ({
    DetailCardLayout: ({
        title,
        children,
        onFetchEntity,
        onSaveEntity,
        onDeleteEntity,
        onResetEntity,
    }: {
        title: string;
        children: React.ReactNode;
        onFetchEntity: () => Promise<void>;
        onSaveEntity: () => Promise<boolean>;
        onDeleteEntity: () => Promise<void>;
        onResetEntity: () => void;
    }) => {
        mockOnFetchEntity = onFetchEntity;
        mockOnSaveEntity = onSaveEntity;
        mockOnDeleteEntity = onDeleteEntity;
        mockOnResetEntity = onResetEntity;
        return (
            <div data-testid="detail-card-layout">
                <span>{title}</span>
                {children}
            </div>
        );
    },
}));

vi.mock('./update-user-view', () => ({
    UpdateUserView: ({ user }: { user: { firstName?: string; lastName?: string } }) => (
        <div data-testid="update-user-view">
            {user.firstName} {user.lastName}
        </div>
    ),
}));

const mockOnDelete = vi.fn();
const mockOnProgressbarChange = vi.fn();

function createUser(overrides: Partial<UserListItemDto> = {}): UserListItemDto {
    return new UserListItemDto({
        id: 'u1',
        userName: 'admin',
        firstName: 'John',
        lastName: 'Doe',
        userRoles: [UserRoleType.Admin],
        ...overrides,
    });
}

describe('UserDetailView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
        mockOnFetchEntity = undefined;
        mockOnSaveEntity = undefined;
        mockOnDeleteEntity = undefined;
        mockOnResetEntity = undefined;
    });

    it('should render no detail message when user is undefined', () => {
        render(
            <UserDetailView
                user={undefined}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        expect(screen.getByText('users.noDetailToDisplay')).toBeInTheDocument();
    });

    it('should render detail card layout when user is provided', () => {
        render(
            <UserDetailView
                user={createUser()}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        expect(screen.getByTestId('detail-card-layout')).toBeInTheDocument();
    });

    it('should render title with userName', () => {
        render(
            <UserDetailView
                user={createUser({ userName: 'testadmin' })}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        expect(screen.getByText('users.detailTitle - testadmin')).toBeInTheDocument();
    });

    it('should populate user detail on fetch', async () => {
        render(
            <UserDetailView
                user={createUser()}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        // Trigger fetch via the exposed callback
        await mockOnFetchEntity!();

        await waitFor(() => {
            expect(mockOnProgressbarChange).toHaveBeenCalledWith(false);
        });
    });

    it('should call update API on save', async () => {
        mockUpdateUser.mockResolvedValue('ok');

        render(
            <UserDetailView
                user={createUser()}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        // Fetch first to populate userDetail
        await act(async () => {
            await mockOnFetchEntity!();
        });

        const result = await mockOnSaveEntity!();

        expect(mockUpdateUser).toHaveBeenCalledWith('u1', expect.any(Object));
        expect(result).toBe(true);
    });

    it('should show validation error when saving with no roles', async () => {
        render(
            <UserDetailView
                user={createUser({ userRoles: [] })}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        await act(async () => {
            await mockOnFetchEntity!();
        });
        const result = await mockOnSaveEntity!();

        expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        expect(result).toBe(false);
    });

    it('should call delete API on delete', async () => {
        mockDeleteUser.mockResolvedValue(true);

        render(
            <UserDetailView
                user={createUser()}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        await mockOnDeleteEntity!();

        expect(mockDeleteUser).toHaveBeenCalledWith('u1');
    });

    it('should show success snackbar after delete', async () => {
        mockDeleteUser.mockResolvedValue(true);

        render(
            <UserDetailView
                user={createUser()}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        await mockOnDeleteEntity!();

        expect(mockShowSnackbar).toHaveBeenCalledWith('users.userDeleted', 'success');
    });

    it('should reset user detail on reset', async () => {
        render(
            <UserDetailView
                user={createUser()}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        await mockOnFetchEntity!();

        // Reset should not throw
        expect(() => mockOnResetEntity!()).not.toThrow();
    });

    it('should return false on save when API has error', async () => {
        mockExecuteApiCall.mockImplementation((_fn: unknown, _default: unknown, opts?: { onError: () => void }) => {
            opts?.onError();
            return Promise.resolve(undefined);
        });

        render(
            <UserDetailView
                user={createUser()}
                shouldCheckPendingChanges={false}
                onDelete={mockOnDelete}
                onProgressbarVisibilityChange={mockOnProgressbarChange}
            />
        );

        await act(async () => {
            await mockOnFetchEntity!();
        });
        const result = await mockOnSaveEntity!();

        expect(result).toBe(false);
    });
});
