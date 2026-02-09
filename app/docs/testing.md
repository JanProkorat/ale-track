# Testing Documentation

## Overview

This document describes the testing setup and practices for the AleTrack application.

## Testing Stack

- **Test Runner**: [Vitest](https://vitest.dev/) - Fast, modern test runner with native ES modules support
- **Testing Library**: [@testing-library/react](https://testing-library.com/react) - React component testing utilities
- **DOM Environment**: [happy-dom](https://github.com/capricorn86/happy-dom) - Fast DOM implementation for testing
- **Assertions**: [@testing-library/jest-dom](https://testing-library.com/docs/ecosystem-jest-dom/) - Custom matchers for DOM testing

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

Tests are colocated with the source code files they test:
```
src/
  utils/
    format-number.ts
    format-number.test.ts  ← Test file
  hooks/
    use-local-storage.ts
    use-local-storage.test.ts  ← Test file
```

## Coverage Goals

- **Utilities**: 90%+ coverage ✅ Achieved (99%)
- **Hooks**: 85%+ coverage ✅ Achieved (100%)
- **Components**: 70%+ coverage (In Progress)
- **Integration**: Critical flows covered (Planned)

## Test Organization

### Unit Tests - Utilities

#### format-number.ts (27 tests) ✅
Tests for number formatting functions:
- `fNumber()` - Number formatting with locales
- `fCurrency()` - Currency formatting
- `fPercent()` - Percentage formatting
- `fShortenNumber()` - K, M, B abbreviations

Coverage: 100%

#### format-time.ts (20 tests) ✅
Tests for date/time formatting:
- `fDateTime()` - Date and time formatting
- `fDate()` - Date formatting
- `fToNow()` - Relative time formatting

Coverage: 100%

#### format-enum-value.ts (11 tests) ✅
Tests for enum value mapping:
- `mapEnumValue()` - Convert values to enum
- `mapEnumFromString()` - Convert strings to enum

Coverage: 93%

#### map-address-to-string.ts (7 tests) ✅
Tests for address formatting:
- `addressToString()` - Convert address object to string
- Handles missing fields gracefully
- Supports multiple countries

Coverage: 100%

#### validate-address.ts (9 tests) ✅
Tests for address validation:
- Required field validation
- Returns appropriate error messages
- i18n integration

Coverage: 100%

#### validate-contacts.ts (11 tests) ✅
Tests for contact validation:
- Type validation
- Value validation
- Multiple contacts validation

Coverage: 100%

#### sort-daysof-week.ts (9 tests) ✅
Tests for day sorting:
- Sorts days starting from Monday
- Handles empty arrays
- Preserves original array

Coverage: 100%

### Custom Hooks

#### use-local-storage.ts (13 tests) ✅
Tests for localStorage hook:
- Initial state management
- setValue with direct and function values
- Multiple data types (string, number, boolean, object, array)
- Error handling for invalid JSON
- Error handling for storage quota
- Key isolation

Coverage: 100%

## Best Practices

### 1. Test Naming

Use descriptive test names that explain the behavior:

```typescript
// ✅ Good
it('should return empty string for null input')

// ❌ Bad  
it('test null')
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should format currency correctly', () => {
  // Arrange
  const value = 1234.56;
  
  // Act
  const result = fCurrency(value);
  
  // Assert
  expect(result).toContain('$1,234.56');
});
```

### 3. Test Edge Cases

Always test:
- Empty/null/undefined values
- Boundary conditions
- Error cases
- Multiple data types

### 4. Use describe() for Grouping

```typescript
describe('format-number utilities', () => {
  describe('fCurrency', () => {
    it('should format positive numbers');
    it('should format negative numbers');
    it('should handle null');
  });
});
```

### 5. Mock External Dependencies

```typescript
// Mock i18next for tests
vi.mock('i18next', () => ({
  t: (key: string) => key,
}));
```

## Testing Utilities

### Test Setup (src/test/setup.ts)

Global test setup that runs before all tests:
- Cleanup after each test
- Mock localStorage
- Mock matchMedia
- Mock window APIs

### Test Utils (src/test/test-utils.tsx)

Helper functions for testing React components:
- `renderWithProviders()` - Renders components with Theme and other providers

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:
- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI/CD
- `coverage/coverage-final.json` - JSON format

View the report by opening `coverage/index.html` in a browser after running:
```bash
npm run test:coverage
```

## Configuration

### vitest.config.ts

Key configuration:
- Uses `happy-dom` environment for fast DOM testing
- Imports test setup from `src/test/setup.ts`
- Coverage thresholds set to 70% for all metrics
- Excludes test files, mocks, and config from coverage

### Coverage Thresholds

Current thresholds in `vitest.config.ts`:
```typescript
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 70,
    statements: 70,
  },
}
```

## Common Patterns

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';

it('should update value', () => {
  const { result } = renderHook(() => useLocalStorage('key', 'initial'));
  
  act(() => {
    result.current[1]('updated');
  });
  
  expect(result.current[0]).toBe('updated');
});
```

### Testing with Mocks

```typescript
vi.mock('src/api/Client', () => ({
  Country: {
    Czechia: 0,
    Germany: 1,
  },
}));

const { functionToTest } = await import('src/utils/my-util');
```

### Testing Async Functions

```typescript
it('should handle async operations', async () => {
  const promise = asyncFunction();
  await expect(promise).resolves.toBe(expected);
});
```

## Future Plans

### Phase 2: Component Tests (Planned)
- Map components
- Chart components
- Form components
- Layout components

### Phase 3: Integration Tests (Planned)
- Set up MSW for API mocking
- Test user flows
- Test API integration
- Test data flow between components

### Phase 4: E2E Tests (Future)
- Set up Playwright
- Critical user journeys
- Responsive design testing
- Cross-browser testing

## Troubleshooting

### Tests not running
- Ensure dependencies are installed: `npm install`
- Check Vitest is installed: `npm list vitest`

### Coverage not generating
- Install coverage provider: `npm install -D @vitest/coverage-v8`

### DOM not available
- Check `environment: 'happy-dom'` in vitest.config.ts
- Verify happy-dom is installed

### Module resolution issues
- Check path aliases in vitest.config.ts match tsconfig.json
- Ensure imports use `src/` prefix

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro)
- [Kent C. Dodds - Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)

## Maintenance

- Update tests when requirements change
- Review tests during code reviews
- Keep documentation up-to-date
- Monitor coverage trends over time

---

Last updated: 2026-02-09
