import React, { useRef } from 'react';
import { LabCategory } from '@/types/lab-results';

interface CategoryTabsProps {
  categories: LabCategory[];
  activeCategory: LabCategory;
  onSelect: (cat: LabCategory) => void;
  /** Optional count per category for badge display */
  counts?: Partial<Record<LabCategory, number>>;
}

export default function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
  counts,
}: CategoryTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') {
      next = (index + 1) % categories.length;
    } else if (e.key === 'ArrowLeft') {
      next = (index - 1 + categories.length) % categories.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = categories.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    tabRefs.current[next]?.focus();
    onSelect(categories[next]);
  };

  return (
    <div
      role="tablist"
      aria-label="Lab result categories"
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto"
    >
      {categories.map((cat, index) => {
        const isActive = activeCategory === cat;
        const count = counts?.[cat];

        return (
          <button
            key={cat}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${cat}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(cat)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-medium transition-all flex items-center gap-1.5 ${
              isActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            {cat}
            {count !== undefined && (
              <span
                className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
