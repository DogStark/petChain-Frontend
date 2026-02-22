import React from "react";
import { ClinicService } from "@/types/clinic";
import { Tag } from "lucide-react";

interface ServiceListProps {
  services: ClinicService[];
}

export default function ServiceList({ services }: ServiceListProps) {
  return (
    <div className="space-y-4">
      {services.map((service) => (
        <div
          key={service.id}
          className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-blue-200 transition-colors"
        >
          <div className="flex-grow">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {service.name}
              </h4>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
                Popular
              </span>
            </div>
            <p className="text-sm text-gray-500 max-w-xl">
              {service.description}
            </p>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-xs text-gray-400 mb-0.5">
                <Tag className="w-3 h-3" /> Pricing
              </div>
              <div className="font-black text-blue-900 text-lg">
                {service.priceRange}
              </div>
            </div>
            <button className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95">
              Book This
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
