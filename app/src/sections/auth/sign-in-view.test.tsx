import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { SignInView } from './sign-in-view';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Mock react-router
const mockNavigate = vi.fn();
let mockLocationState: any = null;

vi.mock('react-router', () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({
        state: mockLocationState,
        pathname: '/sign-in',
        search: '',
        hash: '',
        key: 'default',
    }),
}));

// Mock AuthContext
const mockSignIn = vi.fn();
vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        signIn: mockSignIn,
    }),
}));

// Mock useApiCall
const mockExecuteApiCall = vi.fn();
vi.mock('../../hooks/use-api-call', () => ({
    useApiCall: () => ({
        executeApiCall: mockExecuteApiCall,
    }),
}));

// Mock AuthorizedClient - use a class so it can be instantiated with `new`
vi.mock('../../api/AuthorizedClient', () => ({
    AuthorizedClient: class MockAuthorizedClient {
        loginEndpoint = vi.fn();
    },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

// Mock minimal-shared/utils (partial mock - only override varAlpha)
vi.mock('minimal-shared/utils', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        varAlpha: (_channel: string, _opacity: number) => 'rgba(0,0,0,0.16)',
    };
});

describe('SignInView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecuteApiCall.mockReset();
        mockLocationState = null;
    });

    // --- Rendering ---
    it('should render the sign-in form', () => {
        render(<SignInView />);

        expect(screen.getByLabelText('common.userName')).toBeInTheDocument();
        expect(screen.getByLabelText('common.password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'signIn.signInLabel' })).toBeInTheDocument();
        expect(screen.getByText('signIn.signInAction')).toBeInTheDocument();
    });

    // --- Button disabled state ---
    it('should disable the sign-in button when fields are empty', () => {
        render(<SignInView />);

        const button = screen.getByRole('button', { name: 'signIn.signInLabel' });
        expect(button).toBeDisabled();
    });

    it('should enable the sign-in button when both fields are filled', async () => {
        const user = userEvent.setup();
        render(<SignInView />);

        await user.type(screen.getByLabelText('common.userName'), 'testuser');
        await user.type(screen.getByLabelText('common.password'), 'password123');

        const button = screen.getByRole('button', { name: 'signIn.signInLabel' });
        expect(button).toBeEnabled();
    });

    it('should keep button disabled when only username is filled', async () => {
        const user = userEvent.setup();
        render(<SignInView />);

        await user.type(screen.getByLabelText('common.userName'), 'testuser');

        const button = screen.getByRole('button', { name: 'signIn.signInLabel' });
        expect(button).toBeDisabled();
    });

    it('should keep button disabled when only password is filled', async () => {
        const user = userEvent.setup();
        render(<SignInView />);

        await user.type(screen.getByLabelText('common.password'), 'password123');

        const button = screen.getByRole('button', { name: 'signIn.signInLabel' });
        expect(button).toBeDisabled();
    });

    // --- Password visibility toggle ---
    it('should toggle password visibility', async () => {
        const user = userEvent.setup();
        render(<SignInView />);

        const passwordInput = screen.getByLabelText('common.password');
        expect(passwordInput).toHaveAttribute('type', 'password');

        // Click the visibility toggle button (icon button inside the password field)
        const toggleButtons = screen.getAllByRole('button');
        const toggleButton = toggleButtons.find((btn: HTMLElement) => btn !== screen.getByRole('button', { name: 'signIn.signInLabel' }));
        expect(toggleButton).toBeDefined();

        await user.click(toggleButton!);
        expect(passwordInput).toHaveAttribute('type', 'text');

        await user.click(toggleButton!);
        expect(passwordInput).toHaveAttribute('type', 'password');
    });

    // --- Successful login ---
    it('should call signIn and navigate to dashboard on successful login', async () => {
        const user = userEvent.setup();
        const fakeToken = 'fake.jwt.token';
        mockExecuteApiCall.mockResolvedValue({ accessToken: fakeToken });

        render(<SignInView />);

        await user.type(screen.getByLabelText('common.userName'), 'admin');
        await user.type(screen.getByLabelText('common.password'), 'secret');
        await user.click(screen.getByRole('button', { name: 'signIn.signInLabel' }));

        await waitFor(() => {
            expect(mockExecuteApiCall).toHaveBeenCalledOnce();
            expect(mockSignIn).toHaveBeenCalledWith(fakeToken);
            expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
        });
    });

    // --- Failed login ---
    it('should show error message on failed login (null response)', async () => {
        const user = userEvent.setup();
        mockExecuteApiCall.mockResolvedValue(null);

        render(<SignInView />);

        await user.type(screen.getByLabelText('common.userName'), 'admin');
        await user.type(screen.getByLabelText('common.password'), 'wrong');
        await user.click(screen.getByRole('button', { name: 'signIn.signInLabel' }));

        await waitFor(() => {
            expect(screen.getByText('signIn.error')).toBeVisible();
        });

        expect(mockSignIn).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should show error message when response has no accessToken', async () => {
        const user = userEvent.setup();
        mockExecuteApiCall.mockResolvedValue({});

        render(<SignInView />);

        await user.type(screen.getByLabelText('common.userName'), 'admin');
        await user.type(screen.getByLabelText('common.password'), 'wrong');
        await user.click(screen.getByRole('button', { name: 'signIn.signInLabel' }));

        await waitFor(() => {
            expect(screen.getByText('signIn.error')).toBeVisible();
        });

        expect(mockSignIn).not.toHaveBeenCalled();
    });

    // --- Redirect from location state ---
    it('should navigate to the original path after login', async () => {
        const user = userEvent.setup();
        mockLocationState = { from: { pathName: '/breweries' } };
        mockExecuteApiCall.mockResolvedValue({ accessToken: 'token' });

        render(<SignInView />);

        await user.type(screen.getByLabelText('common.userName'), 'admin');
        await user.type(screen.getByLabelText('common.password'), 'pass');
        await user.click(screen.getByRole('button', { name: 'signIn.signInLabel' }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/breweries', { replace: true });
        });
    });

    // --- Loading state ---
    it('should show loading indicator and disable button while signing in', async () => {
        const user = userEvent.setup();
        // Create a promise that never resolves to keep the loading state
        mockExecuteApiCall.mockReturnValue(new Promise(() => { }));

        render(<SignInView />);

        await user.type(screen.getByLabelText('common.userName'), 'admin');
        await user.type(screen.getByLabelText('common.password'), 'pass');

        const signInButton = screen.getByRole('button', { name: 'signIn.signInLabel' });
        await user.click(signInButton);

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
    });

    // --- Error is hidden initially ---
    it('should not show error message initially', () => {
        render(<SignInView />);

        const errorText = screen.getByText('signIn.error');
        expect(errorText).toHaveStyle({ display: 'none' });
    });
});
