'use client';

import { Trash2, X, CheckSquare, Square } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface BulkActionsProps<T> {
  selectedItems: Set<string>;
  totalItems: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  itemName?: string;
  isLoading?: boolean;
}

export default function BulkActions<T extends { id: string }>({
  selectedItems,
  totalItems,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  itemName = 'items',
  isLoading = false,
}: BulkActionsProps<T>) {
  const { t } = useTranslations();
  const selectedCount = selectedItems.size;
  const allSelected = selectedCount === totalItems && totalItems > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalItems;

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="bulk-actions-bar">
      <div className="bulk-actions-info">
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="bulk-actions-checkbox-btn"
          title={allSelected ? t('common.deselectAll') : t('common.selectAll')}
        >
          {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>
        <span className="bulk-actions-count">
          {selectedCount} {selectedCount === 1 ? itemName : `${itemName}s`} {t('common.selected')}
        </span>
      </div>
      <div className="bulk-actions-buttons">
        <button
          onClick={onDeleteSelected}
          disabled={isLoading || selectedCount === 0}
          className="btn btn-danger btn-sm"
        >
          <Trash2 size={16} />
          <span>{t('common.deleteSelected')}</span>
        </button>
        <button
          onClick={onDeselectAll}
          className="btn btn-secondary btn-sm"
        >
          <X size={16} />
          <span>{t('common.clear')}</span>
        </button>
      </div>
    </div>
  );
}
