import { it, vi, expect, describe } from 'vitest';

// Mock the API Client module
vi.mock('src/api/Client', () => ({
  ContactType: {
    Email: 0,
    Phone: 1,
  },
}));

// Import after mocks are set up
const { validateContacts } = await import('src/utils/validate-contacts');
const { ContactType } = await import('src/api/Client');

describe('validate-contacts utilities', () => {
  describe('validateContacts', () => {
    it('should return no errors for valid contacts', () => {
      const contacts = [
        { type: ContactType.Email, value: 'test@example.com' },
        { type: ContactType.Phone, value: '+420123456789' },
      ];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(false);
      expect(Object.keys(result.validationErrors)).toHaveLength(0);
    });

    it('should return error for contact with missing type', () => {
      const contacts = [{ type: undefined as any, value: 'test@example.com' }];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.type).toBe(true);
    });

    it('should return error for contact with null type', () => {
      const contacts = [{ type: null as any, value: 'test@example.com' }];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.type).toBe(true);
    });

    it('should return error for contact with missing value', () => {
      const contacts = [{ type: ContactType.Email, value: undefined as any }];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.value).toBe(true);
    });

    it('should return error for contact with empty string value', () => {
      const contacts = [{ type: ContactType.Email, value: '' }];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.value).toBe(true);
    });

    it('should return error for contact with whitespace-only value', () => {
      const contacts = [{ type: ContactType.Email, value: '   ' }];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.value).toBe(true);
    });

    it('should return errors for multiple invalid contacts', () => {
      const contacts = [
        { type: undefined as any, value: 'test@example.com' },
        { type: ContactType.Phone, value: '' },
        { type: ContactType.Email, value: 'valid@example.com' }, // valid
      ];

      const result = validateContacts(contacts);
      expect(result.hasErrors).toBe(true);
      expect(result.validationErrors[0]?.type).toBe(true);
      expect(result.validationErrors[1]?.value).toBe(true);
      expect(result.validationErrors[2]).toBeUndefined();
    });

    it('should return both type and value errors when both are missing', () => {
      const contacts = [{ type: undefined as any, value: '' }];

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
        { type: ContactType.Email, value: 'valid1@example.com' }, // index 0 - valid
        { type: undefined as any, value: '' }, // index 1 - invalid
        { type: ContactType.Phone, value: '+420123456789' }, // index 2 - valid
        { type: ContactType.Email, value: '' }, // index 3 - invalid
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
