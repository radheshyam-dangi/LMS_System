import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';
import './AssignmentsFilterPanel.css';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterCategory {
  id: string;
  label: string;
  options: FilterOption[];
}

interface FilterPanelProps {
  categories: FilterCategory[];
  isOpen: boolean;
  onClose: () => void;
  initialFilters?: Record<string, string>;
  onApply?: (filters: Record<string, string>) => void;
}

export const AssignmentsFilterPanel: React.FC<FilterPanelProps> = ({ categories, isOpen, onClose, initialFilters, onApply }) => {
  useScrollLock(isOpen);
  
  // Local state for checkboxes
  const [localFilters, setLocalFilters] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (isOpen) {
      // Sync from initialFilters when opening
      const initial: Record<string, string[]> = {};
      categories.forEach(cat => {
        const val = initialFilters?.[cat.id];
        if (val) {
          initial[cat.id] = val.split(',');
        } else {
          initial[cat.id] = [];
        }
      });
      setLocalFilters(initial);
    }
  }, [isOpen, initialFilters, categories]);

  const handleCheckboxChange = (categoryId: string, optionValue: string) => {
    setLocalFilters(prev => {
      const current = prev[categoryId] || [];
      if (current.includes(optionValue)) {
        return { ...prev, [categoryId]: current.filter(v => v !== optionValue) };
      } else {
        return { ...prev, [categoryId]: [...current, optionValue] };
      }
    });
  };

  const handleApply = () => {
    if (onApply) {
      const newFilters: Record<string, string> = {};
      Object.keys(localFilters).forEach(key => {
        const vals = localFilters[key];
        if (vals && vals.length > 0) {
          newFilters[key] = vals.join(',');
        }
      });
      onApply(newFilters);
    }
    onClose();
  };

  const handleClear = () => {
    setLocalFilters({});
    if (onApply) {
      onApply({});
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="filter-panel-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="filter-panel-content" onClick={(e) => e.stopPropagation()}>
        <div className="filter-panel-header">
          <h2>Filters</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="filter-panel-body">
          {categories.map(category => (
            <div key={category.id} className="filter-category">
              <h3 className="category-title">{category.label}</h3>
              <div className="category-options">
                {category.options.map(opt => (
                  <label key={opt.value} className="checkbox-label">
                    <input 
                      type="checkbox"
                      checked={(localFilters[category.id] || []).includes(opt.value)}
                      onChange={() => handleCheckboxChange(category.id, opt.value)}
                    />
                    <span className="checkbox-text">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="filter-panel-footer">
          <button className="btn-clear" onClick={handleClear}>Clear all</button>
          <button className="btn-apply" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
};
