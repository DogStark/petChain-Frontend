import React from "react";
import { MapPin, Phone, Mail, Navigation } from "lucide-react";
import { ClinicLocation } from "@/types/clinic";

interface LocationMapProps {
  locations: ClinicLocation[];
}

export default function LocationMap({ locations }: LocationMapProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Visual Placeholder for actual Map */}
      <div className="bg-blue-100 rounded-3xl overflow-hidden relative group min-h-[300px]">
        <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/-0.1276,51.5072,12/800x600?access_token=none')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700"></div>
        <div className="absolute inset-0 bg-blue-900/10 group-hover:bg-blue-900/0 transition-colors"></div>

        {/* Mock Markers */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-2xl animate-bounce">
          <MapPin className="w-8 h-8 text-pink-500 fill-pink-500" />
        </div>

        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-white/40 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
          <div className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">
            Head Office
          </div>
          <div className="text-sm font-bold text-gray-800">
            {locations[0].address}
          </div>
        </div>
      </div>

      {/* Details List */}
      <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-blue-200">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:border-pink-200 transition-colors relative group overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-full -mr-12 -mt-12 group-hover:bg-pink-100 transition-colors"></div>

            <div className="relative">
              <h4 className="font-black text-blue-900 text-lg mb-4">
                {loc.name}
              </h4>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-600 font-medium">
                    {loc.address}
                    <br />
                    {loc.city}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-gray-600 font-bold">
                    {loc.phone}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-gray-600 font-medium">
                    {loc.email}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button className="flex-grow py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2">
                  <Navigation className="w-3.5 h-3.5" /> Navigate
                </button>
                <button className="flex-grow py-2.5 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                  Call Clinic
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
