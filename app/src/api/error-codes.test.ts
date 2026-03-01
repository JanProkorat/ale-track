import { it, expect, describe } from 'vitest';

import { ErrorCodes } from './error-codes';

import type { ErrorCode } from './error-codes';

describe('ErrorCodes', () => {
     it('should have UNEXPECTED_ERROR code', () => {
          expect(ErrorCodes.UNEXPECTED_ERROR).toBe('UNEXPECTED_ERROR');
     });

     it('should have UNAUTHORIZED code', () => {
          expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
     });

     it('should have all validation error codes', () => {
          expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
          expect(ErrorCodes.VALIDATION_NOT_NULL_ERROR).toBe('VALIDATION_NOT_NULL_ERROR');
          expect(ErrorCodes.VALIDATION_NOT_EMPTY_ERROR).toBe('VALIDATION_NOT_EMPTY_ERROR');
          expect(ErrorCodes.VALIDATION_MAX_LENGTH_ERROR).toBe('VALIDATION_MAX_LENGTH_ERROR');
          expect(ErrorCodes.VALIDATION_MAX_VALUE_EXCEEDED_ERROR).toBe('VALIDATION_MAX_VALUE_EXCEEDED_ERROR');
          expect(ErrorCodes.VALIDATION_MINVALUE_NOT_MATCHED_ERROR).toBe('VALIDATION_MINVALUE_NOT_MATCHED_ERROR');
     });

     it('should have entity error codes', () => {
          expect(ErrorCodes.ENTITY_NOT_FOUND).toBe('ENTITY_NOT_FOUND');
          expect(ErrorCodes.ENTITY_ALREADY_EXISTS).toBe('ENTITY_ALREADY_EXISTS');
     });

     it('should have shipment error codes', () => {
          expect(ErrorCodes.ORDER_ALREADY_ASSIGNED_TO_OUTGOING_SHIPMENT).toBe(
               'ORDER_ALREADY_ASSIGNED_TO_OUTGOING_SHIPMENT'
          );
          expect(ErrorCodes.SHIPMENT_NOT_PREPARED).toBe('SHIPMENT_NOT_PREPARED');
          expect(ErrorCodes.SHIPMENT_CANNOT_BE_LOADED_WITHOUT_STOPS).toBe('SHIPMENT_CANNOT_BE_LOADED_WITHOUT_STOPS');
          expect(ErrorCodes.SHIPMENT_ALREADY_DELIVERED).toBe('SHIPMENT_ALREADY_DELIVERED');
          expect(ErrorCodes.SHIPMENT_ALREADY_CANCELLED).toBe('SHIPMENT_ALREADY_CANCELLED');
     });

     it('should have BAD_REQUEST_ERROR code', () => {
          expect(ErrorCodes.BAD_REQUEST_ERROR).toBe('BAD_REQUEST_ERROR');
     });

     it('should allow ErrorCode type assignment from ErrorCodes values', () => {
          const code: ErrorCode = ErrorCodes.UNAUTHORIZED;
          expect(code).toBe('UNAUTHORIZED');
     });
});
