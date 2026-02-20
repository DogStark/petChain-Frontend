import React from "react";
import { LabCategory } from "@/types/lab-results";

interface CategoryTabsProps {
  categories: LabCategory[];
  activeCategory: LabCategory;
  onSelect: (cat: LabCategory) => void;
}

export default function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
}: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`whitespace-nowrap px-4 py-2 rounded-full font-medium transition-all ${
            activeCategory === cat
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
