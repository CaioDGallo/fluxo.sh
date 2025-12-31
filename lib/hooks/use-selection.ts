import { useState, useCallback } from 'react';

type UseSelectionOptions = {
  onModeChange?: (isActive: boolean) => void;
};

export function useSelection(options?: UseSelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const enterSelectionMode = useCallback((initialId: number) => {
    setSelectedIds(new Set([initialId]));
    setIsSelectionMode(true);
    options?.onModeChange?.(true);
  }, [options]);

  const exitSelectionMode = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    options?.onModeChange?.(false);
  }, [options]);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Auto-exit if nothing selected
        if (next.size === 0) {
          setIsSelectionMode(false);
          options?.onModeChange?.(false);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  }, [options]);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelectionMode,
    isSelected,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
  };
}
