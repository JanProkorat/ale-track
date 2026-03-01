import { it, expect, describe } from 'vitest';

import { validateContacts } from './validate-contacts';
import { ContactType, UpdateClientContactDto } from '../api/Client';

function contact(overrides: { type?: any; value?: any }) {
  const dto = new UpdateClientContactDto();
  dto.type = overrides.type;
  dto.value = overrides.value;
  return dto;
}

describe('validate-contacts utilities', () => {
  describe('validateContacts', () => {
    it('should return no errors for valid contacts', () => {
      const contacts = [
        contact({ type: ContactType.Email, value: 'test@example.com' }),
        contact({ type: ContactType.Phone, value: '+420123456789' }),
      ];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(false);
      expect(Object.keys(result.validationErrors)).toHaveLength(0);
    });

    it('should return error for contact with missing type', () => {
      const contacts = [contact({ type: undefined, value: 'test@example.com' })];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.type).toBe(true);
    });

    it('should return error for contact with null type', () => {
      const contacts = [contact({ type: null, value: 'test@example.com' })];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.type).toBe(true);
    });

    it('should return error for contact with missing value', () => {
      const contacts = [contact({ type: ContactType.Email, value: undefined })];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.value).toBe(true);
    });

    it('should return error for contact with empty string value', () => {
      const contacts = [contact({ type: ContactType.Email, value: '' })];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.value).toBe(true);
    });

    it('should return error for contact with whitespace-only value', () => {
      const contacts = [contact({ type: ContactType.Email, value: '   ' })];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.value).toBe(true);
    });

    it('should return errors for multiple invalid contacts', () => {
      const contacts = [
        contact({ type: undefined, value: 'test@example.com' }),
        contact({ type: ContactType.Phone, value: '' }),
        contact({ type: ContactType.Email, value: 'valid@example.com' }), // valid
      ];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.type).toBe(true);
      expect(result.validationErrors[1]?.value).toBe(true);
      expect(result.validationErrors[2]).toBeUndefined();
    });

    it('should return both type and value errors when both are missing', () => {
      const contacts = [contact({ type: undefined, value: '' })];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.type).toBe(true);
      expect(result.validationErrors[0]?.value).toBe(true);
    });

    it('should return no errors for undefined contacts', () => {
      const result = validateContacts(undefined);
      expect(result.hasErrors).toBe(false);
      expect(Object.keys(result.validationErrors)).toHaveLength(0);
    });

    it('should return no errors for empty contacts array', () => {
      const result = validateContacts([]);
      expect(result.hasErrors).toBe(false);
      expect(Object.keys(result.validationErrors)).toHaveLength(0);
    });

    it('should validate with correct index for mixed valid and invalid contacts', () => {
      const contacts = [
        contact({ type: ContactType.Email, value: 'valid1@example.com' }), // index 0 - valid
        contact({ type: undefined, value: '' }), // index 1 - invalid
        contact({ type: ContactType.Phone, value: '+420123456789' }), // index 2 - valid
        contact({ type: ContactType.Email, value: '' }), // index 3 - invalid
      ];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]).toBeUndefined();
      expect(result.validationErrors[1]).toBeDefined();
      expect(result.validationErrors[2]).toBeUndefined();
      expect(result.validationErrors[3]).toBeDefined();
    });
  });
});
