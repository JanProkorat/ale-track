import { ApiException } from 'src/generated/api-client';

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Neplatný požadavek.',
  401: 'Přihlášení vypršelo.',
  403: 'K této akci nemáte oprávnění.',
  404: 'Záznam nebyl nalezen.',
  409: 'Konflikt — záznam byl mezitím změněn.',
  500: 'Chyba serveru. Zkuste to prosím znovu.',
};

/**
 * Czech text for a backend `error_code`. The API's own `message` is English and
 * often generic ("Request validation failed"), so anything the user should be
 * able to act on gets a precise translation here, keyed by the code.
 *
 * Keys mirror `AleTrack.Common.Utils.ErrorCodes`.
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  DELIVERY_DATE_IN_PAST: 'Termín dodání musí být v budoucnosti.',
  ENTITY_NOT_FOUND: 'Záznam nebyl nalezen.',
  ENTITY_ALREADY_EXISTS: 'Takový záznam už existuje.',
  ORDER_ALREADY_ASSIGNED_TO_OUTGOING_SHIPMENT: 'Objednávka už je zařazena do jiného vývozu.',
  SHIPMENT_NOT_PREPARED: 'Vývoz nemá vyplněná všechna povinná data.',
  SHIPMENT_CANNOT_BE_LOADED_WITHOUT_STOPS: 'Vývoz nelze naložit bez zastávek.',
  SHIPMENT_ALREADY_DELIVERED: 'Vývoz už byl doručen.',
  SHIPMENT_ALREADY_CANCELLED: 'Vývoz už byl zrušen.',
};

interface ValidationErrorDetail {
  error_code?: string;
  error_message?: string;
}

interface ApiErrorBody {
  message?: string;
  detail?: string;
  error_code?: string;
  error_properties?: Record<string, ValidationErrorDetail>;
}

/**
 * First translated message among a validation failure's per-field codes.
 *
 * A validation response carries the useful code per field in `error_properties`
 * — the top-level code is always `VALIDATION_ERROR` — so a field-level code is
 * what tells the user what to fix.
 */
function messageFromProperties(body: ApiErrorBody): string | null {
  for (const detail of Object.values(body.error_properties ?? {})) {
    const translated = detail?.error_code ? ERROR_CODE_MESSAGES[detail.error_code] : undefined;
    if (translated) return translated;
  }
  return null;
}

/** Extract a user-facing Czech message from any thrown API error. */
export function apiErrorMessage(err: unknown, fallback = 'Něco se pokazilo.'): string {
  if (err == null) return fallback;
  if (ApiException.isApiException(err)) {
    // Prefer a translated code over the API's English message; fall back to the
    // message, then to the status.
    try {
      const body = err.response ? (JSON.parse(err.response) as ApiErrorBody) : null;
      if (body) {
        const byTopLevelCode = body.error_code ? ERROR_CODE_MESSAGES[body.error_code] : undefined;
        if (byTopLevelCode) return byTopLevelCode;

        const byProperty = messageFromProperties(body);
        if (byProperty) return byProperty;

        if (body.message) return body.message;
        if (body.detail) return body.detail;
      }
    } catch {
      /* not JSON */
    }
    return STATUS_MESSAGES[err.status] ?? fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
