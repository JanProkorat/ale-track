import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, waitFor, fireEvent } from 'src/test/test-utils';

import { CreateUserView } from './create-user-view';

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

const mockCreateUser = vi.fn();
vi.mock('../../../api/AuthorizedClient', () => ({
    AuthorizedClient: class {
        createUserEndpoint = mockCreateUser;
    },
}));

const mockOnClose = vi.fn();
const mockOnSave = vi.fn();

describe('CreateUserView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCall.mockImplementation((fn: () => Promise<unknown>) => fn());
    });

    it('should render the drawer title', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('users.new')).toBeInTheDocument();
    });

    it('should render close and save buttons', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('common.close')).toBeInTheDocument();
        expect(screen.getByText('common.saveAndClose')).toBeInTheDocument();
    });

    it('should render userName and password fields', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getAllByText('users.userName').length).toBeGreaterThan(0);
        expect(screen.getAllByText('common.password').length).toBeGreaterThan(0);
    });

    it('should render firstName and lastName fields', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getAllByText('users.firstName').length).toBeGreaterThan(0);
        expect(screen.getAllByText('users.lastName').length).toBeGreaterThan(0);
    });

    it('should render user roles checkboxes', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('users.userRoles')).toBeInTheDocument();
        expect(screen.getByText('UserRoleType.Admin')).toBeInTheDocument();
        expect(screen.getByText('UserRoleType.User')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        screen.getByText('common.close').click();

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should show validation error when saving with empty fields', async () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });
    });

    it('should show validation error when no role is selected', async () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('users.userName'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByLabelText('common.password'), { target: { value: 'pass123' } });

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockShowSnackbar).toHaveBeenCalledWith('common.validationError', 'error');
        });
    });

    it('should update userName field', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        const input = screen.getByLabelText('users.userName');
        fireEvent.change(input, { target: { value: 'newuser' } });

        expect(input).toHaveValue('newuser');
    });

    it('should update password field', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        const input = screen.getByLabelText('common.password');
        fireEvent.change(input, { target: { value: 'secret' } });

        expect(input).toHaveValue('secret');
    });

    it('should update firstName field', () => {
        render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        const input = screen.getByLabelText('users.firstName');
        fireEvent.change(input, { target: { value: 'John' } });

        expect(input).toHaveValue('John');
    });

    it('should call API when all required fields are filled', async () => {
        mockCreateUser.mockResolvedValue('new-user-id');

        const { container } = render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('users.userName'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByLabelText('common.password'), { target: { value: 'pass123' } });

        // Check Admin role checkbox
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockCreateUser).toHaveBeenCalled();
        });
    });

    it('should call onSave with new user id after successful save', async () => {
        mockCreateUser.mockResolvedValue('new-user-id');

        const { container } = render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('users.userName'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByLabelText('common.password'), { target: { value: 'pass123' } });

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);

        screen.getByText('common.saveAndClose').click();

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith('new-user-id');
        });
    });

    it('should toggle role checkbox on and off', () => {
        const { container } = render(<CreateUserView onClose={mockOnClose} onSave={mockOnSave} />);

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        // Check Admin
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[0]).toBeChecked();

        // Uncheck Admin
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[0]).not.toBeChecked();
    });
});
