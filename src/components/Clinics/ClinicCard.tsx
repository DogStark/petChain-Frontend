import React from "react";
import Link from "next/link";
import { Star, MapPin, Clock, ArrowRight } from "lucide-react";
import { Clinic } from "@/types/clinic";

interface ClinicCardProps {
  clinic: Clinic;
}

export default function ClinicCard({ clinic }: ClinicCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-xl border border-white/40 hover:shadow-2xl transition-all group flex flex-col h-full">
      <div className="relative h-40 w-full mb-4 overflow-hidden rounded-2xl">
        {clinic.mainImage ? (
          <img
            src={clinic.mainImage}
            alt={clinic.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-blue-100 flex items-center justify-center">
            <MapPin className="w-12 h-12 text-blue-300" />
          </div>
        )}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
          <span className="text-xs font-bold text-gray-800">
            {clinic.rating}
          </span>
        </div>
      </div>

      <div className="flex-grow">
        <h3 className="text-xl font-bold text-blue-900 mb-1 group-hover:text-blue-600 transition-colors">
          {clinic.name}
        </h3>

        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <MapPin className="w-3.5 h-3.5 text-pink-500" />
          <span className="truncate">
            {clinic.locations[0].city} (plus {clinic.locations.length - 1} more)
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {clinic.services.slice(0, 3).map((service) => (
            <span
              key={service.id}
              className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100"
            >
              {service.name}
            </span>
          ))}
          {clinic.services.length > 3 && (
            <span className="px-2 py-1 bg-gray-50 text-gray-400 text-[10px] font-bold rounded-lg">
              +{clinic.services.length - 3} more
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          Open Now
        </div>
        <Link
          href={`/clinics/${clinic.id}`}
          className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
        >
          View Profile <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
