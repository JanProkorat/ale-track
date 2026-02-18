import { it, vi, expect, describe, beforeEach } from 'vitest';

import { renderHook } from 'src/test/test-utils';

import { useApiCall } from './use-api-call';

// ------------------------------------
// Mocks
// ------------------------------------
const mockShowSnackbar = vi.fn();
vi.mock('../providers/SnackbarProvider', () => ({
    useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

const mockT = (key: string) => key;
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: mockT }),
}));

const mockHandleApiCall = vi.fn();
const mockHandleApiCallWithDefault = vi.fn();
vi.mock('../api/api-error-handler', () => ({
    handleApiCall: (...args: unknown[]) => mockHandleApiCall(...args),
    handleApiCallWithDefault: (...args: unknown[]) => mockHandleApiCallWithDefault(...args),
}));

// ------------------------------------
// Tests
// ------------------------------------
describe('useApiCall', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns executeApiCall and executeApiCallWithDefault', () => {
        const { result } = renderHook(() => useApiCall());

        expect(result.current.executeApiCall).toBeInstanceOf(Function);
        expect(result.current.executeApiCallWithDefault).toBeInstanceOf(Function);
    });

    describe('executeApiCall', () => {
        it('calls handleApiCall with correct arguments', async () => {
            const apiCall = vi.fn().mockResolvedValue('result');
            mockHandleApiCall.mockResolvedValue('result');

            const { result } = renderHook(() => useApiCall());
            await result.current.executeApiCall(apiCall, 'error.message');

            expect(mockHandleApiCall).toHaveBeenCalledWith(apiCall, {
                errorMessage: 'error.message',
                showSnackbar: mockShowSnackbar,
                translateError: mockT,
            });
        });

        it('passes additional options to handleApiCall', async () => {
            const apiCall = vi.fn().mockResolvedValue('result');
            const onError = vi.fn();
            mockHandleApiCall.mockResolvedValue('result');

            const { result } = renderHook(() => useApiCall());
            await result.current.executeApiCall(apiCall, 'err', { onError, suppressError: true });

            expect(mockHandleApiCall).toHaveBeenCalledWith(apiCall, {
                errorMessage: 'err',
                showSnackbar: mockShowSnackbar,
                translateError: mockT,
                onError,
                suppressError: true,
            });
        });

        it('returns the result from handleApiCall', async () => {
            const apiCall = vi.fn();
            mockHandleApiCall.mockResolvedValue({ data: 42 });

            const { result } = renderHook(() => useApiCall());
            const value = await result.current.executeApiCall(apiCall);

            expect(value).toEqual({ data: 42 });
        });

        it('returns null when handleApiCall returns null', async () => {
            const apiCall = vi.fn();
            mockHandleApiCall.mockResolvedValue(null);

            const { result } = renderHook(() => useApiCall());
            const value = await result.current.executeApiCall(apiCall, 'error');

            expect(value).toBeNull();
        });
    });

    describe('executeApiCallWithDefault', () => {
        it('calls handleApiCallWithDefault with correct arguments', async () => {
            const apiCall = vi.fn().mockResolvedValue([1, 2, 3]);
            mockHandleApiCallWithDefault.mockResolvedValue([1, 2, 3]);

            const { result } = renderHook(() => useApiCall());
            await result.current.executeApiCallWithDefault(apiCall, [], 'error.default');

            expect(mockHandleApiCallWithDefault).toHaveBeenCalledWith(apiCall, [], {
                errorMessage: 'error.default',
                showSnackbar: mockShowSnackbar,
                translateError: mockT,
            });
        });

        it('returns data from handleApiCallWithDefault', async () => {
            const apiCall = vi.fn();
            mockHandleApiCallWithDefault.mockResolvedValue([1, 2, 3]);

            const { result } = renderHook(() => useApiCall());
            const value = await result.current.executeApiCallWithDefault(apiCall, [], 'err');

            expect(value).toEqual([1, 2, 3]);
        });

        it('returns default value when API fails', async () => {
            const apiCall = vi.fn();
            const defaultVal = { count: 0 };
            mockHandleApiCallWithDefault.mockResolvedValue(defaultVal);

            const { result } = renderHook(() => useApiCall());
            const value = await result.current.executeApiCallWithDefault(apiCall, defaultVal, 'err');

            expect(value).toEqual({ count: 0 });
        });
    });
});
