// Test the enumName pattern used in enumTranslations.ts

describe('enumName pattern', () => {
     // Simulate a TypeScript numeric enum (which has reverse mappings)
     const TestEnum: Record<string | number, string | number> = {
          Foo: 0,
          Bar: 1,
          Baz: 2,
          0: 'Foo',
          1: 'Bar',
          2: 'Baz',
     };

     function enumName(
          enumObj: Record<string | number, string | number>,
          value: string | number,
     ): string {
          if (typeof value === 'string') return value;
          return String(enumObj[value] ?? value);
     }

     it('returns string values unchanged', () => {
          expect(enumName(TestEnum, 'Foo')).toBe('Foo');
          expect(enumName(TestEnum, 'Bar')).toBe('Bar');
          expect(enumName(TestEnum, 'SomethingElse')).toBe('SomethingElse');
     });

     it('maps numeric values to enum key names', () => {
          expect(enumName(TestEnum, 0)).toBe('Foo');
          expect(enumName(TestEnum, 1)).toBe('Bar');
          expect(enumName(TestEnum, 2)).toBe('Baz');
     });

     it('returns stringified number for unknown values', () => {
          expect(enumName(TestEnum, 99)).toBe('99');
          expect(enumName(TestEnum, -1)).toBe('-1');
     });
});
