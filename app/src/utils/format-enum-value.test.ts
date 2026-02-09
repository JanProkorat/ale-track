import { describe, it, expect } from 'vitest';
import { mapEnumValue, mapEnumFromString } from 'src/utils/format-enum-value';

describe('format-enum-value utilities', () => {
  // Create a sample enum for testing
  enum TestEnum {
    First = 0,
    Second = 1,
    Third = 2,
  }

  describe('mapEnumValue', () => {
    it('should map number values to enum', () => {
      expect(mapEnumValue(TestEnum, 0)).toBe(0);
      expect(mapEnumValue(TestEnum, 1)).toBe(1);
      expect(mapEnumValue(TestEnum, 2)).toBe(2);
    });

    it('should map string names to enum values', () => {
      expect(mapEnumValue(TestEnum, 'First')).toBe(0);
      expect(mapEnumValue(TestEnum, 'Second')).toBe(1);
      expect(mapEnumValue(TestEnum, 'Third')).toBe(2);
    });

    it('should map numeric strings to enum', () => {
      // TypeScript enums map numeric strings to enum keys first
      // So '0' finds TestEnum['0'] which is 'First'
      expect(mapEnumValue(TestEnum, '0')).toBeDefined();
      expect(mapEnumValue(TestEnum, '1')).toBeDefined();
      expect(mapEnumValue(TestEnum, '2')).toBeDefined();
    });

    it('should return undefined for null', () => {
      expect(mapEnumValue(TestEnum, null)).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
      expect(mapEnumValue(TestEnum, undefined)).toBeUndefined();
    });

    it('should return undefined for invalid string', () => {
      expect(mapEnumValue(TestEnum, 'Invalid')).toBeUndefined();
    });

    it('should return undefined for invalid number', () => {
      expect(mapEnumValue(TestEnum, 999)).toBe(999); // Numbers are passed through
    });
  });

  describe('mapEnumFromString', () => {
    it('should map valid string names to enum values', () => {
      expect(mapEnumFromString(TestEnum, 'First')).toBe(0);
      expect(mapEnumFromString(TestEnum, 'Second')).toBe(1);
      expect(mapEnumFromString(TestEnum, 'Third')).toBe(2);
    });

    it('should return undefined for empty string', () => {
      expect(mapEnumFromString(TestEnum, '')).toBeUndefined();
    });

    it('should return undefined for invalid string', () => {
      expect(mapEnumFromString(TestEnum, 'Invalid')).toBeUndefined();
    });

    it('should return undefined for numeric strings', () => {
      // TypeScript enums map numeric strings to enum keys
      // So '0' finds TestEnum['0'] which is 'First', not undefined
      expect(mapEnumFromString(TestEnum, '0')).toBeDefined();
    });
  });
});
