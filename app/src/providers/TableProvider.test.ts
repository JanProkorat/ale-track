import { it, vi, expect, describe, beforeEach } from 'vitest';

import { act, renderHook } from 'src/test/test-utils';

import { useTable } from './TableProvider';

import type { TableProps } from './TableProvider';

describe('useTable', () => {
    let mockSetOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
    let mockSetOrderBy: React.Dispatch<React.SetStateAction<string>>;

    function createProps(overrides?: Partial<TableProps>): TableProps {
        return {
            order: 'asc',
            orderBy: 'name',
            setOrder: mockSetOrder,
            setOrderBy: mockSetOrderBy,
            ...overrides,
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockSetOrder = vi.fn();
        mockSetOrderBy = vi.fn();
    });

    it('should return initial page as 0', () => {
        const { result } = renderHook(() => useTable(createProps()));

        expect(result.current.page).toBe(0);
    });

    it('should return initial rowsPerPage as 5', () => {
        const { result } = renderHook(() => useTable(createProps()));

        expect(result.current.rowsPerPage).toBe(5);
    });

    it('should return empty selected array', () => {
        const { result } = renderHook(() => useTable(createProps()));

        expect(result.current.selected).toEqual([]);
    });

    it('should toggle sort direction when same column is sorted', () => {
        const { result } = renderHook(() => useTable(createProps({ order: 'asc', orderBy: 'name' })));

        act(() => {
            result.current.onSort('name');
        });

        expect(mockSetOrder).toHaveBeenCalledWith('desc');
        expect(mockSetOrderBy).toHaveBeenCalledWith('name');
    });

    it('should set asc when sorting a different column', () => {
        const { result } = renderHook(() => useTable(createProps({ order: 'asc', orderBy: 'name' })));

        act(() => {
            result.current.onSort('weight');
        });

        expect(mockSetOrder).toHaveBeenCalledWith('asc');
        expect(mockSetOrderBy).toHaveBeenCalledWith('weight');
    });

    it('should select all rows when checked is true', () => {
        const { result } = renderHook(() => useTable(createProps()));

        act(() => {
            result.current.onSelectAllRows(true, ['id1', 'id2', 'id3']);
        });

        expect(result.current.selected).toEqual(['id1', 'id2', 'id3']);
    });

    it('should deselect all rows when checked is false', () => {
        const { result } = renderHook(() => useTable(createProps()));

        act(() => {
            result.current.onSelectAllRows(true, ['id1', 'id2']);
        });

        act(() => {
            result.current.onSelectAllRows(false, ['id1', 'id2']);
        });

        expect(result.current.selected).toEqual([]);
    });

    it('should add row to selected on onSelectRow', () => {
        const { result } = renderHook(() => useTable(createProps()));

        act(() => {
            result.current.onSelectRow('id1');
        });

        expect(result.current.selected).toEqual(['id1']);
    });

    it('should remove row from selected when already selected', () => {
        const { result } = renderHook(() => useTable(createProps()));

        act(() => {
            result.current.onSelectRow('id1');
        });

        act(() => {
            result.current.onSelectRow('id1');
        });

        expect(result.current.selected).toEqual([]);
    });

    it('should reset page to 0 on onResetPage', () => {
        const { result } = renderHook(() => useTable(createProps()));

        act(() => {
            result.current.onChangePage(null, 3);
        });

        expect(result.current.page).toBe(3);

        act(() => {
            result.current.onResetPage();
        });

        expect(result.current.page).toBe(0);
    });

    it('should change page on onChangePage', () => {
        const { result } = renderHook(() => useTable(createProps()));

        act(() => {
            result.current.onChangePage(null, 2);
        });

        expect(result.current.page).toBe(2);
    });

    it('should change rows per page and reset page', () => {
        const { result } = renderHook(() => useTable(createProps()));

        act(() => {
            result.current.onChangePage(null, 3);
        });

        act(() => {
            result.current.onChangeRowsPerPage({
                target: { value: '10' },
            } as React.ChangeEvent<HTMLInputElement>);
        });

        expect(result.current.rowsPerPage).toBe(10);
        expect(result.current.page).toBe(0);
    });

    it('should set desc when order is asc for same column', () => {
        const { result } = renderHook(() => useTable(createProps({ order: 'desc', orderBy: 'name' })));

        act(() => {
            result.current.onSort('name');
        });

        // orderBy === 'name' && order === 'desc' → isAsc is false → setOrder('asc')
        expect(mockSetOrder).toHaveBeenCalledWith('asc');
    });
});
