import type { VariantType} from 'notistack';

import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

export function useNotification() {
     const { enqueueSnackbar } = useSnackbar();
     const { t } = useTranslation();

     const show = (message: string, variant: VariantType = 'default') => {
          enqueueSnackbar(message, { variant });
     };

     const showSuccess = (message: string) => show(message, 'success');
     const showError = (message: string) => show(message, 'error');
     const showWarning = (message: string) => show(message, 'warning');
     const showInfo = (message: string) => show(message, 'info');

     // Pre-built CRUD notification helpers
     const notifyCreate = (entityKey: string) =>
          showSuccess(t('snackbar.createSuccess', { entity: t(`nav.${entityKey}`) }));

     const notifyUpdate = (entityKey: string) =>
          showSuccess(t('snackbar.updateSuccess', { entity: t(`nav.${entityKey}`) }));

     const notifyDelete = (entityKey: string) =>
          showSuccess(t('snackbar.deleteSuccess', { entity: t(`nav.${entityKey}`) }));

     const notifyCreateError = (entityKey: string) =>
          showError(t('snackbar.createError', { entity: t(`nav.${entityKey}`) }));

     const notifyUpdateError = (entityKey: string) =>
          showError(t('snackbar.updateError', { entity: t(`nav.${entityKey}`) }));

     const notifyDeleteError = (entityKey: string) =>
          showError(t('snackbar.deleteError', { entity: t(`nav.${entityKey}`) }));

     // API error handler — maps HTTP status codes to translated snackbar messages
     const notifyApiError = (error: unknown) => {
          if (error && typeof error === 'object' && 'status' in error) {
               const status = (error as { status: number }).status;
               switch (status) {
                    case 400:
                         showError(t('snackbar.validationError'));
                         break;
                    case 401:
                         showWarning(t('snackbar.unauthorized'));
                         break;
                    case 403:
                         showError(t('snackbar.forbidden'));
                         break;
                    case 404:
                         showError(t('snackbar.notFound', { entity: '' }));
                         break;
                    default:
                         showError(t('snackbar.genericError'));
               }
          } else {
               showError(t('snackbar.networkError'));
          }
     };

     return {
          show,
          showSuccess,
          showError,
          showWarning,
          showInfo,
          notifyCreate,
          notifyUpdate,
          notifyDelete,
          notifyCreateError,
          notifyUpdateError,
          notifyDeleteError,
          notifyApiError,
     };
}
