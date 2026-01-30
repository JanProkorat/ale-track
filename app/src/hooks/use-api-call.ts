import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useSnackbar } from '../providers/SnackbarProvider';
import { handleApiCall, handleApiCallWithDefault } from '../api/api-error-handler';

import type { ApiErrorHandlerOptions } from '../api/api-error-handler';

/**
 * Hook that provides API call wrapper with automatic error handling
 */
export function useApiCall() {
  const { showSnackbar } = useSnackbar();
  const { t } = useTranslation();

  /**
   * Execute an API call with automatic error handling
   * @param apiCall The async function to call
   * @param errorMessage The error message to display in snackbar (can be a translation key)
   * @param options Additional error handling options
   * @returns The result of the API call or null on error
   */
  const executeApiCall = useCallback(
    async <T,>(
      apiCall: () => Promise<T>,
      errorMessage?: string,
      options?: Omit<ApiErrorHandlerOptions, 'showSnackbar' | 'errorMessage' | 'translateError'>
    ): Promise<T | null> =>
      handleApiCall(apiCall, {
        ...options,
        errorMessage,
        showSnackbar,
        translateError: t,
      }),
    [showSnackbar, t]
  );

  /**
   * Execute an API call with automatic error handling and return a default value on error
   * @param apiCall The async function to call
   * @param defaultValue The value to return on error
   * @param errorMessage The error message to display in snackbar (can be a translation key)
   * @param options Additional error handling options
   * @returns The result of the API call or the default value on error
   */
  const executeApiCallWithDefault = useCallback(
    async <T,>(
      apiCall: () => Promise<T>,
      defaultValue: T,
      errorMessage?: string,
      options?: Omit<ApiErrorHandlerOptions, 'showSnackbar' | 'errorMessage' | 'translateError'>
    ): Promise<T> =>
      handleApiCallWithDefault(apiCall, defaultValue, {
        ...options,
        errorMessage,
        showSnackbar,
        translateError: t,
      }),
    [showSnackbar, t]
  );

  return {
    executeApiCall,
    executeApiCallWithDefault,
  };
}
