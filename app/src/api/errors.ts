import { ApiException } from 'src/generated/api-client';

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Neplatný požadavek.',
  401: 'Přihlášení vypršelo.',
  403: 'K této akci nemáte oprávnění.',
  404: 'Záznam nebyl nalezen.',
  409: 'Konflikt — záznam byl mezitím změněn.',
  500: 'Chyba serveru. Zkuste to prosím znovu.',
};

/** Extract a user-facing Czech message from any thrown API error. */
export function apiErrorMessage(err: unknown, fallback = 'Něco se pokazilo.'): string {
  if (ApiException.isApiException(err)) {
    // Try to read a message off the JSON error body, else map the status.
    try {
      const body = err.response ? (JSON.parse(err.response) as { message?: string; detail?: string }) : null;
      if (body?.message) return body.message;
      if (body?.detail) return body.detail;
    } catch {
      /* not JSON */
    }
    return STATUS_MESSAGES[err.status] ?? fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
