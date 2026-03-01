import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, waitFor } from 'src/test/test-utils';

import { useSnackbar, SnackbarProvider } from './SnackbarProvider';

vi.mock('minimal-shared', () => ({
    uuidv4: () => 'test-uuid',
}));

function TestConsumer() {
    const { showSnackbar } = useSnackbar();
    return (
        <div>
            <button onClick={() => showSnackbar('Test message', 'success')}>showSuccess</button>
            <button onClick={() => showSnackbar('Error message', 'error')}>showError</button>
            <button onClick={() => showSnackbar('Info message')}>showInfo</button>
        </div>
    );
}

describe('SnackbarProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render children', () => {
        render(
            <SnackbarProvider>
                <div data-testid="child">Hello</div>
            </SnackbarProvider>
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should show snackbar with success message', async () => {
        render(
            <SnackbarProvider>
                <TestConsumer />
            </SnackbarProvider>
        );

        screen.getByText('showSuccess').click();

        await waitFor(() => {
            expect(screen.getByText('Test message')).toBeInTheDocument();
        });
    });

    it('should show snackbar with error message', async () => {
        render(
            <SnackbarProvider>
                <TestConsumer />
            </SnackbarProvider>
        );

        screen.getByText('showError').click();

        await waitFor(() => {
            expect(screen.getByText('Error message')).toBeInTheDocument();
        });
    });

    it('should show snackbar with default info severity', async () => {
        render(
            <SnackbarProvider>
                <TestConsumer />
            </SnackbarProvider>
        );

        screen.getByText('showInfo').click();

        await waitFor(() => {
            expect(screen.getByText('Info message')).toBeInTheDocument();
        });
    });

    it('should throw error when useSnackbar is used outside provider', () => {
        expect(() => {
            render(<TestConsumer />);
        }).toThrow('useSnackbar must be used within a SnackbarProvider');
    });
});
