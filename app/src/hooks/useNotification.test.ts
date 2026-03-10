// ---------------------------------------------------------------------------
// API error classification logic (mirrors notifyApiError from useNotification)
// ---------------------------------------------------------------------------

describe('API error classification', () => {
     function classifyError(error: unknown): { key: string; variant: 'error' | 'warning' } {
          if (error && typeof error === 'object' && 'status' in error) {
               const status = (error as { status: number }).status;
               switch (status) {
                    case 400:
                         return { key: 'snackbar.validationError', variant: 'error' };
                    case 401:
                         return { key: 'snackbar.unauthorized', variant: 'warning' };
                    case 403:
                         return { key: 'snackbar.forbidden', variant: 'error' };
                    case 404:
                         return { key: 'snackbar.notFound', variant: 'error' };
                    default:
                         return { key: 'snackbar.genericError', variant: 'error' };
               }
          }
          return { key: 'snackbar.networkError', variant: 'error' };
     }

     it('maps 400 to validation error', () => {
          expect(classifyError({ status: 400 })).toEqual({
               key: 'snackbar.validationError',
               variant: 'error',
          });
     });

     it('maps 401 to unauthorized warning', () => {
          expect(classifyError({ status: 401 })).toEqual({
               key: 'snackbar.unauthorized',
               variant: 'warning',
          });
     });

     it('maps 403 to forbidden error', () => {
          expect(classifyError({ status: 403 })).toEqual({
               key: 'snackbar.forbidden',
               variant: 'error',
          });
     });

     it('maps 404 to not found error', () => {
          expect(classifyError({ status: 404 })).toEqual({
               key: 'snackbar.notFound',
               variant: 'error',
          });
     });

     it('maps 500 to generic error', () => {
          expect(classifyError({ status: 500 })).toEqual({
               key: 'snackbar.genericError',
               variant: 'error',
          });
     });

     it('maps non-object errors to network error', () => {
          expect(classifyError('some string error')).toEqual({
               key: 'snackbar.networkError',
               variant: 'error',
          });
     });

     it('maps null to network error', () => {
          expect(classifyError(null)).toEqual({
               key: 'snackbar.networkError',
               variant: 'error',
          });
     });

     it('maps undefined to network error', () => {
          expect(classifyError(undefined)).toEqual({
               key: 'snackbar.networkError',
               variant: 'error',
          });
     });

     it('maps objects without status to network error', () => {
          expect(classifyError({ message: 'timeout' })).toEqual({
               key: 'snackbar.networkError',
               variant: 'error',
          });
     });
});
