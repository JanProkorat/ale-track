import { it, vi, expect, describe, beforeEach } from 'vitest';

import { handleApiCall, handleApiCallWithDefault } from './api-error-handler';

describe('handleApiCall', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    it('should return result on successful API call', async () => {
        const result = await handleApiCall(() => Promise.resolve({ id: '1', name: 'Test' }));

        expect(result).toEqual({ id: '1', name: 'Test' });
    });

    it('should return null on error', async () => {
        const result = await handleApiCall(() => Promise.reject(new Error('fail')));

        expect(result).toBeNull();
    });

    it('should call showSnackbar with error message on error', async () => {
        const mockShowSnackbar = vi.fn();

        await handleApiCall(() => Promise.reject(new Error('fail')), {
            errorMessage: 'Something went wrong',
            showSnackbar: mockShowSnackbar,
        });

        expect(mockShowSnackbar).toHaveBeenCalledWith('Something went wrong', 'error');
    });

    it('should call onError callback on error', async () => {
        const mockOnError = vi.fn();

        await handleApiCall(() => Promise.reject(new Error('fail')), {
            onError: mockOnError,
        });

        expect(mockOnError).toHaveBeenCalledWith(expect.any(Error), undefined);
    });

    it('should extract error_code from error object', async () => {
        const mockOnError = vi.fn();
        const apiError = { error_code: 'ENTITY_NOT_FOUND', message: 'Not found' };

        await handleApiCall(() => Promise.reject(apiError), {
            onError: mockOnError,
        });

        expect(mockOnError).toHaveBeenCalledWith(apiError, 'ENTITY_NOT_FOUND');
    });

    it('should translate error code when translateError is provided', async () => {
        const mockShowSnackbar = vi.fn();
        const mockTranslateError = vi.fn((key: string) => `Translated: ${key}`);
        const apiError = { error_code: 'ENTITY_NOT_FOUND' };

        await handleApiCall(() => Promise.reject(apiError), {
            showSnackbar: mockShowSnackbar,
            translateError: mockTranslateError,
        });

        expect(mockTranslateError).toHaveBeenCalledWith('errors.ENTITY_NOT_FOUND');
        expect(mockShowSnackbar).toHaveBeenCalledWith('Translated: errors.ENTITY_NOT_FOUND', 'error');
    });

    it('should handle 401 status code and set UNAUTHORIZED error code', async () => {
        const mockOnError = vi.fn();
        const apiError = { status: 401, message: 'Unauthorized' };

        await handleApiCall(() => Promise.reject(apiError), {
            onError: mockOnError,
        });

        expect(mockOnError).toHaveBeenCalledWith(apiError, 'UNAUTHORIZED');
    });

    it('should handle "Unauthorized" message as 401', async () => {
        const mockOnError = vi.fn();
        const apiError = new Error('Unauthorized');

        await handleApiCall(() => Promise.reject(apiError), {
            onError: mockOnError,
        });

        expect(mockOnError).toHaveBeenCalledWith(apiError, 'UNAUTHORIZED');
    });

    it('should extract error from nested response object', async () => {
        const mockOnError = vi.fn();
        const apiError = {
            message: 'Request failed',
            response: { error_code: 'VALIDATION_ERROR' },
        };

        await handleApiCall(() => Promise.reject(apiError), {
            onError: mockOnError,
        });

        expect(mockOnError).toHaveBeenCalledWith(apiError, 'VALIDATION_ERROR');
    });

    it('should extract error from nested result object', async () => {
        const mockOnError = vi.fn();
        const apiError = {
            message: 'Request failed',
            result: { error_code: 'BAD_REQUEST_ERROR' },
        };

        await handleApiCall(() => Promise.reject(apiError), {
            onError: mockOnError,
        });

        expect(mockOnError).toHaveBeenCalledWith(apiError, 'BAD_REQUEST_ERROR');
    });

    it('should use backend message when no custom errorMessage is provided', async () => {
        const mockShowSnackbar = vi.fn();
        const apiError = { message: 'Backend error message' };

        await handleApiCall(() => Promise.reject(apiError), {
            showSnackbar: mockShowSnackbar,
        });

        expect(mockShowSnackbar).toHaveBeenCalledWith('Backend error message', 'error');
    });

    it('should prefer custom errorMessage over backend message', async () => {
        const mockShowSnackbar = vi.fn();
        const apiError = { message: 'Backend error message' };

        await handleApiCall(() => Promise.reject(apiError), {
            errorMessage: 'Custom error',
            showSnackbar: mockShowSnackbar,
        });

        expect(mockShowSnackbar).toHaveBeenCalledWith('Custom error', 'error');
    });

    it('should not log or call handlers when suppressError is true', async () => {
        const mockOnError = vi.fn();
        const mockShowSnackbar = vi.fn();

        await handleApiCall(() => Promise.reject(new Error('fail')), {
            suppressError: true,
            onError: mockOnError,
            showSnackbar: mockShowSnackbar,
        });

        expect(console.error).not.toHaveBeenCalled();
        expect(mockOnError).not.toHaveBeenCalled();
        expect(mockShowSnackbar).not.toHaveBeenCalled();
    });

    it('should log error properties when present', async () => {
        const apiError = {
            error_code: 'VALIDATION_ERROR',
            error_properties: { field: 'name' },
        };

        await handleApiCall(() => Promise.reject(apiError));

        expect(console.error).toHaveBeenCalledWith('Error properties:', { field: 'name' });
    });
});

describe('handleApiCallWithDefault', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    it('should return result on success', async () => {
        const result = await handleApiCallWithDefault(
            () => Promise.resolve([1, 2, 3]),
            []
        );

        expect(result).toEqual([1, 2, 3]);
    });

    it('should return default value on error', async () => {
        const result = await handleApiCallWithDefault(
            () => Promise.reject(new Error('fail')),
            [0]
        );

        expect(result).toEqual([0]);
    });

    it('should return empty array default on error', async () => {
        const result = await handleApiCallWithDefault(
            () => Promise.reject(new Error('fail')),
            [] as number[]
        );

        expect(result).toEqual([]);
    });
});
