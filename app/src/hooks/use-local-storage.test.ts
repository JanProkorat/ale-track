import { it, vi, expect, describe, beforeEach } from 'vitest';

import { useLocalStorage } from 'src/hooks/use-local-storage';

import { act, renderHook } from 'src/test/test-utils';

describe('useLocalStorage hook', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

      expect(result.current[0]).toBe('initial-value');
    });

    it('should return stored value when localStorage has data', () => {
      window.localStorage.setItem('test-key', JSON.stringify('stored-value'));

      const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

      expect(result.current[0]).toBe('stored-value');
    });

    it('should handle different data types - number', () => {
      window.localStorage.setItem('test-key', JSON.stringify(42));

      const { result } = renderHook(() => useLocalStorage('test-key', 0));

      expect(result.current[0]).toBe(42);
    });

    it('should handle different data types - boolean', () => {
      window.localStorage.setItem('test-key', JSON.stringify(true));

      const { result } = renderHook(() => useLocalStorage('test-key', false));

      expect(result.current[0]).toBe(true);
    });

    it('should handle different data types - object', () => {
      const obj = { name: 'test', value: 123 };
      window.localStorage.setItem('test-key', JSON.stringify(obj));

      const { result } = renderHook(() => useLocalStorage('test-key', {}));

      expect(result.current[0]).toEqual(obj);
    });

    it('should handle different data types - array', () => {
      const arr = [1, 2, 3, 4, 5];
      window.localStorage.setItem('test-key', JSON.stringify(arr));

      const { result } = renderHook(() => useLocalStorage<number[]>('test-key', []));

      expect(result.current[0]).toEqual(arr);
    });
  });

  describe('setValue function', () => {
    it('should update state and localStorage with direct value', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
      expect(window.localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
    });

    it('should update state and localStorage with function updater', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 10));

      act(() => {
        result.current[1]((prev) => prev + 5);
      });

      expect(result.current[0]).toBe(15);
      expect(window.localStorage.getItem('test-key')).toBe(JSON.stringify(15));
    });

    it('should update complex objects', () => {
      const initial = { count: 0, name: 'test' };
      const { result } = renderHook(() => useLocalStorage('test-key', initial));

      act(() => {
        result.current[1]({ count: 1, name: 'updated' });
      });

      expect(result.current[0]).toEqual({ count: 1, name: 'updated' });
      expect(window.localStorage.getItem('test-key')).toBe(
        JSON.stringify({ count: 1, name: 'updated' })
      );
    });

    it('should handle multiple updates', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 0));

      act(() => {
        result.current[1](1);
      });
      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1](2);
      });
      expect(result.current[0]).toBe(2);

      act(() => {
        result.current[1](3);
      });
      expect(result.current[0]).toBe(3);

      expect(window.localStorage.getItem('test-key')).toBe(JSON.stringify(3));
    });
  });

  describe('error handling', () => {
    it('should return initial value when localStorage contains invalid JSON', () => {
      window.localStorage.setItem('test-key', 'invalid-json{{{');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));

      expect(result.current[0]).toBe('fallback');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading localStorage key'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle localStorage.setItem errors gracefully', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      // Mock localStorage.setItem to throw an error
      const originalSetItem = window.localStorage.setItem;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
      window.localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      act(() => {
        result.current[1]('new-value');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error setting localStorage key'),
        expect.any(Error)
      );

      // Restore
      window.localStorage.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });
  });

  describe('key isolation', () => {
    it('should not interfere with other keys', () => {
      const { result: result1 } = renderHook(() => useLocalStorage('key1', 'value1'));
      const { result: result2 } = renderHook(() => useLocalStorage('key2', 'value2'));

      expect(result1.current[0]).toBe('value1');
      expect(result2.current[0]).toBe('value2');

      act(() => {
        result1.current[1]('updated1');
      });

      expect(result1.current[0]).toBe('updated1');
      expect(result2.current[0]).toBe('value2');
    });
  });
});
