import React, { useMemo, useState } from 'react';
import { ClinicService } from '@/types/clinic';
import { Tag } from 'lucide-react';

interface ServiceListProps {
  services: ClinicService[];
  onBook?: (service: ClinicService) => void;
}

export default function ServiceList({ services, onBook }: ServiceListProps) {
  const categories = useMemo(() => {
    const cats = Array.from(
      new Set(services.map((s) => s.category ?? 'General').filter(Boolean))
    ).sort();
    return ['All', ...cats];
  }, [services]);

  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = useMemo(
    () =>
      activeCategory === 'All'
        ? services
        : services.filter((s) => (s.category ?? 'General') === activeCategory),
    [services, activeCategory]
  );

  return (
    <div className="space-y-6">
      {/* Category filter pills */}
      {categories.length > 2 && (
        <div
          role="group"
          aria-label="Filter by service category"
          className="flex flex-wrap gap-2"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Service cards */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-10 font-medium">
            No services in this category.
          </p>
        )}
        {filtered.map((service) => (
          <div
            key={service.id}
            className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-blue-200 transition-colors"
          >
            <div className="flex-grow">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {service.name}
                </h4>
                {service.category && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {service.category}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 max-w-xl">{service.description}</p>
              {service.duration != null && (
                <p className="text-xs text-gray-400 mt-1">{service.duration} min</p>
              )}
            </div>

            <div className="flex items-center gap-6 shrink-0">
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-xs text-gray-400 mb-0.5">
                  <Tag className="w-3 h-3" /> Pricing
                </div>
                <div className="font-black text-blue-900 text-lg">{service.priceRange}</div>
              </div>
              <button
                type="button"
                onClick={() => onBook?.(service)}
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95"
              >
                Book This
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
