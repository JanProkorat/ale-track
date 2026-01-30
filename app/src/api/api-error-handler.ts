import type { ErrorCode } from './error-codes';

type SnackbarType = 'success' | 'error' | 'info' | 'warning';

export interface ApiErrorHandlerOptions {
  onError?: (error: Error, errorCode?: ErrorCode) => void;
  errorMessage?: string;
  showSnackbar?: (message: string, severity: SnackbarType) => void;
  translateError?: (errorCode: string) => string;
  suppressError?: boolean;
}

/**
 * Extracts error information from an API error response
 */
function extractErrorInfo(error: any): {
  errorCode?: ErrorCode;
  message?: string;
  properties?: { [key: string]: any };
} {
  // Check if the error has a response body with FailureResponse structure
  if (error && typeof error === 'object') {
    // Direct FailureResponse object
    if ('error_code' in error || 'message' in error) {
      return {
        errorCode: error.error_code as ErrorCode,
        message: error.message,
        properties: error.error_properties,
      };
    }

    // Error thrown by fetch with response
    if (error.response && typeof error.response === 'object') {
      return extractErrorInfo(error.response);
    }

    // Check for result property (from NSwag generated client)
    if (error.result && typeof error.result === 'object') {
      return extractErrorInfo(error.result);
    }
  }

  return {};
}

/**
 * Wraps an API call with automatic error handling
 * @param apiCall The async function to call
 * @param options Error handling options
 * @returns The result of the API call or null on error
 */
export async function handleApiCall<T>(
  apiCall: () => Promise<T>,
  options: ApiErrorHandlerOptions = {}
): Promise<T | null> {
  const { onError, errorMessage, showSnackbar, translateError, suppressError = false } = options;

  try {
    return await apiCall();
  } catch (error) {
    if (!suppressError) {
      console.error('API Error:', error);

      // Extract error information from the response
      const { errorCode, message: backendMessage, properties } = extractErrorInfo(error);

      // Determine which message to show
      let displayMessage = errorMessage;
      
      if (errorCode && translateError) {
        // Use translated error message based on error code
        displayMessage = translateError(`errors.${errorCode}`);
      } else if (backendMessage && !errorMessage) {
        // Fallback to backend message if no custom message provided
        displayMessage = backendMessage;
      }

      // Show snackbar if provided
      if (showSnackbar && displayMessage) {
        showSnackbar(displayMessage, 'error');
      }

      // Log error properties if present
      if (properties) {
        console.error('Error properties:', properties);
      }

      // Call custom error handler if provided
      if (onError) {
        onError(error as Error, errorCode);
      }
    }

    return null;
  }
}

/**
 * Wraps an API call with automatic error handling and returns a default value on error
 * @param apiCall The async function to call
 * @param defaultValue The value to return on error
 * @param options Error handling options
 * @returns The result of the API call or the default value on error
 */
export async function handleApiCallWithDefault<T>(
  apiCall: () => Promise<T>,
  defaultValue: T,
  options: ApiErrorHandlerOptions = {}
): Promise<T> {
  const result = await handleApiCall(apiCall, options);
  return result ?? defaultValue;
}
