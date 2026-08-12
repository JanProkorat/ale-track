// apiErrorMessage turns whatever the API threw into one Czech sentence for a
// toast. The case that motivated the code map: a validation failure's top-level
// message is the generic English "Request validation failed", so the message the
// user can act on only exists as a per-field error_code.

import { describe, expect, it } from 'vitest';
import { ApiException } from 'src/generated/api-client';
import { apiErrorMessage } from './errors';

function apiError(status: number, body: unknown): ApiException {
  return new ApiException('Http status code 400', status, JSON.stringify(body), {}, null);
}

describe('apiErrorMessage', () => {
  it('translates a past delivery date from its per-field error code', () => {
    const err = apiError(400, {
      error_code: 'VALIDATION_ERROR',
      error_properties: {
        'data.requiredDeliveryDate': {
          error_code: 'DELIVERY_DATE_IN_PAST',
          error_message: "'required Delivery Date' must be greater than '7/25/2026'.",
        },
      },
      message: 'Request validation failed',
    });

    expect(apiErrorMessage(err)).toBe('Termín dodání musí být v budoucnosti.');
  });

  it('translates a top-level domain error code', () => {
    const err = apiError(409, {
      error_code: 'ORDER_ALREADY_ASSIGNED_TO_OUTGOING_SHIPMENT',
      message: 'Order is already assigned to an outgoing shipment',
    });

    expect(apiErrorMessage(err)).toBe('Objednávka už je zařazena do jiného vývozu.');
  });

  it('prefers a translated field code over the generic message', () => {
    const err = apiError(400, {
      error_code: 'VALIDATION_ERROR',
      error_properties: {
        'data.name': { error_code: 'VALIDATION_NOT_EMPTY_ERROR', error_message: 'must not be empty' },
        'data.requiredDeliveryDate': { error_code: 'DELIVERY_DATE_IN_PAST', error_message: 'too early' },
      },
      message: 'Request validation failed',
    });

    expect(apiErrorMessage(err)).toBe('Termín dodání musí být v budoucnosti.');
  });

  it('falls back to the API message when no code is mapped', () => {
    const err = apiError(400, {
      error_code: 'VALIDATION_ERROR',
      error_properties: {
        'data.name': { error_code: 'VALIDATION_NOT_EMPTY_ERROR', error_message: 'must not be empty' },
      },
      message: 'Request validation failed',
    });

    expect(apiErrorMessage(err)).toBe('Request validation failed');
  });

  it('translates the driver-link and driver-scope domain error codes', () => {
    expect(apiErrorMessage(apiError(400, { error_code: 'DRIVER_ALREADY_LINKED_TO_USER' })))
      .toBe('Tento řidič už je propojen s jiným účtem.');
    expect(apiErrorMessage(apiError(400, { error_code: 'DRIVER_LINK_REQUIRES_DRIVER_ROLE' })))
      .toBe('Propojit řidiče lze jen u účtu s rolí Řidič.');
    expect(apiErrorMessage(apiError(403, { error_code: 'DRIVER_SCOPE_FORBIDDEN' })))
      .toBe('Tuto akci může provést jen správce.');
  });

  it('falls back to the status message when the body carries nothing usable', () => {
    expect(apiErrorMessage(apiError(403, {}))).toBe('K této akci nemáte oprávnění.');
  });

  it('falls back to the status message when the body is not JSON', () => {
    const err = new ApiException('boom', 500, '<html>502 Bad Gateway</html>', {}, null);

    expect(apiErrorMessage(err)).toBe('Chyba serveru. Zkuste to prosím znovu.');
  });

  it('handles plain errors and nullish input', () => {
    expect(apiErrorMessage(new Error('network down'))).toBe('network down');
    expect(apiErrorMessage(null)).toBe('Něco se pokazilo.');
    expect(apiErrorMessage(undefined, 'vlastní')).toBe('vlastní');
  });
});
