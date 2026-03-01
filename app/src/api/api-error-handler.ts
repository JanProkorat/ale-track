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
  statusCode?: number;
} {
  let statusCode: number | undefined;
  let message: string | undefined;

  // Check if the error has a status code
  if (error && typeof error === 'object') {
    // Check for status property
    if ('status' in error && typeof error.status === 'number') {
      statusCode = error.status;
    }

    // Check for message property (string)
    if ('message' in error && typeof error.message === 'string') {
      message = error.message;

      // NSwag throws plain Error with message "Unauthorized" for 401 responses
      if (message && message.toLowerCase() === 'unauthorized') {
        statusCode = 401;
      }
    }
  }

  // Check if the error has a response body with FailureResponse structure
  if (error && typeof error === 'object') {
    // Direct FailureResponse object (has error_code or structured error_properties)
    if ('error_code' in error) {
      return {
        errorCode: error.error_code as ErrorCode,
        message: message || error.message,
        properties: error.error_properties,
        statusCode,
      };
    }

    // Error thrown by fetch with response
    if (error.response && typeof error.response === 'object') {
      const responseInfo = extractErrorInfo(error.response);
      return {
        ...responseInfo,
        statusCode: statusCode || responseInfo.statusCode,
        message: message || responseInfo.message,
      };
    }

    // Check for result property (from NSwag generated client)
    if (error.result && typeof error.result === 'object') {
      const resultInfo = extractErrorInfo(error.result);
      return {
        ...resultInfo,
        statusCode: statusCode || resultInfo.statusCode,
        message: message || resultInfo.message,
      };
    }
  }

  return { statusCode, message };
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
      const { errorCode, message: backendMessage, properties, statusCode } = extractErrorInfo(error);

      // Determine which message to show
      let displayMessage = errorMessage;
      let finalErrorCode = errorCode;

      // Handle 401 status code specifically
      if (statusCode === 401 && !errorCode) {
        finalErrorCode = 'UNAUTHORIZED' as ErrorCode;
      }

      if (finalErrorCode && translateError) {
        // Use translated error message based on error code
        displayMessage = translateError(`errors.${finalErrorCode}`);
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
        onError(error as Error, finalErrorCode);
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
