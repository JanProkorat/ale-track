import { it, expect, describe } from 'vitest';

import { act, renderHook } from 'src/test/test-utils';

import { EntityStatsProvider, useEntityStatsRefresh } from './EntityStatsContext';

describe('EntityStatsContext', () => {
    it('should return initial refreshKey as 0', () => {
        const { result } = renderHook(() => useEntityStatsRefresh(), {
            wrapper: EntityStatsProvider,
        });

        expect(result.current.refreshKey).toBe(0);
    });

    it('should increment refreshKey when triggerRefresh is called', () => {
        const { result } = renderHook(() => useEntityStatsRefresh(), {
            wrapper: EntityStatsProvider,
        });

        act(() => {
            result.current.triggerRefresh();
        });

        expect(result.current.refreshKey).toBe(1);
    });

    it('should increment refreshKey multiple times', () => {
        const { result } = renderHook(() => useEntityStatsRefresh(), {
            wrapper: EntityStatsProvider,
        });

        act(() => {
            result.current.triggerRefresh();
        });

        act(() => {
            result.current.triggerRefresh();
        });

        act(() => {
            result.current.triggerRefresh();
        });

        expect(result.current.refreshKey).toBe(3);
    });

    it('should provide default values when used outside provider', () => {
        const { result } = renderHook(() => useEntityStatsRefresh());

        expect(result.current.refreshKey).toBe(0);
        expect(typeof result.current.triggerRefresh).toBe('function');
    });
});
